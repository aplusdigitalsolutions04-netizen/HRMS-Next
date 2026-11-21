// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cleanPermissions, isReservedRoleName } from '@/lib/admin-users';
import { auditFrom } from '@/lib/audit';

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.role !== 'ADMIN') return jsonError('Only ADMIN can update roles', 403);

    const { id } = await params;

    const existing = await query<RowDataPacket[]>('SELECT id, name FROM system_roles WHERE id = ?', [id]);
    if (existing.length === 0) return jsonError('Role not found', 404);

    const body = await req.json();
    const name = String(body.name || '').trim().slice(0, 100);
    if (!name) return jsonError('Role name is required', 422);
    if (isReservedRoleName(name)) return jsonError('This name is used by a built-in role. Choose another name.', 422);

    // check duplicate name
    const existingName = await query<RowDataPacket[]>('SELECT id FROM system_roles WHERE LOWER(name) = LOWER(?) AND id != ?', [name, id]);
    if (existingName.length > 0) return jsonError('Another role with this name already exists', 409);

    // the people who have this role get the new permissions at their next request
    const perms = cleanPermissions(body.permissions);
    await execute(
      'UPDATE system_roles SET name = ?, description = ?, permissions = ? WHERE id = ?',
      [name, String(body.description || '').trim().slice(0, 250), JSON.stringify(perms), id]
    );
    const users = (await query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM hr_admins WHERE role = ?', [id]))[0]?.n || 0;
    await auditFrom(user, 'role_updated', 'role', id, { name, was: existing[0].name, permissions: Object.values(perms).filter(Boolean).length, users: Number(users) });

    return jsonSuccess({ message: 'Role updated successfully' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.role !== 'ADMIN') return jsonError('Only ADMIN can delete roles', 403);

    const { id } = await params;

    const was = (await query<RowDataPacket[]>('SELECT name FROM system_roles WHERE id = ?', [id]))[0];
    if (!was) return jsonError('Role not found', 404);

    // Check if any admin or employee is currently using this role
    const adminsWithRole = await query<RowDataPacket[]>('SELECT email FROM hr_admins WHERE role = ?', [id]);
    if (adminsWithRole.length > 0) {
      return jsonError(`Cannot delete this role because ${adminsWithRole.length} user${adminsWithRole.length === 1 ? ' has' : 's have'} it (${adminsWithRole.slice(0, 3).map(a => a.email).join(', ')}${adminsWithRole.length > 3 ? ', ...' : ''}). Give them another role first.`, 409);
    }

    const empsWithRole = await query<RowDataPacket[]>('SELECT id FROM employees WHERE role = ?', [id]).catch(() => []);
    if (empsWithRole.length > 0) {
      return jsonError('Cannot delete this role because it is currently assigned to one or more employees.', 409);
    }

    await execute('DELETE FROM system_roles WHERE id = ?', [id]);
    await auditFrom(user, 'role_deleted', 'role', id, { name: was.name });

    return jsonSuccess({ message: 'Role deleted successfully' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
