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
