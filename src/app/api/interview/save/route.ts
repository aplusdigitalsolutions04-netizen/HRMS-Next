// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, hasAnyPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_candidates', 'add_candidate', 'send_candidate_emails'])) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    const id = uuidv4(); const t = now();
    await execute(
      `INSERT INTO interview_details (id, candidate_id, apply_post, interview_round, interview_date, interview_mode, interview_link, status, remarks, comments, user_id, created_on, updated_on) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, body.candidate_id, body.apply_post || '', body.interview_round || 1, body.interview_date || null, body.interview_mode || '', body.interview_link || '', body.status || 'Scheduled', body.remarks || '', body.comments || '', user.email, t, t]
    );
    return jsonSuccess({ success: true, id });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
