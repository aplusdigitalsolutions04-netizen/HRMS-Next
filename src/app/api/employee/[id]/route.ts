// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Soft delete: the row, and every record that references it (attendance,
// payroll, credentials, etc.), stays in the database. The employee is just
// hidden from normal lists via is_deleted, and can be brought back with
// POST /api/employee/[id]/restore.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'delete_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const rows = await query<RowDataPacket[]>('SELECT id FROM employees WHERE id = ? AND is_deleted = 0', [id]);
    if (rows.length === 0) return jsonError('Employee not found', 404);

    const body = await req.json().catch(() => ({}));
    const freeIdentity = !!body.free_identity;

    if (freeIdentity) {
      // email_id/emp_code are UNIQUE and email_id is NOT NULL, so to let HR
      // re-invite the same email/ID right away, tombstone them instead of
      // just flipping the is_deleted flag - a real re-insert with the same
      // values would otherwise hit the unique constraint.
      await execute(
        "UPDATE employees SET is_deleted = 1, deleted_at = NOW(), email_id = CONCAT('deleted_', UNIX_TIMESTAMP(), '_', email_id), emp_code = NULL WHERE id = ?",
        [id]
      );
    } else {
      await execute('UPDATE employees SET is_deleted = 1, deleted_at = NOW() WHERE id = ?', [id]);
    }

    return jsonSuccess({ message: 'Employee deleted' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
