// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';
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
    
    const emp = await query<RowDataPacket[]>('SELECT id, full_name, emp_code FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    
    const f = new Date(body.start_date);
    const t = new Date(body.end_date);
    const diff = Math.max(1, Math.ceil((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const duration = parseFloat(body.duration) || diff;
    
    const insertResult = await execute(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, duration, reason, supporting_doc, status, applied_on) VALUES (?,?,?,?,?,?,?,'Pending',NOW())`,
      [emp[0].id, body.leave_type, body.start_date, body.end_date, duration, body.reason || '', body.supporting_doc || '']
    );
    const leaveId = insertResult.insertId;

    // Resolve the approval workflow - starts at the reporting manager if the
    // employee has one, otherwise skips straight to HR.
    const { workflowId, startStep } = await initApproval('leave', emp[0].id);
    if (workflowId) {
      await execute('UPDATE leave_requests SET workflow_id=?, current_step=? WHERE id=?', [workflowId, startStep, leaveId]);
    }
    const firstStep = workflowId ? await getStep(workflowId, startStep) : null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;

    if (firstStep && firstStep.approver_type === 'MANAGER') {
      // Route to the reporting manager only - HR does not see this yet.
      const managerRows = await query<RowDataPacket[]>(
        'SELECT m.id, m.email_id, m.full_name FROM employees e JOIN employees m ON e.manager_id = m.id WHERE e.id=?',
        [emp[0].id]
      );
      const manager = managerRows[0];
      if (manager) {
        sendEmail(
          manager.email_id,
          `Leave Request Awaiting Your Approval: ${body.leave_type} — ${emp[0].full_name || emp[0].emp_code}`,
          `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#0f172a">Leave Request Awaiting Your Approval</h2>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Employee</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${emp[0].full_name || emp[0].emp_code} (${emp[0].emp_code})</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Leave Type</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${body.leave_type}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Start Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${body.start_date}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">End Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${body.end_date}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Duration</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${duration} day(s)</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Reason</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f172a">${body.reason || '—'}</td></tr>
            </table>
            <p style="margin-top:20px"><a href="${appUrl}/employee-leave/team" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Review Request</a></p>
          </div>
          `,
          { asUser: { id: user.id, type: user.type } }
        );
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
      // No manager in the chain (or workflow starts at HR) - notify HR as before.
      const hrAdmins = await query<RowDataPacket[]>('SELECT DISTINCT email FROM hr_admins WHERE email IS NOT NULL AND is_active = 1 AND email != ?', [user.email || '']);
      const smtpRow = await query<RowDataPacket[]>('SELECT default_cc_emails, default_bcc_emails FROM smtp_settings LIMIT 1');
      const defaultCc = smtpRow.length > 0 ? (smtpRow[0].default_cc_emails || '') : '';
      const defaultBcc = smtpRow.length > 0 ? (smtpRow[0].default_bcc_emails || '') : '';
      const defaultCcList = defaultCc.split(',').map(s => s.trim()).filter(Boolean);
      const defaultBccList = defaultBcc.split(',').map(s => s.trim()).filter(Boolean);
      const hrEmails = [...new Set([...hrAdmins.map(r => r.email).filter(Boolean), ...defaultCcList])];

      if (hrEmails.length > 0) {
        const allBcc = [...defaultBccList, body.bcc || ''].filter(Boolean);
        sendEmail(
          hrEmails.join(','),
          `Leave Request: ${body.leave_type} — ${emp[0].full_name || emp[0].emp_code}`,
          `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#0f172a">Leave Request Received</h2>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Employee</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${emp[0].full_name || emp[0].emp_code} (${emp[0].emp_code})</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Leave Type</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${body.leave_type}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Start Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${body.start_date}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">End Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${body.end_date}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Duration</td><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;color:#0f172a">${duration} day(s)</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">Reason</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f172a">${body.reason || '—'}</td></tr>
            </table>
            <p style="margin-top:20px"><a href="${appUrl}/leave/admin/requests" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View in HRMS</a></p>
          </div>
          `,
          { cc: body.cc || undefined, bcc: allBcc.join(',') || undefined, asUser: { id: user.id, type: user.type } }
        );
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

    return jsonSuccess({ success: true, message: 'Leave applied' }, 201);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
