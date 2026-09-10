// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_documents')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('UPDATE document_approvals SET action=?, reviewed_by=?, reviewed_at=? WHERE id=?', ['denied', user.email, now(), id]);
    return jsonSuccess({ message: 'Document denied' });
  } catch (e: any) { return jsonError(e, 500); }
}
