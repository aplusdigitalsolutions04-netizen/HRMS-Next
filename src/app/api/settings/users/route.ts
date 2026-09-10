// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, requireRole } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword } from '@/lib/auth';

const VALID_ROLES = ['ADMIN', 'HR', 'HR_STAFF'];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const rows = await query<RowDataPacket[]>('SELECT id, email, full_name, role, is_active FROM hr_admins ORDER BY full_name');
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const ct = req.headers.get('content-type') || '';
    let body;
    if (ct.includes('application/json')) {
      body = await req.json();
    } else {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    }
    if (!body.email) return jsonError('Email required', 422);
    const email = body.email;
    if (body.role && !VALID_ROLES.includes(body.role)) {
      return jsonError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, 422);
    }

    const existing = await query<RowDataPacket[]>('SELECT id FROM hr_admins WHERE email=?', [email]);
    if (existing.length > 0) return jsonError('User already exists', 409);

    const id = uuidv4(); const t = now();
    // Default permissions: only basic view access
    const defaultPerms = JSON.stringify({
      view_dashboard: true,
      view_employees: true,
      view_employee_details: true,
      view_leave: true,
      view_attendance: true,
    });
    await execute(
      `INSERT INTO hr_admins (id, email, full_name, password, role, is_active, permissions, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
      [id, email, body.full_name || body.name || '', hashPassword(body.password || '123456'), body.role || 'HR_STAFF', body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1, defaultPerms, t]
    );
    return jsonSuccess({ id, message: 'User created' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}
