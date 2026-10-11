// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const body = await req.json();
    if ((!body.interview_id && !body.candidate_id) || !body.status) return jsonError('Interview ID and status required', 422);

    // The page sends the exact interview round; older callers send only the candidate (then the latest round is used).
    const sets = 'status=?, updated_on=?' + (body.remarks !== undefined ? ', remarks=?' : '') + (body.comments !== undefined ? ', comments=?' : '');
    const vals: any[] = [body.status, now()];
    if (body.remarks !== undefined) vals.push(body.remarks);
    if (body.comments !== undefined) vals.push(body.comments);

    let r: any;
    if (body.interview_id) {
      r = await execute(`UPDATE interview_details SET ${sets} WHERE id=?`, [...vals, body.interview_id]);
    } else {
      r = await execute(`UPDATE interview_details SET ${sets} WHERE candidate_id=? AND id=(SELECT id FROM (SELECT id FROM interview_details WHERE candidate_id=? ORDER BY interview_round DESC, created_on DESC LIMIT 1) t)`, [...vals, body.candidate_id, body.candidate_id]);
    }
    if (r && r.affectedRows === 0) return jsonError('Interview not found', 404);
    return jsonSuccess({ message: 'Interview status updated' });
  } catch (e: any) { return jsonError(e, 500); }
}
