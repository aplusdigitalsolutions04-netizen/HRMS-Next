// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { requestHasActions, mailApproverOfUpdate, appUrl } from '@/lib/request-mail';
import { checkWfhRequest } from '@/lib/wfh';
import { logAudit } from '@/lib/audit';

// The employee changes their own WFH request (dates, reason) while nobody has acted on it yet.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM wfh_requests WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('WFH request not found', 404);
    const wr = rows[0];
    if (String(wr.employee_id) !== String(user.id)) return jsonError('Not authorized to change this request', 403);
    if ((wr.status || '').toLowerCase() !== 'pending') return jsonError('Only a pending request can be changed', 409);
    if (await requestHasActions('wfh', id)) return jsonError('This request was already reviewed, so it cannot be changed now', 409);

    const b = await req.json();
    const chk = await checkWfhRequest(String(user.id), b, String(id));
    if (chk.error) return jsonError(chk.error, 422);
    const start = chk.start, end = chk.end, reason = chk.reason;

    await execute('UPDATE wfh_requests SET start_date=?, end_date=?, reason=? WHERE id=?', [start, end, reason, id]);
    await mailApproverOfUpdate({
      kind: 'wfh', workflowId: wr.workflow_id, currentStep: wr.current_step, employeeId: String(user.id), asUser: { id: user.id, type: user.type },
      vars: { employee_name: user.name, emp_code: user.emp_code || '', request_type: 'Work From Home', from_date: start, to_date: end, reason, message: String(b.mail_message || '').slice(0, 4000) },
      category: 'wfh_apply', refId: String(id), title: `WFH request changed: ${user.name}`,
      text: `${user.name} changed a WFH request (${start} to ${end}).`,
      hrLink: `${appUrl()}/wfh/manage`, managerLink: `${appUrl()}/wfh`,
    });
    await logAudit({ action: 'wfh_request_edited', entity_type: 'wfh_requests', entity_id: String(id), performed_by: String(user.id), performed_by_email: user.email, details: { start, end } });
    return jsonSuccess({ message: 'WFH request updated' });
  } catch (e: any) { return jsonError(e, 500); }
}
