// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { fillEmployeeTemplate } from '@/lib/emailTemplates';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>('SELECT * FROM email_drafts WHERE status=? ORDER BY updated_at DESC', ['draft']);
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const bodyReq = await req.json().catch(() => ({}));
    const { employee_id, template_id } = bodyReq;
    
    if (!employee_id || !template_id) return jsonError('Missing employee_id or template_id', 400);

    const emps = await query<RowDataPacket[]>('SELECT full_name, email_id, mobile_no, official_email, official_no FROM employees WHERE id = ?', [employee_id]);
    if (emps.length === 0) return jsonError('Employee not found', 404);
    const emp = emps[0];

    const tmplRows = await query<RowDataPacket[]>('SELECT name, subject, body FROM email_templates WHERE id = ?', [template_id]);
    if (tmplRows.length === 0) return jsonError('Template not found', 404);
    const tmpl = tmplRows[0];

    // For already active employees, the real password isn't accessible here,
    // so it's left masked - fillEmployeeTemplate defaults to '********' when
    // no password is passed.
    const rawBody = fillEmployeeTemplate(tmpl.body, {
      fullName: emp.full_name,
      email: emp.email_id,
      officialEmail: emp.official_email,
      officialNo: emp.official_no,
    });

    const draftId = require('crypto').randomUUID();
    const t = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await require('@/lib/db').execute(
      `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, template_name, candidate_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)`,
      [draftId, null, emp.email_id, tmpl.subject || '', rawBody, '', '', '[]', user.email, t, t, tmpl.name, emp.full_name]
    ).catch(async () => {
      // Fallback if template_name or candidate_name columns don't exist
      await require('@/lib/db').execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        [draftId, null, emp.email_id, tmpl.subject || '', rawBody, '', '', '[]', user.email, t, t]
      );
    });

    return jsonSuccess({ message: 'Draft created successfully', draft_id: draftId });
  } catch (e: any) { 
    console.error(e);
    return jsonError(e.message || 'Internal Server Error', 500); 
  }
}
