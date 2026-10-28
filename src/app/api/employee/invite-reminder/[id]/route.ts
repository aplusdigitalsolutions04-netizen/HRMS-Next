// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { fillEmployeeTemplate, buildCompanyLogoEmail } from '@/lib/emailTemplates';
import { parseRequiredDocs, requiredDocsHtml } from '@/lib/documents';
import { sendEmailDetailed } from '@/lib/email';
import { ensureInviteReminderTemplate, INVITE_REMINDER_TEMPLATE } from '@/lib/masters';
import { auditFrom } from '@/lib/audit';
import { hasBlockHtml, plainToHtml } from '@/lib/mail-format';

// A reminder to an employee who was invited but has not completed the profile yet.
// The wording comes from the "Invite Reminder" template (Settings > Template Management), nothing is typed in here.
// Only a reminder: the password is not touched and is not put in the mail (the employee already has the login from the invite).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code, email_id, status, required_documents, reminder_count FROM employees WHERE id = ? AND COALESCE(is_deleted,0) = 0', [id]))[0];
    if (!emp) return jsonError('Employee not found', 404);
    if (emp.status !== 'invited') return jsonError('A reminder can only be sent while the invite is still pending', 409);
    if (!emp.email_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emp.email_id)) return jsonError('This employee has no valid email address', 422);

    await ensureInviteReminderTemplate();
    const tpl = (await query<RowDataPacket[]>('SELECT subject, body FROM email_templates WHERE name = ? LIMIT 1', [INVITE_REMINDER_TEMPLATE]))[0];
    if (!tpl) return jsonError(`No "${INVITE_REMINDER_TEMPLATE}" email template found. Create it in Settings -> Email Templates first.`, 422);

    const company = (await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1'))[0] || {};
    const companyName = company.company_name || 'our company';
    const { html: logoHtml, attachment: logoAtt } = buildCompanyLogoEmail(company.company_logo, companyName);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const vars = { fullName: emp.full_name, email: emp.email_id, empCode: emp.emp_code, loginUrl: `${appUrl}/login`, companyLogo: logoHtml, companyName };
    const subject = fillEmployeeTemplate(tpl.subject || '', vars);
    // a template written in plain words (no HTML) becomes real paragraphs; the compulsory-documents box is HTML added under it
    const filled = fillEmployeeTemplate(tpl.body || '', vars);
    const text = hasBlockHtml(filled) ? filled : plainToHtml(filled);
    const html = text + requiredDocsHtml(parseRequiredDocs(emp.required_documents));

    const r = await sendEmailDetailed(emp.email_id, subject, html, { attachments: logoAtt ? [logoAtt] : undefined, asUser: { id: user.id, type: user.type } });
    const t = now();
    await execute(
      `INSERT INTO email_logs (id, candidate_id, candidate_name, template_name, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuidv4(), null, emp.full_name, INVITE_REMINDER_TEMPLATE, emp.email_id, subject, html, '', '', JSON.stringify(logoAtt ? [logoAtt] : []), r.success ? 'sent' : 'failed', user.email, t]
    ).catch(() => {});
    if (!r.success) return jsonError(`The reminder was not sent: ${r.error || 'unknown error'}.`, 502);

    await execute('UPDATE employees SET reminder_count = COALESCE(reminder_count,0) + 1, last_reminder_on = NOW() WHERE id = ?', [id]);
    await auditFrom(user, 'invite_reminder_sent', 'employee', id, { emp_code: emp.emp_code, email: emp.email_id, count: Number(emp.reminder_count || 0) + 1 });
    return jsonSuccess({ message: `Reminder sent to ${emp.email_id}`, reminder_count: Number(emp.reminder_count || 0) + 1 });
  } catch (e: any) { return jsonError(e, 500); }
}
