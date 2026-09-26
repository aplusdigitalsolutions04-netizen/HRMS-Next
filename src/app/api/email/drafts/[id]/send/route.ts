import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { sendDraftById } from '@/lib/draft-send';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_drafts')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;

    const result = await sendDraftById(id, user);
    if (!result.found) return jsonError('Draft not found', 404);
    if (!result.success) return jsonError(`Email sending failed: ${result.error}`, 500);
    return jsonSuccess({ id: result.logId, message: 'Email sent' });
  } catch (e: any) { return jsonError(e, 500); }
}
