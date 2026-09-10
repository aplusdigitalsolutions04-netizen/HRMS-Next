// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    await execute('DELETE FROM email_logs WHERE id=?', [id]);
    return jsonSuccess({ message: 'Log deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
