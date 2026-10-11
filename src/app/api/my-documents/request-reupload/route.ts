// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, createNotification } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { documentSlots, docLabel } from '@/lib/doc-permissions';

// The employee asks HR to let them upload a document again.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code FROM employees WHERE email_id=?', [user.email || user.id]))[0];
    if (!emp) return jsonError('Employee not found', 404);
    const b = await req.json();
    const key = String(b.document_type || ''), note = String(b.note || '').trim().slice(0, 300);
    const slot = (await documentSlots(emp.id)).find(s => s.key === key);
    if (!slot) return jsonError('Unknown document type', 422);
    if (slot.permission === 'granted') return jsonError('HR has already allowed you to upload this document', 409);
    if (!note) return jsonError('Please write why you need to upload it', 422);

    await execute(
      "INSERT INTO document_reupload_permissions (employee_id, document_type, status, note, requested_on) VALUES (?,?,'requested',?,NOW()) ON DUPLICATE KEY UPDATE status='requested', note=VALUES(note), requested_on=NOW()",
      [emp.id, key, note]
    );
    createNotification('Document re-upload request', `${emp.full_name || emp.emp_code} asks to upload ${docLabel(key)} again: ${note}`, 'document_request', String(emp.id), true, null);
    return jsonSuccess({ message: 'Request sent to HR. You will be told when HR allows it.' });
  } catch (e: any) { return jsonError(e, 500); }
}
