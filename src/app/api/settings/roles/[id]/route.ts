import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.role !== 'ADMIN') return jsonError('Only ADMIN can update roles', 403);

    const { id } = await params;
    
    const existing = await query<RowDataPacket[]>('SELECT id FROM system_roles WHERE id = ?', [id]);
    if (existing.length === 0) return jsonError('Role not found', 404);

    const body = await req.json();
    const { name, description, permissions } = body;

    if (!name) return jsonError('Role name is required');

    // check duplicate name
    const existingName = await query<RowDataPacket[]>('SELECT id FROM system_roles WHERE name = ? AND id != ?', [name, id]);
    if (existingName.length > 0) return jsonError('Another role with this name already exists');

    const permsJson = JSON.stringify(permissions || {});

    await execute(
      'UPDATE system_roles SET name = ?, description = ?, permissions = ? WHERE id = ?',
      [name, description || '', permsJson, id]
    );

    return jsonSuccess({ message: 'Role updated successfully' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.role !== 'ADMIN') return jsonError('Only ADMIN can delete roles', 403);

    const { id } = await params;
    
    // Check if any admin or employee is currently using this role
    const adminsWithRole = await query<RowDataPacket[]>('SELECT id FROM hr_admins WHERE role = ?', [id]);
    if (adminsWithRole.length > 0) {
      return jsonError('Cannot delete this role because it is currently assigned to one or more admin users.', 400);
    }
    
    const empsWithRole = await query<RowDataPacket[]>('SELECT id FROM employees WHERE role = ?', [id]).catch(() => []);
    if (empsWithRole.length > 0) {
      return jsonError('Cannot delete this role because it is currently assigned to one or more employees.', 400);
    }

    await execute('DELETE FROM system_roles WHERE id = ?', [id]);
    
    return jsonSuccess({ message: 'Role deleted successfully' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
