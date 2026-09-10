// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    await execute('UPDATE notifications SET is_read=1', []);
    return jsonSuccess({ message: 'All marked as read' });
  } catch (e: any) { return jsonError(e, 500); }
}
