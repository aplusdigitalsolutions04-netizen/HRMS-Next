// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { execute } from '@/lib/db';

async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    // Deactivate all, then activate the selected one
    await execute('UPDATE attendance_templates SET is_active = 0');
    await execute('UPDATE attendance_templates SET is_active = 1 WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Template activated' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
