// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, checkPermission, hasAnyPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_candidates', 'add_candidate', 'send_candidate_emails', 'delete_candidate'])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM interview_candidates WHERE id = ?', [id]);
    if (rows.length === 0) return jsonError('Candidate not found', 404);
    const interviews = await query<RowDataPacket[]>('SELECT * FROM interview_details WHERE candidate_id = ? ORDER BY created_on DESC', [id]);
    return jsonSuccess({ ...rows[0], interviews: interviews || [] });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_candidates', 'add_candidate', 'send_candidate_emails', 'delete_candidate'])) return jsonError('Insufficient permissions', 403);
    if (!checkPermission(user, 'delete_candidate')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    await execute('DELETE FROM interview_details WHERE candidate_id = ?', [id]);
    await execute('DELETE FROM email_logs WHERE candidate_id = ?', [id]);
    await execute('DELETE FROM email_drafts WHERE candidate_id = ?', [id]);
    await execute('DELETE FROM email_reminders WHERE candidate_id = ?', [id]);
    await execute('DELETE FROM interview_candidates WHERE id = ?', [id]);
    return jsonSuccess({ message: 'Candidate deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const DELETE = withApiLog(DELETE_handler);
