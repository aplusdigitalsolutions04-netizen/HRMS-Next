import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_drafts')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    
    const drafts = await query<RowDataPacket[]>('SELECT * FROM email_drafts WHERE id=?', [id]);
    if (drafts.length === 0) return jsonError('Draft not found', 404);
    const draft = drafts[0];
    
    const logId = uuidv4(); const t = now();
    
    const success = await sendEmail(
      draft.to_email,
      draft.subject,
      draft.body,
      {
        cc: draft.cc || undefined,
        bcc: draft.bcc || undefined,
        attachments: draft.attachments || undefined,
        asUser: { id: user.id, type: user.type },
      }
    );

    const status = success ? 'sent' : 'failed';
    await execute(
      `INSERT INTO email_logs (id, candidate_id, candidate_name, template_name, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [logId, draft.candidate_id, draft.candidate_name || null, draft.template_name || null, draft.to_email, draft.subject, draft.body, draft.cc, draft.bcc, draft.attachments, status, user.email, t]
    ).catch(async (err) => {
      // Fallback if candidate_name or template_name columns don't exist in older schemas
      await execute(
        `INSERT INTO email_logs (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [logId, draft.candidate_id, draft.to_email, draft.subject, draft.body, draft.cc, draft.bcc, draft.attachments, status, user.email, t]
      );
    });

    if (!success) {
      return jsonError('SMTP email sending failed. Verify your SMTP settings.', 500);
    }

    await execute('UPDATE email_drafts SET status=?, updated_at=? WHERE id=?', ['sent', t, id]);
    await execute('UPDATE employee_credentials SET status=?, sent_at=? WHERE draft_id=?', ['sent', t, id]).catch(() => {});
    return jsonSuccess({ id: logId, message: 'Email sent' });
  } catch (e: any) { return jsonError(e, 500); }
}
