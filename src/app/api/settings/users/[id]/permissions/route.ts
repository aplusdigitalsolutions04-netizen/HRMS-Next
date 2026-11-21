// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, requireRole } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ALL_PERMISSIONS } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';

function normalisePerms(raw: any): Record<string, boolean> {
  if (!raw) return {};
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return {}; }
  }
  // If it was stored as an array of keys convert to object
  if (Array.isArray(parsed)) {
    const obj: Record<string, boolean> = {};
    parsed.forEach((k: string) => { if (typeof k === 'string') obj[k] = true; });
    return obj;
  }
  // Already an object
  if (typeof parsed === 'object') return parsed as Record<string, boolean>;
  return {};
}

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT id, email, full_name, role, is_active, permissions FROM hr_admins WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('User not found', 404);
    const r = rows[0];
    // what a role made on the Roles page gives (the person's own settings are added on top of it)
    let rolePerms: Record<string, boolean> = {}, roleName = r.role === 'HR_STAFF' ? 'HR Staff' : r.role;
    if (!['ADMIN', 'HR', 'HR_STAFF'].includes(r.role)) {
      const ro = (await query<RowDataPacket[]>('SELECT name, permissions FROM system_roles WHERE id = ?', [r.role]).catch(() => []))[0];
      if (ro) { rolePerms = normalisePerms(ro.permissions); roleName = ro.name; }
    }
    return jsonSuccess({
      id: r.id,
      email: r.email,
      name: r.full_name,
      role: r.role,
      role_name: roleName,
      role_permissions: rolePerms,
      is_active: r.is_active,
      permissions: normalisePerms(r.permissions),
    });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!requireRole(user, [])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json();

    // Accept object { key: bool } or array ['key1','key2']
    let rawPerms: Record<string, boolean> = {};
    if (Array.isArray(body.permissions)) {
      body.permissions.forEach((k: string) => { if (typeof k === 'string') rawPerms[k] = true; });
    } else if (typeof body.permissions === 'object' && body.permissions !== null) {
      rawPerms = body.permissions;
    }

    // Only allow known permission keys through
    const permsObj: Record<string, boolean> = {};
    for (const key of Object.keys(rawPerms)) {
      if (ALL_PERMISSIONS[key]) permsObj[key] = rawPerms[key] === true;
    }

    await execute('UPDATE hr_admins SET permissions=? WHERE id=?', [JSON.stringify(permsObj), id]);

    await logAudit({
      action: 'update_permissions',
      entity_type: 'hr_admins',
      entity_id: id,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: { permissions: permsObj }
    });

    return jsonSuccess({ message: 'Permissions updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return PUT(req, { params });
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
export const POST = withApiLog(POST_handler);
