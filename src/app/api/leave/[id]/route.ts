// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { requestHasActions, mailApproverOfUpdate, appUrl } from '@/lib/request-mail';
import { logAudit } from '@/lib/audit';
import { activeLeaveTypes } from '@/lib/masters';

// The employee changes their own leave request (type, dates, reason) while nobody has acted on it yet.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Leave request not found', 404);
    const lr = rows[0];
    if (String(lr.employee_id) !== String(user.id)) return jsonError('Not authorized to change this leave request', 403);
    if ((lr.status || '').toLowerCase() !== 'pending') return jsonError('Only a pending request can be changed', 409);
    if (await requestHasActions('leave', id)) return jsonError('This request was already reviewed, so it cannot be changed now', 409);

    const b = await req.json();
    const type = String(b.leave_type || '').trim(), start = String(b.start_date || '').slice(0, 10), end = String(b.end_date || '').slice(0, 10), reason = String(b.reason || '').trim();
    if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return jsonError('Leave type, start date and end date required', 422);
    if (type !== lr.leave_type && !(await activeLeaveTypes()).includes(type)) return jsonError('Please pick a leave type from the list', 422);
    if (new Date(end) < new Date(start)) return jsonError('End date must not be before the start date', 422);
    if (!reason) return jsonError('Please enter a reason', 422);
    const duration = Math.max(1, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);

    await execute('UPDATE leave_requests SET leave_type=?, start_date=?, end_date=?, duration=?, reason=? WHERE id=?', [type, start, end, duration, reason, id]);
    const emp = (await query<RowDataPacket[]>('SELECT full_name, emp_code FROM employees WHERE id = ?', [user.id]))[0];
    await mailApproverOfUpdate({
      kind: 'leave', workflowId: lr.workflow_id, currentStep: lr.current_step, employeeId: String(user.id), asUser: { id: user.id, type: user.type },
      vars: { employee_name: emp?.full_name || user.name, emp_code: emp?.emp_code || '', request_type: type, from_date: start, to_date: end, duration, reason, message: String(b.mail_message || '').slice(0, 4000) },
      category: 'leave_apply', refId: String(id), title: `Leave request changed: ${type}`,
      text: `${emp?.full_name || user.name} changed a leave request (${start} to ${end}).`,
      hrLink: `${appUrl()}/leave/admin/requests`, managerLink: `${appUrl()}/employee-leave/team`,
    });
    await logAudit({ action: 'leave_request_edited', entity_type: 'leave_requests', entity_id: String(id), performed_by: String(user.id), performed_by_email: user.email, details: { type, start, end } });
    return jsonSuccess({ message: 'Leave request updated' });
  } catch (e: any) { return jsonError(e, 500); }
}
