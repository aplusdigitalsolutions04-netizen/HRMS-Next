// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, requireRole } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

const VALID_ROLES = ['ADMIN', 'HR', 'HR_STAFF'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT id, email, full_name, role, is_active FROM hr_admins WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json();
    if (body.role && !VALID_ROLES.includes(body.role)) {
      return jsonError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, 422);
    }
    const target = await query<RowDataPacket[]>('SELECT role FROM hr_admins WHERE id=?', [id]);
    if (target.length === 0) return jsonError('User not found', 404);
    if (target[0].role === 'ADMIN' && body.is_active === false) {
      return jsonError('Admin accounts cannot be disabled', 400);
    }
    if (body.is_active !== undefined) {
      await execute('UPDATE hr_admins SET is_active=? WHERE id=?', [body.is_active ? 1 : 0, id]);
    }
    if (body.full_name) {
      await execute('UPDATE hr_admins SET full_name=? WHERE id=?', [body.full_name, id]);
    }
    if (body.role) {
      await execute('UPDATE hr_admins SET role=? WHERE id=?', [body.role, id]);
    }
    return jsonSuccess({ message: 'User updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    if (id === user.id) return jsonError('You cannot delete your own account', 400);
    const rows = await query<RowDataPacket[]>('SELECT id, role FROM hr_admins WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    if (rows[0].role === 'ADMIN') return jsonError('Admin accounts cannot be deleted', 400);
    await execute('DELETE FROM hr_admins WHERE id=?', [id]);
    return jsonSuccess({ message: 'User deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
