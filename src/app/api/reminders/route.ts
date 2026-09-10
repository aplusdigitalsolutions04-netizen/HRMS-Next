// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const { page, perPage, offset } = parsePagination(searchParams, 20);
    
    const cnt = await query<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM email_reminders');
    const rows = await query<RowDataPacket[]>(`SELECT r.*, c.candidate_name, c.email_id as candidate_email FROM email_reminders r LEFT JOIN interview_candidates c ON r.candidate_id=c.id ORDER BY r.created_at DESC LIMIT ${perPage} OFFSET ${offset}`);
    return jsonSuccess({ reminders: rows, total: cnt[0].cnt, page, per_page: perPage });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    if (!body.candidate_id) return jsonError('Candidate ID required', 422);
    
    await query(
      `INSERT INTO email_reminders (id, candidate_id, reminder_time, delay_minutes, status, created_by, created_at, updated_at) VALUES (UUID(),?,?,?,?,?,NOW(),NOW())`,
      [body.candidate_id, body.reminder_time || new Date(Date.now() + 30*60000).toISOString(), body.delay_minutes || 30, 'ACTIVE', user.email]
    );
    return jsonSuccess({ message: 'Reminder created' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}
