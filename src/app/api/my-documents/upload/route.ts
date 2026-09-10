// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { isDriveConfigured, getEmployeeFolderId, uploadFileToDrive } from '@/lib/googleDrive';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id, emp_code, full_name FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);

    const fd = await req.formData();
    const file = fd.get('file');
    const docType = fd.get('document_type') || 'other';

    if (!(file instanceof File)) return jsonError('No file provided', 400);

    const ext = path.extname(file.name) || '';
    const id = uuidv4();
    const fileName = `${id}${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    let storedPath: string;
    if (isDriveConfigured()) {
      const folderId = await getEmployeeFolderId(emp[0].emp_code, emp[0].full_name);
      const driveFileId = await uploadFileToDrive(folderId, file.name, buf, file.type);
      storedPath = `drive:${driveFileId}`;
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, fileName), buf);
      storedPath = `uploads/documents/${fileName}`;
    }

    const t = now();
    await execute(
      `INSERT INTO document_approvals (id, employee_id, document_type, temp_file_path, original_filename, file_size, action, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, emp[0].id, docType, storedPath, file.name, file.size, 'pending', t]
    );
    return jsonSuccess({ id, message: 'Document submitted for HR approval' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}
