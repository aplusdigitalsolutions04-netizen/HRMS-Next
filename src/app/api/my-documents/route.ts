// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { documentSlots } from '@/lib/doc-permissions';
import { DOC_OPTIONS } from '@/lib/documents';

// The employee's documents: what they sent in through My Documents, the papers from onboarding, and for each
// document type whether it is open for uploading (empty, or HR allowed a new one) or locked.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const emp = await query<RowDataPacket[]>('SELECT * FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);

    const rows = await query<RowDataPacket[]>(
      `SELECT id, document_type, original_filename as document_name, temp_file_path as file_path, action as status, created_at as uploaded_at
       FROM document_approvals WHERE employee_id=? ORDER BY created_at DESC`,
      [emp[0].id]
    );
    const slots = await documentSlots(emp[0].id);
    // papers uploaded while filling the onboarding form are kept on the profile; list them so they can be viewed too
    const onboarding = DOC_OPTIONS.filter(d => emp[0][d.column]).map(d => ({ document_type: d.key, label: d.label }));
    return jsonSuccess({ documents: rows, slots: slots, onboarding });
  } catch (e: any) { return jsonError(e, 500); }
}
