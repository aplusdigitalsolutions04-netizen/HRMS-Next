// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    const { current_password, new_password } = body;
    if (!new_password) return jsonError('New password required', 422);
    if (new_password.length < 8) return jsonError('New password must be at least 8 characters', 422);

    const rows = await query<RowDataPacket[]>('SELECT password, must_change_password FROM employees WHERE id = ?', [user.id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    // The forced first-login password change flow doesn't collect a current password.
    // Only require/verify it for a voluntary change while already logged in normally.
    if (!rows[0].must_change_password) {
      if (!current_password) return jsonError('Current password required', 422);
      if (!verifyPassword(current_password, rows[0].password)) return jsonError('Current password incorrect', 400);
    }
    await execute('UPDATE employees SET password = ?, must_change_password = 0 WHERE id = ?', [hashPassword(new_password), user.id]);
    // Keep the credentials-sent record in sync so "Employee Credentials"
    // reflects the employee's actual current password, not the stale one.
    await execute('UPDATE employee_credentials SET password = ? WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1', [new_password, user.id]).catch(() => {});
    return jsonSuccess({ message: 'Password changed' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
