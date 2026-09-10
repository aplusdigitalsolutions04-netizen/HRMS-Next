// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'delete_employee')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const rows = await query<RowDataPacket[]>('SELECT emp_code FROM employees WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Employee not found', 404);
    const empCode = rows[0].emp_code;

    // Delete dependent attendance records first, then the employee itself -
    // attendance.emp_code has a foreign key to employees.emp_code, so deleting
    // the employee first either fails the FK constraint or (if the subquery
    // already returns nothing) silently orphans/skips the cleanup.
    await execute('DELETE FROM attendance WHERE emp_code = ?', [empCode]);
    await execute('DELETE FROM attendance_summary WHERE employee_code = ?', [empCode]);
    await execute('DELETE FROM employees WHERE id = ?', [id]);

    return jsonSuccess({ message: 'Employee deleted' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
