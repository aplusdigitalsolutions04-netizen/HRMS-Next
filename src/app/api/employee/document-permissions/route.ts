// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { documentSlots, docLabel, PERMISSION_KEYS } from '@/lib/doc-permissions';
import { auditFrom } from '@/lib/audit';

const canManage = (u: any) => u.type === 'admin' && (checkPermission(u, 'approve_documents') || checkPermission(u, 'edit_employee'));

// HR side: which documents of an employee are locked, and who may upload again.
//   GET  ?employee_id=       -> the list
//   POST {employee_id, document_type, allow}  -> allow one more upload of that document, or take the permission back
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);
    const id = new URL(req.url).searchParams.get('employee_id') || '';
    const e = await query<RowDataPacket[]>('SELECT id FROM employees WHERE id = ?', [id]);
    if (e.length === 0) return jsonError('Employee not found', 404);
    const notes = await query<RowDataPacket[]>('SELECT document_type, note FROM document_reupload_permissions WHERE employee_id = ?', [id]);
    const slots = (await documentSlots(id)).map(s => ({ ...s, note: (notes.find(n => n.document_type === s.key) || {}).note || '' }));
    const uploads = await query<RowDataPacket[]>("SELECT id, document_type, original_filename AS name, action AS status, created_at FROM document_approvals WHERE employee_id = ? AND action IN ('pending','approved') ORDER BY created_at DESC", [id]);
    return jsonSuccess({ docs: slots, uploads });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const key = String(b.document_type || '');
    if (!PERMISSION_KEYS.includes(key)) return jsonError('Unknown document type', 422);
    const emp = (await query<RowDataPacket[]>('SELECT id, full_name FROM employees WHERE id = ? AND COALESCE(is_deleted,0)=0', [b.employee_id]))[0];
    if (!emp) return jsonError('Employee not found', 404);

    if (b.allow) {
      await execute(
        "INSERT INTO document_reupload_permissions (employee_id, document_type, status, granted_by, granted_on) VALUES (?,?,'granted',?,NOW()) ON DUPLICATE KEY UPDATE status='granted', granted_by=VALUES(granted_by), granted_on=NOW()",
        [emp.id, key, user.email || String(user.id)]
      );
      createNotification('You can upload a document again', `HR has allowed you to upload ${docLabel(key)} again. Open My Documents and upload the new file.`, 'document_permission', key, false, String(emp.id));
      await auditFrom(user, 'document_reupload_allowed', 'employee', emp.id, { document: docLabel(key) });
      return jsonSuccess({ message: `${emp.full_name} can now upload ${docLabel(key)} once.` });
    }
    await execute('DELETE FROM document_reupload_permissions WHERE employee_id = ? AND document_type = ?', [emp.id, key]);
    await auditFrom(user, 'document_reupload_revoked', 'employee', emp.id, { document: docLabel(key) });
    return jsonSuccess({ message: 'Permission removed.' });
  } catch (e: any) { return jsonError(e, 500); }
}
