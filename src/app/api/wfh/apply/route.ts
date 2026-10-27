// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, createNotification } from '@/lib/utils';
import { execute } from '@/lib/db';
import { initApproval } from '@/lib/approvalEngine';
import { getAccount } from '@/lib/mailbox';
import { checkWfhRequest } from '@/lib/wfh';
import { sendRequestMail, hrRecipients, managerOf, appUrl, realEmail, canSendAs } from '@/lib/request-mail';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated as employee', 401);

    const body = await req.json();
    const chk = await checkWfhRequest(String(user.id), body);
    if (chk.error) return jsonError(chk.error, 422);
    const start_date = chk.start, end_date = chk.end, reason = chk.reason;

    // the connected email the employee chose to send from (their default one if none was chosen); checked before anything is saved
    const chosen = body.from_account_id ? await getAccount(user, String(body.from_account_id)) : null;
    if (body.from_account_id && !chosen) return jsonError('That email is not connected to your account', 422);

    // Initialize workflow (wfh)
    const { workflowId, startStep } = await initApproval('wfh', String(user.id));
    const requestId = uuidv4();

    await execute(
      'INSERT INTO wfh_requests (id, employee_id, start_date, end_date, reason, status, workflow_id, current_step, applied_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [requestId, user.id, start_date, end_date, reason, 'Pending', workflowId, startStep]
    );

    // Notify manager if any
    if (workflowId && startStep === 1) {
      // Find the manager
      const { query } = await import('@/lib/db');
      const managerRow = await query('SELECT manager_id FROM employees WHERE id=?', [user.id]);
      const managerId = managerRow[0]?.manager_id;
      if (managerId) {
        createNotification(
          `New WFH Request: ${user.name}`,
          `${user.name} has applied for WFH from ${start_date} to ${end_date}.`,
          'wfh_apply',
          String(requestId),
          false,
          String(managerId)
        );
      }
    } else if (workflowId && startStep > 1) {
       // Direct to HR if no manager
       createNotification(
        `New WFH Request (No Manager): ${user.name}`,
        `${user.name} applied for WFH. It needs HR approval.`,
        'wfh_apply',
        String(requestId),
        true,
        null
      );
    }

    // Mail: the reporting manager first; HR directly when the employee has no manager.
    const mailVars = { employee_name: user.name, emp_code: user.emp_code || '', request_type: 'Work From Home', from_date: String(start_date).slice(0, 10), to_date: String(end_date).slice(0, 10), reason, message: String(body.mail_message || '').slice(0, 4000) };
    const mailSubject = String(body.mail_subject || '').trim().slice(0, 150) || undefined;
    const sendAs = { id: user.id, type: user.type, accountId: chosen ? String(chosen.id) : undefined };
    const mgr = await managerOf(String(user.id));
    if (workflowId && startStep === 1 && mgr) {
      sendRequestMail({ kind: 'wfh', event: 'submitted', to: mgr.email_id, subject: mailSubject, replyTo: realEmail(user.email), vars: { ...mailVars, manager_name: mgr.full_name, review_link: `${appUrl()}/wfh` }, asUser: sendAs });
    } else {
      const hr = await hrRecipients(user.email || '');
      if (hr.to) sendRequestMail({ kind: 'wfh', event: 'submitted', to: hr.to, subject: mailSubject, replyTo: realEmail(user.email), bcc: hr.bcc || undefined, vars: { ...mailVars, review_link: `${appUrl()}/wfh/manage` }, asUser: sendAs });
    }

    return jsonSuccess({ message: 'WFH applied successfully', id: requestId, mail_sent: await canSendAs({ id: user.id, type: user.type }) });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
