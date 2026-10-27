// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { fillEmployeeTemplate } from '@/lib/emailTemplates';
import { parseRequiredDocs, cleanRequiredDocs } from '@/lib/documents';
import { documentSlots } from '@/lib/doc-permissions';
import { sendEmailDetailed } from '@/lib/email';
import { ensureDocumentRequestTemplate, DOCUMENT_REQUEST_TEMPLATE } from '@/lib/masters';
import { parseAddressList } from '@/lib/request-mail';
import { auditFrom } from '@/lib/audit';

const canManage = (u: any) => u.type === 'admin' && (checkPermission(u, 'approve_documents') || checkPermission(u, 'edit_employee'));

// The mail HR sends from the employee's Documents tab: which papers the employee has to upload (compulsory ones not in yet,
// and the ones HR has allowed). The wording is the "Document Request" template (Settings > Template Management); HR can
// still change the subject and text before sending.
//   GET  ?employee_id= [&required=Key1,Key2]    -> { to, subject, body, documents }   (the mail, filled in)
//   POST { employee_id, subject, message, cc? } -> sends it
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code, email_id, required_documents FROM employees WHERE id = ? AND COALESCE(is_deleted,0)=0', [new URL(req.url).searchParams.get('employee_id') || '']))[0];
    if (!emp) return jsonError('Employee not found', 404);

    await ensureDocumentRequestTemplate();
    const tpl = (await query<RowDataPacket[]>('SELECT subject, body FROM email_templates WHERE name = ? LIMIT 1', [DOCUMENT_REQUEST_TEMPLATE]))[0];
    if (!tpl) return jsonError(`No "${DOCUMENT_REQUEST_TEMPLATE}" email template found. Create it in Settings -> Email Templates first.`, 422);

    const slots = await documentSlots(String(emp.id));
    // the ticks HR sees on the screen (even if not saved yet); the saved list when the screen sends none
    const sp = new URL(req.url).searchParams;
    const compulsory = sp.has('required') ? cleanRequiredDocs(String(sp.get('required') || '').split(',').filter(Boolean)) : parseRequiredDocs(emp.required_documents);
    const wanted = slots.filter(s => (s.key !== 'Additional' && compulsory.includes(s.key) && !s.filled && !s.waiting) || s.permission === 'granted');
    const documents = wanted.map(s => s.label);
    const company = (await query<RowDataPacket[]>('SELECT company_name FROM company_settings LIMIT 1'))[0] || {};
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const vars = { fullName: emp.full_name, email: emp.email_id, empCode: emp.emp_code, loginUrl: `${appUrl}/login`, companyName: company.company_name || 'our company', companyLogo: '' };
    const docList = documents.length ? documents.map(d => `- ${d}`).join('\n') : '- (no document is waiting right now)';
    const fill = (t: string) => fillEmployeeTemplate(t || '', vars).replace(/\{{1,2}documents\}{1,2}/gi, docList);
    return jsonSuccess({ to: emp.email_id || '', subject: fill(tpl.subject), body: fill(tpl.body), documents });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code, email_id FROM employees WHERE id = ? AND COALESCE(is_deleted,0)=0', [b.employee_id]))[0];
    if (!emp) return jsonError('Employee not found', 404);
    if (!emp.email_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emp.email_id)) return jsonError('This employee has no valid email address', 422);
    const subject = String(b.subject || '').trim().slice(0, 200), message = String(b.message || '').trim().slice(0, 8000);
    if (!subject || !message) return jsonError('Write the subject and the message', 422);
    const cc = parseAddressList(b.cc);
    if (cc.bad) return jsonError(`"${cc.bad}" is not a valid email address`, 422);

    const r = await sendEmailDetailed(emp.email_id, subject, message, { cc: cc.list.join(',') || undefined, asUser: { id: user.id, type: user.type } });
    await execute(
      `INSERT INTO email_logs (id, candidate_id, candidate_name, template_name, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [uuidv4(), null, emp.full_name, DOCUMENT_REQUEST_TEMPLATE, emp.email_id, subject, message, cc.list.join(','), '', '[]', r.success ? 'sent' : 'failed', user.email, now()]
    ).catch(() => {});
    if (!r.success) return jsonError(`The mail was not sent: ${r.error || 'unknown error'}`, 502);
    await auditFrom(user, 'document_mail_sent', 'employee', String(emp.id), { emp_code: emp.emp_code, to: emp.email_id });
    return jsonSuccess({ message: `Mail sent to ${emp.email_id}` + (r.rejected && r.rejected.length ? ` (refused for: ${r.rejected.join(', ')})` : '') });
  } catch (e: any) { return jsonError(e, 500); }
}
