// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { saveEmployeeDocument } from '@/lib/googleDrive';
import { canUploadDocument, usePermission, docLabel } from '@/lib/doc-permissions';
import { driveErrorMessage } from '@/lib/googleDrive';
import { auditFrom } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id, emp_code, full_name FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);

    const fd = await req.formData();
    const file = fd.get('file');
    const docType = String(fd.get('document_type') || 'other');

    if (!(file instanceof File)) return jsonError('No file provided', 400);

    // A document that is already in can only be replaced when HR has allowed it (checked here, not only on the screen).
    const can = await canUploadDocument(emp[0].id, docType);
    if (!can.ok) return jsonError(can.reason || 'You cannot upload this document now', 403);

    const id = uuidv4();
    const storedPath = await saveEmployeeDocument(emp[0].emp_code, emp[0].full_name, file);

    const t = now();
    await execute(
      `INSERT INTO document_approvals (id, employee_id, document_type, temp_file_path, original_filename, file_size, action, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, emp[0].id, docType, storedPath, file.name, file.size, 'pending', t]
    );
    if (docType !== 'Additional') await usePermission(emp[0].id, docType); // the permission is used up by this upload
    if (can.usesPermission) {
      await auditFrom(user, 'document_reupload_used', 'employee', emp[0].id, { document: docLabel(docType) });
    }
    return jsonSuccess({ id, message: 'Document submitted for HR approval' }, 201);
  } catch (e: any) {
    const friendly = driveErrorMessage(e);
    return friendly ? jsonError(friendly, 503) : jsonError(e, 500);
  }
}
