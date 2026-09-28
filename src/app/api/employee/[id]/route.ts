// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Soft delete: the row, and every record that references it (attendance,
// payroll, credentials, etc.), stays in the database. The employee is just
// hidden from normal lists via is_deleted, and can be brought back with
// POST /api/employee/[id]/restore.
// Soft delete needs employees.is_deleted / deleted_at (added by a migration). If a
// database was set up without it, add the columns once instead of failing every delete.
let softDeleteReady = false;
async function ensureSoftDeleteColumns() {
  if (softDeleteReady) return;
  const cols = await query<RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME IN ('is_deleted','deleted_at')"
  );
  const have = new Set(cols.map(c => c.COLUMN_NAME));
  if (!have.has('is_deleted')) await execute('ALTER TABLE employees ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0');
  if (!have.has('deleted_at')) await execute('ALTER TABLE employees ADD COLUMN deleted_at DATETIME NULL');
  softDeleteReady = true;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'delete_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    await ensureSoftDeleteColumns();
    const rows = await query<RowDataPacket[]>('SELECT id FROM employees WHERE id = ? AND COALESCE(is_deleted, 0) = 0', [id]);
    if (rows.length === 0) return jsonError('Employee not found', 404);

    const body = await req.json().catch(() => ({}));
    const freeIdentity = !!body.free_identity;

    if (freeIdentity) {
      // email_id/emp_code are UNIQUE and email_id is NOT NULL, so to let HR
      // re-invite the same email/ID right away, tombstone them instead of
      // just flipping the is_deleted flag - a real re-insert with the same
      // values would otherwise hit the unique constraint.
      await execute(
        "UPDATE employees SET is_deleted = 1, deleted_at = NOW(), email_id = LEFT(CONCAT('deleted_', UNIX_TIMESTAMP(), '_', email_id), 150), emp_code = LEFT(CONCAT('del', UNIX_TIMESTAMP(), '_', COALESCE(emp_code, '')), 50) WHERE id = ?",
        [id]
      );
    } else {
      await execute('UPDATE employees SET is_deleted = 1, deleted_at = NOW() WHERE id = ?', [id]);
    }

    return jsonSuccess({ message: 'Employee deleted' });
  } catch (e: any) {
    console.error('[employee delete] failed:', e?.message || e);
    return jsonError(e, 500);
  }
}
