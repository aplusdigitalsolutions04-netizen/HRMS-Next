// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4 } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cleanPermissions, isReservedRoleName } from '@/lib/admin-users';
import { auditFrom } from '@/lib/audit';

// Roles made by the administrator: a name and a set of permissions that every person with the role gets.
// GET lists them with how many people have each; POST makes one.
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    if (user.role !== 'ADMIN') {
      return jsonError('Insufficient permissions', 403);
    }

    const roles = await query<RowDataPacket[]>(
      `SELECT r.id, r.name, r.description, r.permissions, r.created_at, r.updated_at,
              (SELECT COUNT(*) FROM hr_admins h WHERE h.role = r.id) AS user_count
       FROM system_roles r ORDER BY r.created_at ASC`);

    // `permissions` is a native MySQL JSON column - mysql2 already parses it
    // into a JS object, so calling JSON.parse on it again throws.
    const formattedRoles = roles.map(r => {
      const permissions = r.permissions || {};
      return { ...r, permissions, user_count: Number(r.user_count) || 0, permission_count: Object.values(permissions).filter(v => v === true).length };
    });

    return jsonSuccess(formattedRoles);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    if (user.role !== 'ADMIN') {
      return jsonError('Only ADMIN can create roles', 403);
    }

    const body = await req.json();
    const name = String(body.name || '').trim().slice(0, 100);
    if (!name) return jsonError('Role name is required', 422);
    if (isReservedRoleName(name)) return jsonError('This name is used by a built-in role. Choose another name.', 422);

    const existing = await query<RowDataPacket[]>('SELECT id FROM system_roles WHERE LOWER(name) = LOWER(?)', [name]);
    if (existing.length > 0) {
      return jsonError('A role with this name already exists', 409);
    }

    const id = uuidv4();
    const perms = cleanPermissions(body.permissions);

    await execute(
      'INSERT INTO system_roles (id, name, description, permissions) VALUES (?, ?, ?, ?)',
      [id, name, String(body.description || '').trim().slice(0, 250), JSON.stringify(perms)]
    );
    await auditFrom(user, 'role_created', 'role', id, { name, permissions: Object.values(perms).filter(Boolean).length });

    return jsonSuccess({ message: 'Role created successfully', id });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
