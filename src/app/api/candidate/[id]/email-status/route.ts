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

    const candidates = await query<RowDataPacket[]>('SELECT * FROM interview_candidates WHERE id=?', [id]);
    if (candidates.length === 0) return jsonError('Candidate not found', 404);

    // 1. Already sent an email to this candidate?
    const logs = await query<RowDataPacket[]>(
      `SELECT id, subject, sent_at FROM email_logs WHERE candidate_id=? AND status IN ('sent','resent') ORDER BY sent_at DESC LIMIT 1`,
      [id]
    );
    if (logs.length > 0) {
      return jsonSuccess({ status: 'email_sent', email_log: logs[0] });
    }

    // 2. Active (incomplete) reminder for this candidate?
    const reminders = await query<RowDataPacket[]>(
      `SELECT * FROM email_reminders WHERE candidate_id=? AND (is_deleted=0 OR is_deleted IS NULL) AND status != 'COMPLETED' ORDER BY reminder_time DESC LIMIT 1`,
      [id]
    );

    // 3. Saved draft for this candidate?
    const drafts = await query<RowDataPacket[]>(
      `SELECT * FROM email_drafts WHERE candidate_id=? AND (is_deleted=0 OR is_deleted IS NULL) ORDER BY updated_at DESC LIMIT 1`,
      [id]
    );
    const draft = drafts[0] || null;

    if (reminders.length > 0) {
      const reminder = reminders[0];
      const isOverdue = reminder.reminder_time && new Date(reminder.reminder_time) < new Date();
      return jsonSuccess({ status: isOverdue ? 'overdue' : 'reminder_active', reminder, draft });
    }

    if (draft) {
      return jsonSuccess({ status: 'draft_saved', draft });
    }

    return jsonSuccess({ status: 'no_email', email_id: candidates[0].email_id });
  } catch (e: any) { return jsonError(e, 500); }
}
