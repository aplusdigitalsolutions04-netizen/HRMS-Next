// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>(
      'SELECT d.*, dp.name as department_name FROM designations d LEFT JOIN departments dp ON d.department_id = dp.id WHERE d.id = ? AND d.is_deleted = 0',
      [id]
    );
    if (rows.length === 0) return jsonError('Designation not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function PUT(req: NextRequest, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_departments')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json();
    const t = now();
    await execute('UPDATE designations SET name=?, description=?, department_id=?, modified_by=?, modified_date=? WHERE id=?',
      [body.name, body.description || '', body.department_id || null, user.email, t, id]);
    return jsonSuccess({ message: 'Designation updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_departments')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('UPDATE designations SET is_deleted = 1 WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Designation deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
