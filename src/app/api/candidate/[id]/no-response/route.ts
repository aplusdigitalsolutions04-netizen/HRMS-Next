// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

// A candidate who does not answer after an interview call/mail is moved out of the Candidate Pool to the No Response
// list, and moved back when they answer.
//   POST { action: 'mark', note? }   -> No Response list
//   POST { action: 'responded' }     -> back to the Candidate Pool
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_candidates')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const c = (await query<RowDataPacket[]>('SELECT id, candidate_name, no_response FROM interview_candidates WHERE id = ?', [id]))[0];
    if (!c) return jsonError('Candidate not found', 404);

    if (b.action === 'mark') {
      if (Number(c.no_response) === 1) return jsonError('This candidate is already in No Response', 409);
      const note = String(b.note || '').trim().slice(0, 300);
      await execute('UPDATE interview_candidates SET no_response = 1, no_response_on = NOW(), no_response_note = ?, follow_up_count = 0, last_follow_up_on = NULL WHERE id = ?', [note || null, id]);
      await auditFrom(user, 'candidate_no_response', 'candidate', id, { name: c.candidate_name, note });
      return jsonSuccess({ message: `${c.candidate_name} moved to No Response` });
    }
    if (b.action === 'responded') {
      await execute('UPDATE interview_candidates SET no_response = 0, no_response_on = NULL, no_response_note = NULL, follow_up_count = 0, last_follow_up_on = NULL WHERE id = ?', [id]);
      await auditFrom(user, 'candidate_responded', 'candidate', id, { name: c.candidate_name });
      return jsonSuccess({ message: `${c.candidate_name} is back in the Candidate Pool` });
    }
    return jsonError('action must be mark or responded', 422);
  } catch (e: any) { return jsonError(e, 500); }
}
