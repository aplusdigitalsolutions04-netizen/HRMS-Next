// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { fillEmployeeTemplate, buildCompanyLogoEmail } from '@/lib/emailTemplates';
import { sendDraftById } from '@/lib/draft-send';
import { cleanRequiredDocs, requiredDocsHtml } from '@/lib/documents';
import { auditFrom } from '@/lib/audit';

// Resend the login details of an employee.
// - Still on the temporary password: the saved mail goes out again (that password still works).
// - Already chose their own password: the old mail would show a temporary password that no longer works, so a fresh mail is made
//   from the same template with "the password you set yourself" in its place, and nothing is changed on the account.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const cred = (await query<RowDataPacket[]>('SELECT * FROM employee_credentials WHERE id = ?', [id]))[0];
    if (!cred) return jsonError('Record not found', 404);
    const emp = (await query<RowDataPacket[]>(
      'SELECT full_name, emp_code, email_id, status, must_change_password, required_documents, official_email, official_no FROM employees WHERE id = ? AND is_deleted = 0',
      [cred.employee_id]
    ))[0];

    if (!emp || emp.must_change_password) {
      if (!cred.draft_id) return jsonError('There is no saved mail to send again', 404);
      const r = await sendDraftById(cred.draft_id, user);
      if (!r.found) return jsonError('The saved mail was not found', 404);
      if (!r.success) return jsonError(r.error || 'Could not send the mail', 502);
      await auditFrom(user, 'credentials_resent', 'employee', String(cred.employee_id), { emp_code: cred.emp_code, with_password: true });
      return jsonSuccess({ message: `Login details sent to ${cred.email}.`, own_password: false });
    }

    const oldDraft = cred.draft_id ? (await query<RowDataPacket[]>('SELECT template_name FROM email_drafts WHERE id = ?', [cred.draft_id]).catch(() => []))[0] : null;
    const templateName = oldDraft?.template_name || 'Employee Invite';
    const tmpl = (await query<RowDataPacket[]>('SELECT name, subject, body FROM email_templates WHERE name = ? LIMIT 1', [templateName]))[0];
    if (!tmpl) return jsonError(`No "${templateName}" email template found. Create it in Settings -> Email Templates.`, 422);

    const company = (await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1'))[0];
    const companyName = company?.company_name || '';
    const { html: companyLogo, attachment: logoAttachment } = buildCompanyLogoEmail(company?.company_logo, companyName);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const vars = {
      fullName: emp.full_name, email: emp.email_id, password: 'the password you set yourself', empCode: emp.emp_code,
      loginUrl: `<a href="${appUrl}/login">${appUrl}/login</a>`, officialEmail: emp.official_email, officialNo: emp.official_no,
      companyLogo, companyName,
    };
    let docs = [];
    try { docs = emp.status === 'invited' && emp.required_documents ? cleanRequiredDocs(JSON.parse(emp.required_documents)) : []; } catch { docs = []; }
    const subject = fillEmployeeTemplate(tmpl.subject || '', vars);
    const htmlBody = fillEmployeeTemplate(tmpl.body || '', vars) + requiredDocsHtml(docs);
    const attachmentsJson = JSON.stringify(logoAttachment ? [logoAttachment] : []);

    const draftId = uuidv4();
    const t = now();
    await execute(
      `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, template_name, candidate_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`,
      [draftId, null, emp.email_id, subject, htmlBody, '', '', attachmentsJson, user.email, t, t, tmpl.name, emp.full_name]
    ).catch(async () => {
      await execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        [draftId, null, emp.email_id, subject, htmlBody, '', '', attachmentsJson, user.email, t, t]
      );
    });
    await execute(
      `INSERT INTO employee_credentials (id, employee_id, employee_name, emp_code, email, password, status, draft_id, created_by, created_at) VALUES (?,?,?,?,?,?,'draft',?,?,?)`,
      [uuidv4(), cred.employee_id, emp.full_name || '', emp.emp_code || '', emp.email_id, '(own password)', draftId, user.email, t]
    );
    const r = await sendDraftById(draftId, user);
    if (!r.success) return jsonError(r.error || 'Could not send the mail', 502);
    await auditFrom(user, 'credentials_resent', 'employee', String(cred.employee_id), { emp_code: cred.emp_code, with_password: false });
    return jsonSuccess({ message: `Sent to ${emp.email_id}. The mail does not show a temporary password, because the employee has set their own.`, own_password: true });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
