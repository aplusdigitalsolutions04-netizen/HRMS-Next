// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    // Deactivate all, then activate the selected one
    await execute('UPDATE attendance_templates SET is_active = 0');
    await execute('UPDATE attendance_templates SET is_active = 1 WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Template activated' });
  } catch (e: any) { return jsonError(e, 500); }
}
