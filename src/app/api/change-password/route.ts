import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { hashPassword, verifyPassword, createToken, passwordFingerprint } from '@/lib/auth';
import { validatePassword } from '@/lib/password-policy';
import { execute, query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  return handleChangePassword(req);
}

export async function PUT(req: NextRequest) {
  return handleChangePassword(req);
}

// Changing the password makes every older login token stop working, so the answer carries a fresh token for this session.
async function handleChangePassword(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { current_password, new_password } = await req.json();
    if (!new_password) return jsonError('New password required', 422);
    const rule = validatePassword(new_password, user.email);
    if (rule) return jsonError(rule, 422);

    const table = user.type === 'admin' ? 'hr_admins' : 'employees';
    const rows = await query<RowDataPacket[]>(`SELECT password, must_change_password FROM ${table} WHERE id = ?`, [user.id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    // The forced password change at login does not ask for the current password (the person has just logged in with it).
    if (!rows[0].must_change_password) {
      if (!current_password) return jsonError('Current and new password required', 422);
      if (!verifyPassword(current_password, rows[0].password)) return jsonError('Current password is incorrect', 400);
    }
    if (verifyPassword(new_password, rows[0].password)) return jsonError('The new password must be different from the current one', 422);

    const hashed = hashPassword(new_password);
    if (user.type === 'admin') {
      await execute('UPDATE hr_admins SET password = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?', [hashed, user.id]);
    } else {
      await execute('UPDATE employees SET password = ?, must_change_password = 0 WHERE id = ?', [hashed, user.id]);
      // the credentials list only keeps the temporary password that was mailed; the employee's own password is never kept
      await execute("UPDATE employee_credentials SET password = '' WHERE employee_id = ?", [user.id]).catch(() => {});
    }
    const access_token = createToken({ sub: String(user.id), email: user.email, role: user.role, type: user.type, must_change_password: false, pf: passwordFingerprint(hashed) });
    return NextResponse.json({ message: 'Password changed successfully', access_token });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
