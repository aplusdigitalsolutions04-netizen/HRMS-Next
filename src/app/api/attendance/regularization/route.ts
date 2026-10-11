// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, parsePagination, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { initApproval, getStep, ensureManagerHrWorkflow } from '@/lib/approvalEngine';
import { sendRequestMail, hrRecipients, managerOf, appUrl, realEmail, canSendAs } from '@/lib/request-mail';

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

// Attendance requests: "I forgot to punch" (missed punch) and "I came late" (late coming).
// Each goes to the reporting manager first, then to HR (HR directly when the employee has no manager).
//   employee  GET  -> own requests          POST -> raise a request
//   manager   GET ?team=1 -> requests of the direct reports that wait for the manager
//   HR        GET  -> everybody's requests (status / search / page)
const SELECT_STEP = `LEFT JOIN approval_workflow_steps ws ON ws.workflow_id = r.workflow_id AND ws.step_order = r.current_step`;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const { page, perPage, offset } = parsePagination(searchParams, 20);

    if (user.type === 'employee') {
      if (searchParams.get('team')) {
        const rows = await query<RowDataPacket[]>(
          `SELECT r.id, r.emp_code, e.full_name AS employee_name, DATE_FORMAT(r.attendance_date, '%Y-%m-%d') AS attendance_date, r.in_time, r.out_time, r.request_type, r.reason, r.status, r.applied_on
           FROM attendance_regularizations r JOIN employees e ON e.emp_code = r.emp_code ${SELECT_STEP}
           WHERE e.manager_id = ? AND r.status = 'Pending' AND ws.approver_type = 'MANAGER' ORDER BY r.applied_on DESC`, [user.id]);
        return jsonSuccess({ requests: rows });
      }
      const rows = await query<RowDataPacket[]>(
        `SELECT r.id, DATE_FORMAT(r.attendance_date, '%Y-%m-%d') AS attendance_date, r.in_time, r.out_time, r.request_type, r.reason, r.status, r.applied_on, r.reviewed_by, r.reviewed_on, r.review_note,
                ws.approver_type AS awaiting,
                (NOT EXISTS (SELECT 1 FROM approval_actions aa WHERE aa.request_type='regularization' AND aa.request_id = r.id) AND r.status = 'Pending') AS can_edit
         FROM attendance_regularizations r ${SELECT_STEP} WHERE r.emp_code = ? ORDER BY r.applied_on DESC LIMIT 100`, [user.emp_code]);
      return jsonSuccess({ requests: rows });
    }

    if (!(checkPermission(user, 'approve_regularization') || checkPermission(user, 'view_attendance'))) return jsonError('Insufficient permissions', 403);
    let where = 'WHERE 1=1'; const params: any[] = [];
    if (status) { where += ' AND r.status = ?'; params.push(status); }
    const search = (searchParams.get('search') || '').trim();
    if (search) { where += ' AND (e.full_name LIKE ? OR r.emp_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM attendance_regularizations r LEFT JOIN employees e ON e.emp_code = r.emp_code ${where}`, params);
    const rows = await query<RowDataPacket[]>(
      `SELECT r.id, r.emp_code, e.full_name AS employee_name, DATE_FORMAT(r.attendance_date, '%Y-%m-%d') AS attendance_date, r.in_time, r.out_time, r.request_type, r.reason, r.status,
              r.applied_on, r.reviewed_by, r.reviewed_on, r.review_note, ws.approver_type AS awaiting, m.full_name AS manager_name,
              a.in_time AS cur_in, a.out_time AS cur_out, a.status AS cur_status
       FROM attendance_regularizations r
       LEFT JOIN employees e ON e.emp_code = r.emp_code
       LEFT JOIN employees m ON m.id = e.manager_id
       ${SELECT_STEP}
       LEFT JOIN attendance a ON a.emp_code = r.emp_code AND a.attendance_date = r.attendance_date
       ${where} ORDER BY (r.status = 'Pending') DESC, r.applied_on DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    const counts = await query<RowDataPacket[]>('SELECT status, COUNT(*) AS n FROM attendance_regularizations GROUP BY status');
    const by: Record<string, number> = {};
    counts.forEach(c => { by[c.status] = Number(c.n); });
    return jsonSuccess({ requests: rows, total: cnt[0].n, page, per_page: perPage, counts: by });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'employee') return jsonError('Only an employee can raise this request', 403);

    const body = await req.json();
    const late = body.request_type === 'Late coming' || body.request_type === 'late_coming';
    const date = String(body.attendance_date || '');
    const inTime = String(body.in_time || '').trim();
    const outTime = String(body.out_time || '').trim();
    const reason = String(body.reason || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError('Pick the date', 422);
    if (late) {
      if (!HHMM.test(inTime)) return jsonError('Enter the time you arrived (HH:MM)', 422);
    } else if (!HHMM.test(inTime) || !HHMM.test(outTime)) return jsonError('Enter both the in time and the out time (HH:MM)', 422);
    if (reason.length < 5) return jsonError('Please give a reason (at least a few words)', 422);

    const d = new Date(date + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime()) || d > today) return jsonError('You cannot raise a request for a future date', 422);
    const oldest = new Date(today); oldest.setDate(oldest.getDate() - 45);
    if (d < oldest) return jsonError('Requests are only accepted for the last 45 days. Please contact HR.', 422);

    const type = late ? 'Late coming' : 'Missed punch';
    const dup = await query<RowDataPacket[]>("SELECT id FROM attendance_regularizations WHERE emp_code = ? AND attendance_date = ? AND request_type = ? AND status = 'Pending'", [user.emp_code, date, type]);
    if (dup.length > 0) return jsonError('You already have a pending request of this kind for this date', 409);

    const id = uuidv4();
    await execute(
      'INSERT INTO attendance_regularizations (id, emp_code, attendance_date, in_time, out_time, request_type, reason, status, applied_on) VALUES (?,?,?,?,?,?,?,?,NOW())',
      [id, user.emp_code, date, inTime, late ? null : outTime, type, reason, 'Pending']
    );

    // Reporting manager first, then HR (same approval engine as leave and WFH).
    await ensureManagerHrWorkflow('regularization', 'Attendance Request Approval');
    const { workflowId, startStep } = await initApproval('regularization', String(user.id));
    if (workflowId) await execute('UPDATE attendance_regularizations SET workflow_id=?, current_step=? WHERE id=?', [workflowId, startStep, id]);
    const firstStep = workflowId ? await getStep(workflowId, startStep) : null;

    const who = (await query<RowDataPacket[]>('SELECT full_name FROM employees WHERE id = ?', [user.id]))[0]?.full_name || user.emp_code;
    const kind = late ? 'late_coming' : 'missed_punch';
    const vars = { employee_name: who, emp_code: user.emp_code, request_type: type, date, in_time: inTime, out_time: late ? '' : outTime, reason };
    const title = late ? 'Late coming request' : 'Attendance correction request';
    const text = late ? `${who} reported late coming on ${date} (arrived ${inTime}): ${reason}` : `${who} asked to correct attendance for ${date} (${inTime} - ${outTime}).`;

    let sentTo = 'HR';
    if (firstStep && firstStep.approver_type === 'MANAGER') {
      const mgr = await managerOf(String(user.id));
      if (mgr) {
        sentTo = 'your reporting manager';
        sendRequestMail({ kind, event: 'submitted', to: mgr.email_id, replyTo: realEmail(user.email), vars: { ...vars, manager_name: mgr.full_name, review_link: `${appUrl()}/` }, asUser: { id: user.id, type: user.type } });
        createNotification(title, text + ' It needs your approval.', 'regularization', id, false, String(mgr.id));
      }
    }
    if (sentTo === 'HR') {
      const hr = await hrRecipients(user.email || '');
      if (hr.to) sendRequestMail({ kind, event: 'submitted', to: hr.to, bcc: hr.bcc || undefined, vars: { ...vars, review_link: `${appUrl()}/attendance/corrections` }, asUser: { id: user.id, type: user.type } });
      createNotification(title, text, 'regularization_request', id, true, null);
    }
    const mailSent = await canSendAs({ id: user.id, type: user.type });
    return jsonSuccess({ id, message: `Request sent to ${sentTo}.` + (mailSent ? '' : ' No email was sent because your email is not connected (My Mail).'), mail_sent: mailSent }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}
