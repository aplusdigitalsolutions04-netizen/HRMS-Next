// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword, generateTempPassword } from '@/lib/auth';
import { fillEmployeeTemplate } from '@/lib/emailTemplates';

const INVITE_SUBJECT = 'Complete Your Profile - Welcome to {{company_name}}';

const INVITE_TEMPLATE = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc">
  {{company_logo}}
  <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,.06)">
    <h2 style="color:#0f172a;margin:0 0 16px">Welcome, {{name}}! &#128075;</h2>
    <p style="color:#334155;font-size:14px;line-height:1.6">
      You've been invited to join our HR Management Portal. To get started,
      please log in using the credentials below and complete your profile.
    </p>

    <div style="background:#f1f5f9;border-radius:10px;padding:18px;margin:20px 0">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">EMPLOYEE ID</p>
      <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a">{{emp_code}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">LOGIN EMAIL</p>
      <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a">{{email}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">TEMPORARY PASSWORD</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a">{{password}}</p>
    </div>

    <p style="text-align:center;margin:28px 0">
      <a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
        Log In &amp; Complete Profile
      </a>
    </p>

    <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin-top:24px">
      Please change your password after logging in. Once you submit your
      details, our HR team will review and activate your account.
    </p>
  </div>
</div>
`;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const fullName = (body.full_name || '').trim();
    const emailId = (body.email_id || '').trim();
    const mobileNo = (body.mobile_no || '').trim();
    if (!fullName || !emailId || !mobileNo) {
      return jsonError('Name, email, and mobile are required', 422);
    }

    const existing = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ? OR mobile_no = ?', [emailId, mobileNo]);
    if (existing.length > 0) return jsonError('An employee with this email or mobile already exists', 409);

    const maxCodeRow = await query<RowDataPacket[]>(
      `SELECT MAX(CAST(emp_code AS UNSIGNED)) as maxCode FROM employees WHERE emp_code REGEXP '^[0-9]+$'`
    );
    const empCode = String((maxCodeRow[0].maxCode || 0) + 1).padStart(4, '0');

    const tempPassword = generateTempPassword();
    const id = uuidv4();
    const t = now();

    await execute(
      `INSERT INTO employees (id, emp_code, email_id, full_name, mobile_no, password, status, created_on, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,1)`,
      [id, empCode, emailId, fullName, mobileNo, hashPassword(tempPassword), 'invited', t]
    );

    const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1');
    const companyName = companyRows[0]?.company_name || 'our company';
    const companyLogoHtml = companyRows[0]?.company_logo
      ? `<img src="${companyRows[0].company_logo}" alt="${companyName}" style="height:36px;margin-bottom:16px" />`
      : '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;

    const subject = INVITE_SUBJECT.replace('{{company_name}}', companyName);
    const htmlBody = fillEmployeeTemplate(INVITE_TEMPLATE, {
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
