// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const { id } = await params;
    await execute('DELETE FROM email_logs WHERE id=?', [id]);
    return jsonSuccess({ message: 'Log deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
