// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>('SELECT d.*, dp.name as department_name FROM designations d LEFT JOIN departments dp ON d.department_id = dp.id WHERE d.is_deleted = 0 ORDER BY d.name');
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_departments')) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.name) return jsonError('Designation name is required', 422);
    const id = uuidv4(); const t = now();
    await execute('INSERT INTO designations (id, department_id, name, description, created_by, created_date, modified_by, modified_date, is_deleted) VALUES (?,?,?,?,?,?,?,?,0)',
      [id, body.department_id || null, body.name, body.description || '', user.email, t, user.email, t]);
    return jsonSuccess({ id, message: 'Designation created' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_departments')) return jsonError('Insufficient permissions', 403);
    const url = new URL(req.url);
    const id = url.pathname.split('/').filter(Boolean).pop();
    const body = await req.json();
    const t = now();
    await execute('UPDATE designations SET name=?, description=?, department_id=?, modified_by=?, modified_date=? WHERE id=?',
      [body.name, body.description || '', body.department_id || null, user.email, t, id]);
    return jsonSuccess({ message: 'Designation updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_departments')) return jsonError('Insufficient permissions', 403);
    const url = new URL(req.url);
    const id = url.pathname.split('/').filter(Boolean).pop();
    await execute('UPDATE designations SET is_deleted = 1 WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Designation deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
