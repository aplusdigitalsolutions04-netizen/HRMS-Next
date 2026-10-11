// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cleanRequiredDocs, parseRequiredDocs, requiredDocsHtml, docLabels } from '@/lib/documents';
import { sendEmailDetailed } from '@/lib/email';
import { auditFrom } from '@/lib/audit';

// Which documents an employee must upload. Works for people already invited too: HR can set or change
// the list at any time; the onboarding form enforces it the next time the employee opens it.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    const id = new URL(req.url).searchParams.get('employee_id') || '';
    const rows = await query<RowDataPacket[]>('SELECT required_documents FROM employees WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Employee not found', 404);
    return jsonSuccess({ required_documents: parseRequiredDocs(rows[0].required_documents) });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !(checkPermission(user, 'edit_employee') || checkPermission(user, 'approve_employee'))) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const docs = cleanRequiredDocs(body.required_documents);
    const rows = await query<RowDataPacket[]>('SELECT id, full_name, email_id, status, emp_code FROM employees WHERE id = ? AND COALESCE(is_deleted,0) = 0', [body.employee_id]);
    if (rows.length === 0) return jsonError('Employee not found', 404);
    const emp = rows[0];

    await execute('UPDATE employees SET required_documents = ? WHERE id = ?', [docs.length ? JSON.stringify(docs) : null, emp.id]);
    await auditFrom(user, 'required_documents_set', 'employee', emp.id, { emp_code: emp.emp_code, required: docs });

    // Optional reminder mail - only useful while the employee can still upload (invited / sent back).
    let emailed = false, emailError: string | undefined;
    const canUpload = ['invited', 'needs_correction'].includes(emp.status);
    if (body.notify && docs.length > 0 && canUpload && emp.email_id) {
      const html = `<p>Dear ${emp.full_name || 'Employee'},</p>
        <p>HR needs a few documents from you to complete your onboarding. Please log in and upload them in your profile.</p>
        ${requiredDocsHtml(docs)}
        <p style="margin-top:18px">Regards,<br/>HR Team</p>`;
      const r = await sendEmailDetailed(emp.email_id, 'Documents needed to complete your onboarding', html, { asUser: { id: user.id, type: user.type } });
      emailed = !!r.success; emailError = r.error;
    }
    return jsonSuccess({
      required_documents: docs, emailed, email_error: emailError,
      message: docs.length ? `${docs.length} compulsory document(s) saved` + (emailed ? ' and the employee was emailed.' : '.') : 'No compulsory documents.',
      can_upload: canUpload,
    });
  } catch (e: any) { return jsonError(e, 500); }
}
