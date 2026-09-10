// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Batched version of /api/candidate/[id]/email-status - the Candidate Pool
// list previously fired one request (and 3 sequential queries) per row to
// populate the email-status badge; this does the whole list in 3 queries.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) return jsonSuccess({});

    const placeholders = ids.map(() => '?').join(',');

    const candidates = await query<RowDataPacket[]>(
      `SELECT id, email_id FROM interview_candidates WHERE id IN (${placeholders})`,
      ids
    );

    const logs = await query<RowDataPacket[]>(
      `SELECT candidate_id, id, subject, sent_at FROM email_logs WHERE candidate_id IN (${placeholders}) AND status IN ('sent','resent') ORDER BY sent_at DESC`,
      ids
    );
    const latestLogByCandidate: Record<string, RowDataPacket> = {};
    for (const log of logs) {
      if (!latestLogByCandidate[log.candidate_id]) latestLogByCandidate[log.candidate_id] = log;
    }

    const reminders = await query<RowDataPacket[]>(
      `SELECT * FROM email_reminders WHERE candidate_id IN (${placeholders}) AND (is_deleted=0 OR is_deleted IS NULL) AND status != 'COMPLETED' ORDER BY reminder_time DESC`,
      ids
    );
    const latestReminderByCandidate: Record<string, RowDataPacket> = {};
    for (const r of reminders) {
      if (!latestReminderByCandidate[r.candidate_id]) latestReminderByCandidate[r.candidate_id] = r;
    }

    const drafts = await query<RowDataPacket[]>(
      `SELECT * FROM email_drafts WHERE candidate_id IN (${placeholders}) AND (is_deleted=0 OR is_deleted IS NULL) ORDER BY updated_at DESC`,
      ids
    );
    const latestDraftByCandidate: Record<string, RowDataPacket> = {};
    for (const d of drafts) {
      if (!latestDraftByCandidate[d.candidate_id]) latestDraftByCandidate[d.candidate_id] = d;
    }

    const result: Record<string, any> = {};
    for (const c of candidates) {
      const log = latestLogByCandidate[c.id];
      if (log) {
        result[c.id] = { status: 'email_sent', email_log: log };
        continue;
      }
      const reminder = latestReminderByCandidate[c.id];
      const draft = latestDraftByCandidate[c.id] || null;
      if (reminder) {
        const isOverdue = reminder.reminder_time && new Date(reminder.reminder_time) < new Date();
        result[c.id] = { status: isOverdue ? 'overdue' : 'reminder_active', reminder, draft };
        continue;
      }
      if (draft) {
        result[c.id] = { status: 'draft_saved', draft };
        continue;
      }
      result[c.id] = { status: 'no_email', email_id: c.email_id };
    }

    return jsonSuccess(result);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
