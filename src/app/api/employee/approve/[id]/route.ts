// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword } from '@/lib/auth';
import { fillEmployeeTemplate } from '@/lib/emailTemplates';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const emps = await query<RowDataPacket[]>('SELECT full_name, emp_code, email_id, mobile_no, official_email, official_no, must_change_password FROM employees WHERE id = ?', [id]);
    if (emps.length === 0) return jsonError('Employee not found', 404);

    const emp = emps[0];
    // If the employee already personalized their password (e.g. via the
    // invite -> first-login forced change flow), don't reset it again here -
    // only employees who never set their own password get the mobile-number
    // fallback password on approval.
    const alreadyHasOwnPassword = !emp.must_change_password;
    const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1');
    const companyName = companyRows[0]?.company_name || '';
    const companyLogo = companyRows[0]?.company_logo || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;

    const tempPassword = emp.mobile_no || '123456';
    const hashed = hashPassword(tempPassword);
    
    let officialDetailsHtml = '';
    if (emp.official_email || emp.official_no) {
        officialDetailsHtml = `
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
            <h3 style="margin:0 0 10px;color:#166534;font-size:14px">Your Official Contact Details:</h3>
            ${emp.official_email ? `<p style="margin:0 0 6px;color:#15803d;font-size:13px"><strong>Official Email:</strong> ${emp.official_email}</p>` : ''}
            ${emp.official_no ? `<p style="margin:0;color:#15803d;font-size:13px"><strong>Official No:</strong> ${emp.official_no}</p>` : ''}
          </div>
        `;
    }

    const bodyReq = await req.json().catch(() => ({}));
    const templateId = bodyReq.template_id;

    let emailSubject = '';
    let htmlBody = '';
    let templateName = '';
    let createDraft = false;

    if (templateId && !alreadyHasOwnPassword) {
      const tmplRows = await query<RowDataPacket[]>('SELECT name, subject, body FROM email_templates WHERE id = ?', [templateId]);
      if (tmplRows.length > 0) {
        const tmpl = tmplRows[0];
        templateName = tmpl.name || '';
        const templateVars = {
          fullName: emp.full_name,
          email: emp.email_id,
          password: tempPassword,
          loginUrl: `<a href="${appUrl}/login">${appUrl}/login</a>`,
          officialEmail: emp.official_email,
          officialNo: emp.official_no,
          officialDetailsHtml,
          companyLogo,
          companyName,
        };
        emailSubject = fillEmployeeTemplate(tmpl.subject || '', templateVars);
        htmlBody = fillEmployeeTemplate(tmpl.body, templateVars);
        createDraft = true;
      }
    }

    if (createDraft) {
      const draftId = uuidv4();
      const t = now();
      // Ensure we have template_name column in the query if it exists. If not, maybe just insert without it or update schema.
      // Usually it's better to try to insert template_name. But let's check if email_drafts has template_name.
      // In DraftManagement.jsx, it uses viewingDraft.template_name so we should insert it.
      await execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, template_name, candidate_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`,
        [draftId, null, emp.email_id, emailSubject, htmlBody, '', '', '[]', user.email, t, t, templateName, emp.full_name]
      ).catch(async () => {
        // Fallback if template_name column doesn't exist
        await execute(
          `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
          [draftId, null, emp.email_id, emailSubject, htmlBody, '', '', '[]', user.email, t, t]
        );
      });

      // Track what credentials were sent to this employee, separately from
      // the generic draft, so there's a dedicated place to review/resend
      // them without digging through Draft Management.
      await execute(
        `INSERT INTO employee_credentials (id, employee_id, employee_name, emp_code, email, password, status, draft_id, created_by, created_at) VALUES (?,?,?,?,?,?,'draft',?,?,?)`,
        [uuidv4(), id, emp.full_name || '', emp.emp_code || '', emp.email_id, tempPassword, draftId, user.email, t]
      );
    }

    if (alreadyHasOwnPassword) {
      await execute('UPDATE employees SET status = ? WHERE id = ?', ['active', id]);
    } else {
      await execute('UPDATE employees SET status = ?, password = ?, must_change_password = 1 WHERE id = ?', ['active', hashed, id]);
    }

    return jsonSuccess({
      message: alreadyHasOwnPassword
        ? 'Employee approved. They can log in with their existing password.'
        : 'Employee approved and activation email draft created for HR review.',
      draft_created: createDraft,
    });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

