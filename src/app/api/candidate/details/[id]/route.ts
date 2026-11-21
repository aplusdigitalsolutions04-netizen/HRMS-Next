// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, hasAnyPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { resumeMissing } from '@/lib/resume-status';

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_candidates', 'add_candidate', 'send_candidate_emails', 'delete_candidate'])) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const rows = await query<RowDataPacket[]>('SELECT * FROM interview_candidates WHERE id=?', [id]);
    if (rows.length === 0) return jsonError('Candidate not found', 404);
    
    const interviews = await query<RowDataPacket[]>('SELECT * FROM interview_details WHERE candidate_id=? ORDER BY created_on ASC', [id]);
    const latest = interviews.length > 0 ? interviews[interviews.length - 1] : null;
    const previous = interviews.length > 1 ? interviews.slice(0, -1) : [];
    
    return jsonSuccess({
      ...rows[0],
      resume_missing: resumeMissing(rows[0].resume_pdf_path),
      current_interview: latest,
      previous_interviews: previous,
      interviews
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
