// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const body = await req.json();
    const t = now();
    await execute('UPDATE attendance_templates SET name=?, columns=?, updated_at=? WHERE id=?',
      [body.name, JSON.stringify(body.columns || []), t, id]);
    return jsonSuccess({ message: 'Template updated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('DELETE FROM attendance_templates WHERE id=?', [id]);
    return jsonSuccess({ message: 'Template deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
