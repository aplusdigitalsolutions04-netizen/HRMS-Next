// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT id, emp_code FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);

    const rows = await query<RowDataPacket[]>(
      `SELECT id, document_type, original_filename as document_name, temp_file_path as file_path, action as status, created_at as uploaded_at
       FROM document_approvals WHERE employee_id=? ORDER BY created_at DESC`,
      [emp[0].id]
    );
    return jsonSuccess({ documents: rows });
  } catch (e: any) { return jsonError(e, 500); }
}
