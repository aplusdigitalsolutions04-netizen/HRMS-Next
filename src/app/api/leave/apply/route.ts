// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { activeLeaveTypes } from '@/lib/masters';
import { getAccount } from '@/lib/mailbox';
import { checkLeaveDoc, saveLeaveDoc } from '@/lib/leave-docs';
import { sendRequestMail, hrRecipients, managerOf, appUrl, realEmail, canSendAs, parseAddressList } from '@/lib/request-mail';
import { initApproval, getStep } from '@/lib/approvalEngine';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    
    let body;
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await req.json();
    } else {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    }
    
    if (!body.leave_type || !body.start_date || !body.end_date) {
      return jsonError('Leave type, start date, and end date required', 422);
    }
    
    if (!(await activeLeaveTypes()).includes(String(body.leave_type))) return jsonError('Please pick a leave type from the list', 422);

    // the attached supporting document (optional): checked before anything is saved
    const docFile = body.supporting_doc && typeof body.supporting_doc !== 'string' && body.supporting_doc.size > 0 ? body.supporting_doc : null;
    if (docFile) { const bad = checkLeaveDoc(docFile); if (bad) return jsonError(bad, 422); }

    // Cc / Bcc: several addresses are fine; every one must be a real address
    const ccP = parseAddressList(body.cc), bccP = parseAddressList(body.bcc);
    if (ccP.bad) return jsonError(`"${ccP.bad}" in Email CC is not a valid email address`, 422);
    if (bccP.bad) return jsonError(`"${bccP.bad}" in Email BCC is not a valid email address`, 422);
    const ccList = ccP.list.join(','), bccList = bccP.list.join(',');
    // the connected email the employee chose to send from (their default one if none was chosen)
    const chosen = body.from_account_id ? await getAccount(user, String(body.from_account_id)) : null;
    if (body.from_account_id && !chosen) return jsonError('That email is not connected to your account', 422);
    const sendAs = { id: user.id, type: user.type, accountId: chosen ? String(chosen.id) : undefined };

    const emp = await query<RowDataPacket[]>('SELECT id, full_name, emp_code FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    
    const f = new Date(body.start_date);
    const t = new Date(body.end_date);
    const diff = Math.max(1, Math.ceil((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const duration = parseFloat(body.duration) || diff;
    
    const insertResult = await execute(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, duration, reason, supporting_doc, status, applied_on) VALUES (?,?,?,?,?,?,?,'Pending',NOW())`,
      [emp[0].id, body.leave_type, body.start_date, body.end_date, duration, body.reason || '', docFile ? await saveLeaveDoc(docFile) : '']
    );
    const leaveId = insertResult.insertId;

    // Resolve the approval workflow - starts at the reporting manager if the
    // employee has one, otherwise skips straight to HR.
    const { workflowId, startStep } = await initApproval('leave', emp[0].id);
    if (workflowId) {
      await execute('UPDATE leave_requests SET workflow_id=?, current_step=? WHERE id=?', [workflowId, startStep, leaveId]);
    }
    const firstStep = workflowId ? await getStep(workflowId, startStep) : null;
    const vars = {
      employee_name: emp[0].full_name || emp[0].emp_code, emp_code: emp[0].emp_code, request_type: body.leave_type,
      from_date: body.start_date, to_date: body.end_date, duration: duration, reason: body.reason || '-',
      message: String(body.mail_message || '').slice(0, 4000),
    };
    const mailSubject = String(body.mail_subject || '').trim().slice(0, 150) || undefined;

    if (firstStep && firstStep.approver_type === 'MANAGER') {
      // Route to the reporting manager only - HR does not see this yet.
      const manager = await managerOf(emp[0].id);
      if (manager) {
        sendRequestMail({
          kind: 'leave', event: 'submitted', to: manager.email_id, subject: mailSubject, replyTo: realEmail(user.email), cc: ccList || undefined, bcc: bccList || undefined,
          vars: { ...vars, manager_name: manager.full_name, review_link: `${appUrl()}/employee-leave/team` },
          asUser: sendAs,
        });
        createNotification(
          `Leave Approval Needed: ${body.leave_type}`,
          `${emp[0].full_name || emp[0].emp_code} applied for ${body.leave_type} (${body.start_date} to ${body.end_date}) and needs your approval.`,
          'leave_apply',
          leaveId ? String(leaveId) : null,
          false,
          String(manager.id)
        );
      }
    } else {
      // No manager in the chain (or workflow starts at HR) - mail HR.
      const hr = await hrRecipients(user.email || '');
      if (hr.to) {
        sendRequestMail({
          kind: 'leave', event: 'submitted', to: hr.to, subject: mailSubject, replyTo: realEmail(user.email),
          vars: { ...vars, review_link: `${appUrl()}/leave/admin/requests` },
          cc: ccList || undefined, bcc: [hr.bcc, bccList].filter(Boolean).join(',') || undefined,
          asUser: sendAs,
        });
      }

      createNotification(
        `Leave Request: ${body.leave_type}`,
        `${emp[0].full_name || emp[0].emp_code} applied for ${body.leave_type} (${body.start_date} to ${body.end_date})`,
        'leave_apply',
        leaveId ? String(leaveId) : null,
        true,
        null
      );
    }

    return jsonSuccess({ success: true, message: 'Leave applied', mail_sent: await canSendAs({ id: user.id, type: user.type }) }, 201);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
