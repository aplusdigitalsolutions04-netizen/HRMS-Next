import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const logs = await query<RowDataPacket[]>('SELECT * FROM email_logs WHERE id=?', [id]);
    if (logs.length === 0) return jsonError('Log not found', 404);
    const log = logs[0];
    
    const newId = uuidv4(); const t = now();
    
    const success = await sendEmail(
      log.to_email,
      log.subject,
      log.body,
      {
        cc: log.cc || undefined,
        bcc: log.bcc || undefined,
        attachments: log.attachments || undefined,
        asUser: { id: user.id, type: user.type },
      }
    );

    const status = success ? 'resent' : 'failed';
    await execute(
      `INSERT INTO email_logs (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [newId, log.candidate_id, log.to_email, log.subject, log.body, log.cc, log.bcc, log.attachments, status, user.email, t]
    );

    if (!success) {
      return jsonError('SMTP email sending failed. Verify your SMTP settings.', 500);
    }

    return jsonSuccess({ id: newId, message: 'Email resent' });
  } catch (e: any) { return jsonError(e, 500); }
}
