import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM departments WHERE id = ? AND is_deleted = 0', [id]);
    if (rows.length === 0) return jsonError('Department not found', 404);
    return jsonSuccess(rows[0]);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_departments')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json();
    if (!body.name) return jsonError('Department name is required', 422);
    const t = now();
    await execute(
      'UPDATE departments SET name = ?, description = ?, modified_by = ?, modified_date = ? WHERE id = ?',
      [body.name, body.description || '', user.email, t, id]
    );
    return jsonSuccess({ message: 'Department updated' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_departments')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('UPDATE departments SET is_deleted = 1 WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Department deleted' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
