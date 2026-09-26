import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { sendEmailDetailed } from './email';
import { uuidv4, now } from './utils';

// Sends a saved email draft, records the attempt in email_logs, and on success
// marks the draft (and any linked employee credentials row) as sent. Shared by
// the Draft Emails "Send" action and the Invite Employee flow so both behave
// identically.
export async function sendDraftById(
  draftId: string,
  user: { id: any; type: any; email: string }
): Promise<{ found: boolean; success: boolean; error?: string; logId?: string }> {
  const drafts = await query<RowDataPacket[]>('SELECT * FROM email_drafts WHERE id=?', [draftId]);
  if (drafts.length === 0) return { found: false, success: false };
  const draft = drafts[0];

  const logId = uuidv4();
  const t = now();

  const { success, error } = await sendEmailDetailed(draft.to_email, draft.subject, draft.body, {
    cc: draft.cc || undefined,
    bcc: draft.bcc || undefined,
    attachments: draft.attachments || undefined,
    asUser: { id: user.id, type: user.type },
  });

  const status = success ? 'sent' : 'failed';
  await execute(
    `INSERT INTO email_logs (id, candidate_id, candidate_name, template_name, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [logId, draft.candidate_id, draft.candidate_name || null, draft.template_name || null, draft.to_email, draft.subject, draft.body, draft.cc, draft.bcc, draft.attachments, status, user.email, t]
  ).catch(async () => {
    // Older schemas without candidate_name / template_name columns.
    await execute(
      `INSERT INTO email_logs (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [logId, draft.candidate_id, draft.to_email, draft.subject, draft.body, draft.cc, draft.bcc, draft.attachments, status, user.email, t]
    );
  });

  if (!success) return { found: true, success: false, error: error || 'unknown error', logId };

  await execute('UPDATE email_drafts SET status=?, updated_at=? WHERE id=?', ['sent', t, draftId]);
  await execute('UPDATE employee_credentials SET status=?, sent_at=? WHERE draft_id=?', ['sent', t, draftId]).catch(() => {});
  return { found: true, success: true, logId };
}
