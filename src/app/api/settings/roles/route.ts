import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    
    if (user.role !== 'ADMIN') {
        return jsonError('Insufficient permissions', 403);
    }

    const roles = await query<RowDataPacket[]>('SELECT id, name, description, permissions, created_at, updated_at FROM system_roles ORDER BY created_at ASC');
    
    // `permissions` is a native MySQL JSON column - mysql2 already parses it
    // into a JS object, so calling JSON.parse on it again throws.
    const formattedRoles = roles.map(r => ({
      ...r,
      permissions: r.permissions || {}
    }));

    return jsonSuccess(formattedRoles);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    
    if (user.role !== 'ADMIN') {
      return jsonError('Only ADMIN can create roles', 403);
    }

    const body = await req.json();
    const { name, description, permissions } = body;

    if (!name) return jsonError('Role name is required');

    const existing = await query<RowDataPacket[]>('SELECT id FROM system_roles WHERE name = ?', [name]);
    if (existing.length > 0) {
      return jsonError('A role with this name already exists');
    }

    const id = uuidv4();
    const permsJson = JSON.stringify(permissions || {});

    await execute(
      'INSERT INTO system_roles (id, name, description, permissions) VALUES (?, ?, ?, ?)',
      [id, name, description || '', permsJson]
    );

    return jsonSuccess({ message: 'Role created successfully', id });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
