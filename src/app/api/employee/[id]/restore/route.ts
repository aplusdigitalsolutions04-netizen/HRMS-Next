// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'delete_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const rows = await query<RowDataPacket[]>('SELECT email_id, emp_code FROM employees WHERE id = ? AND is_deleted = 1', [id]);
    if (rows.length === 0) return jsonError('Deleted employee not found', 404);

    // If the identity was freed up on delete (email_id tombstoned, emp_code
    // cleared), it can't be restored automatically - another employee may
    // already be using the real email/code by now.
    if (rows[0].email_id.startsWith('deleted_') || !rows[0].emp_code) {
      return jsonError('This employee\'s email/ID was freed for reuse when deleted and can\'t be auto-restored. Edit the record manually if you need it back.', 409);
    }

    await execute('UPDATE employees SET is_deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Employee restored' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
