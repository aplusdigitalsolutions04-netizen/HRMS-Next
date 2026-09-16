// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword, generateTempPassword } from '@/lib/auth';
import { fillEmployeeTemplate } from '@/lib/emailTemplates';

// Editable from Settings -> Template Management (the row seeded with this
// exact name via scratchpad/seed_invite_template.sql). No hardcoded fallback -
// if this row is missing, the invite is refused until HR creates it there.
const INVITE_TEMPLATE_NAME = 'Employee Invite';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const fullName = (body.full_name || '').trim();
    const emailId = (body.email_id || '').trim();
    const empCode = (body.emp_code || '').trim();
    if (!fullName || !emailId || !empCode) {
      return jsonError('Name, email, and employee ID are required', 422);
    }

    const existing = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ? OR emp_code = ?', [emailId, empCode]);
    if (existing.length > 0) return jsonError('An employee with this email or employee ID already exists', 409);

    const tmplRows = await query<RowDataPacket[]>('SELECT subject, body FROM email_templates WHERE name = ? LIMIT 1', [INVITE_TEMPLATE_NAME]);
    if (tmplRows.length === 0) {
      return jsonError(`No "${INVITE_TEMPLATE_NAME}" email template found. Create it in Settings -> Email Templates before inviting employees.`, 422);
    }

    const tempPassword = generateTempPassword();
    const id = uuidv4();
    const t = now();

    // mobile_no is required by the schema but is filled in by the employee
    // themselves during Complete Profile, just like alternate_mobile_no.
    await execute(
      `INSERT INTO employees (id, emp_code, email_id, full_name, mobile_no, password, status, created_on, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [id, empCode, emailId, fullName, '', hashPassword(tempPassword), 'invited', t]
    );

    const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1');
    const companyName = companyRows[0]?.company_name || 'our company';
    const companyLogoHtml = companyRows[0]?.company_logo
      ? `<img src="${companyRows[0].company_logo}" alt="${companyName}" style="height:36px;margin-bottom:16px" />`
      : '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;

    const subject = (tmplRows[0].subject || '').replace('{{company_name}}', companyName);
    const htmlBody = fillEmployeeTemplate(tmplRows[0].body || '', {
      fullName,
      email: emailId,
      password: tempPassword,
      empCode,
      loginUrl: `${appUrl}/login`,
      companyLogo: companyLogoHtml,
    });

    const draftId = uuidv4();
    await execute(
      `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, template_name, candidate_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`,
      [draftId, null, emailId, subject, htmlBody, '', '', '[]', user.email, t, t, 'Employee Invite', fullName]
    ).catch(async () => {
      await execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        [draftId, null, emailId, subject, htmlBody, '', '', '[]', user.email, t, t]
      );
    });

    await execute(
      `INSERT INTO employee_credentials (id, employee_id, employee_name, emp_code, email, password, status, draft_id, created_by, created_at) VALUES (?,?,?,?,?,?,'draft',?,?,?)`,
      [uuidv4(), id, fullName, empCode, emailId, tempPassword, draftId, user.email, t]
    );

    return jsonSuccess({ id, emp_code: empCode, message: 'Employee invited. Send the credentials from the Employee Credentials page.' }, 201);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
