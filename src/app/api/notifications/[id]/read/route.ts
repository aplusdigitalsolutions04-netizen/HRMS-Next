// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    await execute('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Marked as read' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
