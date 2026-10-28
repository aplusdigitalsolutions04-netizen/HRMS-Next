// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';
import { hashPassword, verifyPassword, createToken, passwordFingerprint } from '@/lib/auth';
import { validatePassword } from '@/lib/password-policy';
import { encryptSecret } from '@/lib/mailbox';
import { execute, query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated', 401);
    const body = await req.json();
    const { current_password, new_password } = body;
    if (!new_password) return jsonError('New password required', 422);
    const rule = validatePassword(new_password, user.email);
    if (rule) return jsonError(rule, 422);

    const rows = await query<RowDataPacket[]>('SELECT password, must_change_password FROM employees WHERE id = ?', [user.id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    // The forced first-login password change flow doesn't collect a current password.
    // Only require/verify it for a voluntary change while already logged in normally.
    if (!rows[0].must_change_password) {
      if (!current_password) return jsonError('Current password required', 422);
      if (!verifyPassword(current_password, rows[0].password)) return jsonError('Current password incorrect', 400);
    }
    if (verifyPassword(new_password, rows[0].password)) return jsonError('The new password must be different from the current one', 422);
    const hashed = hashPassword(new_password);
    await execute('UPDATE employees SET password = ?, must_change_password = 0 WHERE id = ?', [hashed, user.id]);
    // kept encrypted, so HR can see it in Employee Credentials
    await execute('UPDATE employee_credentials SET password = ? WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1', [encryptSecret(new_password), user.id]).catch(() => {});
    // older login tokens stop working after a password change, so this session gets a fresh one
    const access_token = createToken({ sub: String(user.id), email: user.email, role: 'USER', type: 'employee', must_change_password: false, pf: passwordFingerprint(hashed) });
    return NextResponse.json({ message: 'Password changed', access_token });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
