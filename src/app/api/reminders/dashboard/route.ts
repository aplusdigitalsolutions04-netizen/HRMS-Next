// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>(
      `SELECT r.*, c.candidate_name, c.email_id as candidate_email FROM email_reminders r LEFT JOIN interview_candidates c ON r.candidate_id=c.id WHERE r.status='ACTIVE' ORDER BY r.reminder_time ASC LIMIT 10`
    );
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}
