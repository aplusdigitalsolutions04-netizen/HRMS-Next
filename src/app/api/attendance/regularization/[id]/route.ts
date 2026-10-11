// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, calcHours, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getHalfDayThreshold, resolveAttendanceStatus } from '@/lib/teamoffice';
import { isHoliday } from '@/lib/holidays';
import { recalcAttendanceSummary } from '@/lib/attendance-summary';
import { auditFrom } from '@/lib/audit';
import { getStep, getMaxStep, canActOnStep, recordAction } from '@/lib/approvalEngine';
import { sendRequestMail, hrRecipients, managerOf, appUrl, requestHasActions, mailApproverOfUpdate } from '@/lib/request-mail';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Decision on a missed-punch or late-coming request. The reporting manager decides first, then HR.
// Rejecting at any step ends the request. The final approval of a missed punch corrects the day's
// attendance on the spot (times, hours and status worked out like a normal punch day, so a Saturday punch
// becomes Extra Work and a short day a Half Day), marked as a manual entry so the TeamOffice sync never undoes
// it. A late-coming request is only recorded as approved (nothing in attendance changes).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : '';
    if (!action) return jsonError('action must be approve or reject', 422);
    const note = String(body.note || '').trim().slice(0, 300);

    const rows = await query<RowDataPacket[]>("SELECT *, DATE_FORMAT(attendance_date, '%Y-%m-%d') AS d FROM attendance_regularizations WHERE id = ?", [id]);
    if (rows.length === 0) return jsonError('Request not found', 404);
    const r = rows[0];
    if (r.status !== 'Pending') return jsonError('This request was already decided', 409);
    if (action === 'reject' && !note) return jsonError('Please write a short reason for rejecting', 422);

    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, email_id FROM employees WHERE emp_code = ?', [r.emp_code]))[0];
    const late = r.request_type === 'Late coming';
    const kind = late ? 'late_coming' : 'missed_punch';

    // Who may act: the person of the current step; requests without a workflow use the HR permission.
    const step = r.workflow_id && r.current_step ? await getStep(r.workflow_id, r.current_step) : null;
    if (step) {
      if (!emp || !(await canActOnStep(step, user, String(emp.id), 'approve_regularization'))) return jsonError('Insufficient permissions', 403);
    } else if (user.type !== 'admin' || !(checkPermission(user, 'approve_regularization') || checkPermission(user, 'upload_attendance'))) {
      return jsonError('Insufficient permissions', 403);
    }

    const mgr = emp ? await managerOf(String(emp.id)) : null;
    const vars = {
      employee_name: emp?.full_name || r.emp_code, emp_code: r.emp_code, request_type: r.request_type, date: r.d,
      in_time: r.in_time || '', out_time: late ? '' : (r.out_time || ''), reason: r.reason || '-', manager_name: mgr?.full_name || '', remarks: note,
    };
    const mailAs = { id: user.id, type: user.type };
    const label = late ? 'Late coming' : 'Attendance correction';
    await recordAction('regularization', id, r.current_step || 0, user, action === 'approve' ? 'APPROVED' : 'REJECTED', note || undefined);

    if (action === 'reject') {
      await execute("UPDATE attendance_regularizations SET status='Rejected', reviewed_by=?, reviewed_on=NOW(), review_note=? WHERE id=?", [user.email || String(user.id), note, id]);
      await auditFrom(user, 'attendance_request_rejected', 'attendance', r.emp_code, { type: r.request_type, date: r.d, note });
      if (emp) {
        createNotification(`${label} rejected`, `Your ${label.toLowerCase()} request for ${r.d} was rejected: ${note}`, 'regularization', id, false, String(emp.id));
        sendRequestMail({ kind, event: 'rejected', to: emp.email_id, vars, asUser: mailAs });
      }
      return jsonSuccess({ message: 'Rejected.' });
    }

    // Approved by the manager: move on to HR.
    const maxStep = r.workflow_id ? await getMaxStep(r.workflow_id) : 0;
    if (step && r.current_step < maxStep) {
      await execute('UPDATE attendance_regularizations SET current_step=?, review_note=? WHERE id=?', [r.current_step + 1, note || null, id]);
      const hr = await hrRecipients();
      if (hr.to) sendRequestMail({ kind, event: 'to_hr', to: hr.to, bcc: hr.bcc || undefined, vars: { ...vars, review_link: `${appUrl()}/attendance/corrections` }, asUser: mailAs });
      createNotification(`${label} needs HR approval`, `${vars.employee_name}'s ${label.toLowerCase()} request for ${r.d} was approved by the manager.`, 'regularization_request', id, true, null);
      if (emp) createNotification(`${label} update`, `Your ${label.toLowerCase()} request for ${r.d} was approved by your manager and sent to HR.`, 'regularization', id, false, String(emp.id));
      await auditFrom(user, 'attendance_request_manager_approved', 'attendance', r.emp_code, { type: r.request_type, date: r.d });
      return jsonSuccess({ message: 'Approved and sent to HR.' });
    }

    // Final approval.
    if (!late) {
      const hours = parseFloat(calcHours(r.in_time, r.out_time)) || 0;
      const { status } = await resolveAttendanceStatus({
        rawStatus: '', inTime: r.in_time, outTime: r.out_time, hours, threshold: await getHalfDayThreshold(),
        isHoliday: await isHoliday(r.d), date: r.d,
      });
      const day = DAYS[new Date(r.d + 'T00:00:00Z').getUTCDay()];
      const remark = `Manual entry - attendance correction approved by ${user.email}`;
      const ex = await query<RowDataPacket[]>('SELECT id FROM attendance WHERE emp_code = ? AND attendance_date = ?', [r.emp_code, r.d]);
      if (ex.length > 0) {
        await execute('UPDATE attendance SET in_time=?, out_time=?, working_hours=?, status=?, remark=?, is_status=1 WHERE id=?', [r.in_time, r.out_time, hours, status, remark, ex[0].id]);
      } else {
        await execute(
          'INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, in_time, out_time, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)',
          [uuidv4(), r.emp_code, emp?.full_name || null, null, r.d, day, r.in_time, r.out_time, hours, status, remark, user.email]
        );
      }
      const [yy, mm] = r.d.split('-').map(Number);
      await recalcAttendanceSummary(r.emp_code, mm, yy);
    }

    await execute("UPDATE attendance_regularizations SET status='Approved', reviewed_by=?, reviewed_on=NOW(), review_note=? WHERE id=?", [user.email || String(user.id), note || null, id]);
    await auditFrom(user, late ? 'late_coming_approved' : 'attendance_correction_approved', 'attendance', r.emp_code, { date: r.d, in: r.in_time, out: r.out_time, note });
    if (emp) {
      createNotification(
        `${label} approved`,
        late ? `Your late coming on ${r.d} was approved.` : `Your attendance for ${r.d} was corrected (${r.in_time} - ${r.out_time}).`,
        'regularization', id, false, String(emp.id)
      );
      sendRequestMail({ kind, event: 'approved', to: emp.email_id, vars, asUser: mailAs });
    }
    return jsonSuccess({ message: late ? 'Approved.' : 'Approved - attendance corrected.' });
  } catch (e: any) { return jsonError(e, 500); }
}

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

// The employee changes their own missed-punch / late-coming request while nobody has acted on it yet.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM attendance_regularizations WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Request not found', 404);
    const r = rows[0];
    if (r.emp_code !== user.emp_code) return jsonError('Not authorized to change this request', 403);
    if (r.status !== 'Pending') return jsonError('Only a pending request can be changed', 409);
    if (await requestHasActions('regularization', id)) return jsonError('This request was already reviewed, so it cannot be changed now', 409);

    const b = await req.json();
    const late = r.request_type === 'Late coming';
    const date = String(b.attendance_date || '').slice(0, 10), inTime = String(b.in_time || '').trim(), outTime = String(b.out_time || '').trim(), reason = String(b.reason || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError('Pick the date', 422);
    if (late ? !HHMM.test(inTime) : (!HHMM.test(inTime) || !HHMM.test(outTime))) return jsonError(late ? 'Enter the time you arrived (HH:MM)' : 'Enter both the in time and the out time (HH:MM)', 422);
    if (reason.length < 5) return jsonError('Please give a reason (at least a few words)', 422);
    const d = new Date(date + 'T00:00:00'); const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime()) || d > today) return jsonError('You cannot raise a request for a future date', 422);
    const oldest = new Date(today); oldest.setDate(oldest.getDate() - 45);
    if (d < oldest) return jsonError('Requests are only accepted for the last 45 days. Please contact HR.', 422);
    const dup = await query<RowDataPacket[]>("SELECT id FROM attendance_regularizations WHERE emp_code = ? AND attendance_date = ? AND request_type = ? AND status = 'Pending' AND id <> ?", [r.emp_code, date, r.request_type, id]);
    if (dup.length > 0) return jsonError('You already have a pending request of this kind for this date', 409);

    await execute('UPDATE attendance_regularizations SET attendance_date=?, in_time=?, out_time=?, reason=? WHERE id=?', [date, inTime, late ? null : outTime, reason, id]);
    const who = (await query<RowDataPacket[]>('SELECT full_name FROM employees WHERE id = ?', [user.id]))[0]?.full_name || user.emp_code;
    await mailApproverOfUpdate({
      kind: late ? 'late_coming' : 'missed_punch', workflowId: r.workflow_id, currentStep: r.current_step, employeeId: String(user.id), asUser: { id: user.id, type: user.type },
      vars: { employee_name: who, emp_code: user.emp_code, request_type: r.request_type, date, in_time: inTime, out_time: late ? '' : outTime, reason },
      category: 'regularization', refId: String(id), title: `${r.request_type} request changed`,
      text: `${who} changed a ${r.request_type.toLowerCase()} request for ${date}.`,
      hrLink: `${appUrl()}/attendance/corrections`, managerLink: `${appUrl()}/`,
    });
    await auditFrom(user, 'attendance_request_edited', 'attendance', r.emp_code, { type: r.request_type, date });
    return jsonSuccess({ message: 'Request updated' });
  } catch (e: any) { return jsonError(e, 500); }
}
