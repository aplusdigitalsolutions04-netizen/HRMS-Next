// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'delete_candidate')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('DELETE FROM interview_details WHERE candidate_id=?', [id]);
    await execute('DELETE FROM email_logs WHERE candidate_id=?', [id]);
    await execute('DELETE FROM email_drafts WHERE candidate_id=?', [id]);
    await execute('DELETE FROM email_reminders WHERE candidate_id=?', [id]);
    await execute('DELETE FROM interview_candidates WHERE id=?', [id]);
    return jsonSuccess({ success: true, message: 'Candidate deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}
