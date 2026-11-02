// @ts-nocheck
import { NextRequest } from 'next/server';
import { encryptSecret } from '@/lib/mailbox';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword, generateTempPassword } from '@/lib/auth';
import { buildCompanyLogoEmail } from '@/lib/emailTemplates';
import { sendDraftById } from '@/lib/draft-send';
import { clearFailures } from '@/lib/login-guard';
import { auditFrom } from '@/lib/audit';

const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// HR/Admin sets a new password for any employee (forgotten password, locked out, ...). The password is either typed in or
// generated. The employee must choose their own at the next login, the old password stops working at once (the login token
// is tied to the password), and a login lock caused by wrong attempts is lifted. The new password can be mailed to them.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const typed = String(body.password || '').trim();
    if (typed && typed.length < 8) return jsonError('The password must be at least 8 characters', 422);
    if (typed.length > 64) return jsonError('The password is too long', 422);
    const sendEmail = body.send_email !== false;

    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code, email_id FROM employees WHERE id = ? AND is_deleted = 0', [id]))[0];
    if (!emp) return jsonError('Employee not found', 404);

    const password = typed || generateTempPassword();
    await execute('UPDATE employees SET password = ?, must_change_password = 1 WHERE id = ?', [hashPassword(password), id]);
    await clearFailures(emp.email_id).catch(() => {});

    const t = now();
    let draftId: string | null = null;
    let emailSent = false;
    let emailError: string | undefined;
    if (sendEmail) {
      const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1');
      const companyName = companyRows[0]?.company_name || 'our company';
      const { html: logoHtml, attachment: logoAttachment } = buildCompanyLogoEmail(companyRows[0]?.company_logo, companyName);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
      const loginUrl = `${appUrl}/login`;
      const subject = `Your password has been reset - ${companyName}`;
      const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;font-size:14px;line-height:1.6">
        ${logoHtml}
        <p>Hello ${esc(emp.full_name || 'there')},</p>
        <p>Your password has been reset by HR. Your login details:</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin:16px 0">
          <div><strong>Login page:</strong> <a href="${loginUrl}">${loginUrl}</a></div>
          <div><strong>Email:</strong> ${esc(emp.email_id)}</div>
          <div><strong>New password:</strong> ${esc(password)}</div>
        </div>
        <p style="color:#64748b;font-size:13px">You will be asked to set a new password when you log in.</p>
        <p>Regards,<br/>${esc(companyName)}</p>
      </div>`;
      draftId = uuidv4();
      const attachmentsJson = JSON.stringify(logoAttachment ? [logoAttachment] : []);
      await execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, template_name, candidate_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`,
        [draftId, null, emp.email_id, subject, html, '', '', attachmentsJson, user.email, t, t, 'Password Reset', emp.full_name]
      ).catch(async () => {
        await execute(
          `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
          [draftId, null, emp.email_id, subject, html, '', '', attachmentsJson, user.email, t, t]
        );
      });
    }
    // kept in Employee Credentials (encrypted) so HR can look it up there until the employee sets their own
    await execute(
      `INSERT INTO employee_credentials (id, employee_id, employee_name, emp_code, email, password, status, draft_id, created_by, created_at) VALUES (?,?,?,?,?,?,'draft',?,?,?)`,
      [uuidv4(), id, emp.full_name || '', emp.emp_code || '', emp.email_id, encryptSecret(password), draftId, user.email, t]
    );
    if (draftId) {
      try { const r = await sendDraftById(draftId, user); emailSent = r.success; emailError = r.error; }
      catch (e: any) { emailError = e?.message || 'Could not send the email'; }
    }
    await auditFrom(user, 'employee_password_reset', 'employee', String(id), { emp_code: emp.emp_code, emailed: emailSent, typed: !!typed });

    return jsonSuccess({
      message: sendEmail ? (emailSent ? `Password changed and mailed to ${emp.email_id}.` : 'Password changed, but the mail could not be sent.') : 'Password changed.',
      password, email_sent: emailSent, email_error: emailError,
    });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
