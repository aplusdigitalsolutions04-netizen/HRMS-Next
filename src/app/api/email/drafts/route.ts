// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, hasAnyPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { fillEmployeeTemplate, buildCompanyLogoEmail } from '@/lib/emailTemplates';

// Drafts saved before the candidate / template names were kept get them filled in from the candidate and the template (checked at most every ten minutes).
let namesRepairedAt = 0;
async function repairDraftNames() {
  if (Date.now() - namesRepairedAt < 10 * 60_000) return;   // at most every ten minutes
  namesRepairedAt = Date.now();
  try {
    await execute("UPDATE email_drafts d JOIN interview_candidates c ON c.id = d.candidate_id SET d.candidate_name = c.candidate_name WHERE (d.candidate_name IS NULL OR d.candidate_name = '')");
    await execute("UPDATE email_drafts d JOIN email_templates t ON t.id = d.template_id SET d.template_name = t.name WHERE (d.template_name IS NULL OR d.template_name = '')");
  } catch { /* a database without those columns */ }
}

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_drafts', 'manage_drafts', 'send_candidate_emails', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
    await repairDraftNames();
    const rows = await query<RowDataPacket[]>('SELECT * FROM email_drafts WHERE status=? ORDER BY updated_at DESC', ['draft']);
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_drafts', 'manage_drafts', 'send_candidate_emails', 'add_candidate'])) return jsonError('Insufficient permissions', 403);

    const bodyReq = await req.json().catch(() => ({}));
    const { employee_id, template_id } = bodyReq;
    
    if (!employee_id || !template_id) return jsonError('Missing employee_id or template_id', 400);

    const emps = await query<RowDataPacket[]>('SELECT full_name, email_id, mobile_no, official_email, official_no FROM employees WHERE id = ?', [employee_id]);
    if (emps.length === 0) return jsonError('Employee not found', 404);
    const emp = emps[0];

    const tmplRows = await query<RowDataPacket[]>('SELECT name, subject, body FROM email_templates WHERE id = ?', [template_id]);
    if (tmplRows.length === 0) return jsonError('Template not found', 404);
    const tmpl = tmplRows[0];

    const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1');
    const companyName = companyRows[0]?.company_name || '';
    const { html: companyLogo, attachment: logoAttachment } = buildCompanyLogoEmail(companyRows[0]?.company_logo, companyName);

    // For already active employees, the real password isn't accessible here,
    // so it's left masked - fillEmployeeTemplate defaults to '********' when
    // no password is passed.
    const templateVars = {
      fullName: emp.full_name,
      email: emp.email_id,
      officialEmail: emp.official_email,
      officialNo: emp.official_no,
      companyLogo,
      companyName,
    };
    const rawSubject = fillEmployeeTemplate(tmpl.subject || '', templateVars);
    const rawBody = fillEmployeeTemplate(tmpl.body, templateVars);

    const draftId = require('crypto').randomUUID();
    const t = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const attachmentsJson = JSON.stringify(logoAttachment ? [logoAttachment] : []);

    await require('@/lib/db').execute(
      `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, template_name, candidate_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`,
      [draftId, null, emp.email_id, rawSubject, rawBody, '', '', attachmentsJson, user.email, t, t, tmpl.name, emp.full_name]
    ).catch(async () => {
      // Fallback if template_name or candidate_name columns don't exist
      await require('@/lib/db').execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        [draftId, null, emp.email_id, rawSubject, rawBody, '', '', attachmentsJson, user.email, t, t]
      );
    });

    return jsonSuccess({ message: 'Draft created successfully', draft_id: draftId });
  } catch (e: any) { 
    console.error(e);
    return jsonError(e.message || 'Internal Server Error', 500); 
  }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
