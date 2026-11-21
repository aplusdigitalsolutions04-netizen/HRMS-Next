// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, hasAnyPermission } from '@/lib/utils';
import { execute } from '@/lib/db';

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_email_logs'])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('DELETE FROM email_logs WHERE id=?', [id]);
    return jsonSuccess({ message: 'Log deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const DELETE = withApiLog(DELETE_handler);
