// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM interview_candidates WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Candidate not found', 404);
    
    const interviews = await query<RowDataPacket[]>('SELECT * FROM interview_details WHERE candidate_id=? ORDER BY created_on ASC', [id]);
    const latest = interviews.length > 0 ? interviews[interviews.length - 1] : null;
    const previous = interviews.length > 1 ? interviews.slice(0, -1) : [];
    
    return jsonSuccess({
      ...rows[0],
      current_interview: latest,
      previous_interviews: previous,
      interviews
    });
  } catch (e: any) { return jsonError(e, 500); }
}
