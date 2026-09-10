// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    if (!body.candidate_id || !body.status) return jsonError('Candidate ID and status required', 422);
    await execute('UPDATE interview_details SET status=?, updated_on=? WHERE candidate_id=? AND id=(SELECT MAX(id) FROM interview_details WHERE candidate_id=?)',
      [body.status, now(), body.candidate_id, body.candidate_id]);
    return jsonSuccess({ message: 'Interview status updated' });
  } catch (e: any) { return jsonError(e, 500); }
}
