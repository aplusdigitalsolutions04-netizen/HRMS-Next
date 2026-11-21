// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, requireRole, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword } from '@/lib/auth';
import { validatePassword } from '@/lib/password-policy';
import { auditFrom } from '@/lib/audit';
import { roleName, EMAIL_RE } from '@/lib/admin-users';

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT id, email, full_name, full_name AS name, role, is_active, last_login FROM hr_admins WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

// PUT { full_name?, email?, role?, is_active?, new_password?, must_change_password? }: what is sent is changed.
// An administrator account keeps its role, cannot be disabled and its password is not reset here (the administrator changes their own).
async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const t = (await query<RowDataPacket[]>('SELECT id, email, full_name, role, is_active FROM hr_admins WHERE id=?', [id]))[0];
    if (!t) return jsonError('User not found', 404);
    const isAdminAccount = t.role === 'ADMIN';
    const changes: Record<string, any> = {};
    const sets: string[] = [], vals: any[] = [];

    if (body.is_active !== undefined) {
      const active = !!body.is_active;
      if (!active && isAdminAccount) return jsonError('Admin accounts cannot be disabled', 400);
      if (!active && t.id === user.id) return jsonError('You cannot disable your own account', 400);
      if (active !== !!t.is_active) { sets.push('is_active = ?'); vals.push(active ? 1 : 0); changes.is_active = active; }
    }
    if (body.full_name !== undefined) {
      const name = String(body.full_name).trim().slice(0, 150);
      if (name !== String(t.full_name || '')) { sets.push('full_name = ?'); vals.push(name); changes.name = name; }
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim();
      if (!EMAIL_RE.test(email)) return jsonError('Enter a valid email address', 422);
      if (email.toLowerCase() !== String(t.email).toLowerCase()) {
        if ((await query<RowDataPacket[]>('SELECT id FROM hr_admins WHERE LOWER(email) = LOWER(?) AND id <> ?', [email, id])).length) return jsonError('A user with this email already exists', 409);
        sets.push('email = ?'); vals.push(email); changes.email = email;
      }
    }
    if (body.role !== undefined && body.role !== t.role) {
      if (isAdminAccount) return jsonError('The role of an Admin account cannot be changed', 400);
      const rname = await roleName(String(body.role));
      if (!rname) return jsonError('That role does not exist', 422);
      sets.push('role = ?'); vals.push(String(body.role)); changes.role = rname;
    }
    if (body.new_password !== undefined && body.new_password !== '') {
      if (isAdminAccount) return jsonError('An Admin changes their own password from their profile', 400);
      const pwErr = await validatePassword(String(body.new_password), t.email);
      if (pwErr) return jsonError(pwErr, 422);
      sets.push('password = ?'); vals.push(hashPassword(String(body.new_password)));
      sets.push('must_change_password = ?'); vals.push(body.must_change_password === false ? 0 : 1);
      changes.password_reset = true;
    }
    if (!sets.length) return jsonSuccess({ message: 'Nothing to change' });
    sets.push('updated_at = ?'); vals.push(now());
    await execute(`UPDATE hr_admins SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    await auditFrom(user, 'admin_user_updated', 'admin_user', id, { email: changes.email || t.email, ...changes });
    return jsonSuccess({ message: changes.password_reset ? 'Password reset' : 'User updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    if (id === user.id) return jsonError('You cannot delete your own account', 400);
    const rows = await query<RowDataPacket[]>('SELECT id, email, role FROM hr_admins WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    if (rows[0].role === 'ADMIN') return jsonError('Admin accounts cannot be deleted', 400);
    await execute('DELETE FROM hr_admins WHERE id=?', [id]);
    await auditFrom(user, 'admin_user_deleted', 'admin_user', id, { email: rows[0].email });
    return jsonSuccess({ message: 'User deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
