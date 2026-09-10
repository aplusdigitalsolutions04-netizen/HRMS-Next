import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  return handleChangePassword(req);
}

export async function PUT(req: NextRequest) {
  return handleChangePassword(req);
}

async function handleChangePassword(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { current_password, new_password } = await req.json();
    if (!current_password || !new_password) {
      return jsonError('Current and new password required', 422);
    }
    if (new_password.length < 6) {
      return jsonError('New password must be at least 6 characters', 422);
    }

    if (user.type === 'admin') {
      const rows = await query<RowDataPacket[]>('SELECT password FROM hr_admins WHERE id = ?', [user.id]);
      if (rows.length === 0) return jsonError('User not found', 404);
      if (!verifyPassword(current_password, rows[0].password)) {
        return jsonError('Current password is incorrect', 400);
      }
      await execute('UPDATE hr_admins SET password = ?, updated_at = NOW() WHERE id = ?', [hashPassword(new_password), user.id]);
    } else {
      const rows = await query<RowDataPacket[]>('SELECT password FROM employees WHERE id = ?', [user.id]);
      if (rows.length === 0) return jsonError('User not found', 404);
      if (!verifyPassword(current_password, rows[0].password)) {
        return jsonError('Current password is incorrect', 400);
      }
      await execute('UPDATE employees SET password = ?, must_change_password = 0 WHERE id = ?', [hashPassword(new_password), user.id]);
      // Keep the credentials-sent record in sync so "Employee Credentials"
      // reflects the employee's actual current password, not the stale one.
      await execute('UPDATE employee_credentials SET password = ? WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1', [new_password, user.id]).catch(() => {});
    }
    return jsonSuccess({ message: 'Password changed successfully' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
