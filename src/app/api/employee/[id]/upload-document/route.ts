// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { DOC_OPTIONS } from '@/lib/documents';
import { saveEmployeeDocument, deleteFileFromDrive, driveErrorMessage } from '@/lib/googleDrive';
import { auditFrom } from '@/lib/audit';

const EXTS = ['pdf', 'jpg', 'jpeg', 'png'];
const MAX = 10 * 1024 * 1024;

// HR/Admin uploads one document into an employee's profile (the file comes in a request of its own, like the employee form).
// A document that is already there is replaced; "Additional" adds one more paper to the extra documents.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const emp = (await query<RowDataPacket[]>('SELECT emp_code, full_name, additional_documents FROM employees WHERE id = ? AND COALESCE(is_deleted,0) = 0', [id]))[0];
    if (!emp) return jsonError('Employee not found', 404);

    const fd = await req.formData();
    const key = String(fd.get('key') || '');
    const file = fd.get('file');
    const opt = DOC_OPTIONS.find(d => d.key === key);
    const isExtra = key === 'Additional';
    if (!opt && !isExtra) return jsonError('Unknown document', 422);
    if (!file || typeof file === 'string' || !file.size) return jsonError('Choose a file', 422);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!EXTS.includes(ext)) return jsonError('Upload a PDF, JPG or PNG file', 422);
    if (file.size > MAX) return jsonError(`"${file.name}" is too big. Please upload a file smaller than 10 MB.`, 422);

    let path: string;
    try {
      path = await saveEmployeeDocument(emp.emp_code, emp.full_name, file);
    } catch (e: any) {
      console.error(`[employee/upload-document] could not save ${key} for ${emp.emp_code}:`, e?.message || e);
      return jsonError(driveErrorMessage(e) || `Could not upload "${file.name}": ${e?.message || 'storage error'}.`, 503);
    }

    if (isExtra) {
      let list: string[] = [];
      try { const v = JSON.parse(emp.additional_documents || '[]'); if (Array.isArray(v)) list = v; } catch { list = []; }
      list.push(path);
      await execute('UPDATE employees SET additional_documents = ? WHERE id = ?', [JSON.stringify(list), id]);
    } else {
      const old = (await query<RowDataPacket[]>(`SELECT \`${opt.column}\` AS v FROM employees WHERE id = ?`, [id]))[0]?.v;
      await execute(`UPDATE employees SET \`${opt.column}\` = ? WHERE id = ?`, [path, id]);
      if (String(old || '').startsWith('drive:')) await deleteFileFromDrive(String(old).slice(6));
    }
    await auditFrom(user, 'document_uploaded_by_hr', 'employee', String(id), { emp_code: emp.emp_code, document: opt ? opt.label : 'Additional document', replaced: !isExtra });
    return jsonSuccess({ key, message: `${opt ? opt.label : 'Additional document'} uploaded.` });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
