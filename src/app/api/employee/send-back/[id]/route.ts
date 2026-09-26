// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword, generateTempPassword } from '@/lib/auth';
import { buildCompanyLogoEmail } from '@/lib/emailTemplates';
import { sendDraftById } from '@/lib/draft-send';

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// HR reviewing a 'pending' submission can send it back to the employee with
// a reason instead of only approve/drop - the employee logs back in, sees
// the reason, edits, and resubmits through the same complete-profile
// endpoint (which lands back in 'pending').
//
// The employee is also emailed the reason together with their login details
// and a freshly generated password, so they don't have to be told separately.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const body = await req.json();
    const remarks = (body.remarks || '').trim();
    if (!remarks) return jsonError('Please explain what needs to be corrected', 422);

    const existing = await query<RowDataPacket[]>('SELECT full_name, emp_code, email_id, status FROM employees WHERE id = ?', [id]);
    if (existing.length === 0) return jsonError('Employee not found', 404);
    const emp = existing[0];
    if (emp.status !== 'pending') return jsonError('Only a pending submission can be sent back', 400);

    // New password: the old one is replaced so the email always carries working
    // login details. must_change_password makes them pick their own at login.
    const tempPassword = generateTempPassword();
    await execute(
      'UPDATE employees SET status = ?, hr_remarks = ?, password = ?, must_change_password = 1 WHERE id = ?',
      ['needs_correction', remarks, hashPassword(tempPassword), id]
    );

    const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1');
    const companyName = companyRows[0]?.company_name || 'our company';
    const { html: logoHtml, attachment: logoAttachment } = buildCompanyLogoEmail(companyRows[0]?.company_logo, companyName);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const loginUrl = `${appUrl}/login`;

    const subject = `Action needed: please correct your details - ${companyName}`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.6">
        ${logoHtml}
        <p>Hello ${esc(emp.full_name || 'there')},</p>
        <p>HR has reviewed the details you submitted and needs you to correct something before your account can be activated.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:16px 0">
          <div style="font-weight:700;color:#991b1b;margin-bottom:6px">Reason</div>
          <div style="white-space:pre-wrap">${esc(remarks)}</div>
        </div>
        <p>Please log in, fix the above and submit your details again. Your login details:</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin:16px 0">
          <div><strong>Login page:</strong> <a href="${loginUrl}">${loginUrl}</a></div>
          <div><strong>Email:</strong> ${esc(emp.email_id)}</div>
          <div><strong>New password:</strong> ${esc(tempPassword)}</div>
        </div>
        <p style="color:#64748b;font-size:13px">Your password has been reset. You will be asked to set a new one when you log in.</p>
        <p>Regards,<br/>${esc(companyName)}</p>
      </div>`;

    const t = now();
    const draftId = uuidv4();
    const attachmentsJson = JSON.stringify(logoAttachment ? [logoAttachment] : []);
    await execute(
      `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, template_name, candidate_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`,
      [draftId, null, emp.email_id, subject, html, '', '', attachmentsJson, user.email, t, t, 'Correction Request', emp.full_name]
    ).catch(async () => {
      await execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        [draftId, null, emp.email_id, subject, html, '', '', attachmentsJson, user.email, t, t]
      );
    });
    await execute(
      `INSERT INTO employee_credentials (id, employee_id, employee_name, emp_code, email, password, status, draft_id, created_by, created_at) VALUES (?,?,?,?,?,?,'draft',?,?,?)`,
      [uuidv4(), id, emp.full_name || '', emp.emp_code || '', emp.email_id, tempPassword, draftId, user.email, t]
    );

    // If sending fails the employee is still sent back (they will see the
    // reason on login) and the email waits as a draft to be re-sent.
    let emailSent = false;
    let emailError;
    try {
      const r = await sendDraftById(draftId, user);
      emailSent = r.success;
      emailError = r.error;
    } catch (e) {
      emailError = e?.message || 'Could not send the email';
    }

    return jsonSuccess({
      message: 'Sent back to the employee for correction',
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
