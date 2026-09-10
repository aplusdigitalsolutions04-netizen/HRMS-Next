import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    if (!body.to_email) return jsonError('Recipient email required', 422);
    
    const logId = uuidv4(); const t = now();
    
    const finalSubject = body.subject || '';
    const finalBody = body.body || '';
    
    const success = await sendEmail(
      body.to_email,
      finalSubject,
      finalBody,
      {
        cc: body.cc || undefined,
        bcc: body.bcc || undefined,
        attachments: body.attachments || undefined,
        asUser: { id: user.id, type: user.type },
      }
    );

    const status = success ? 'sent' : 'failed';
    await execute(
      `INSERT INTO email_logs (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [logId, body.candidate_id || null, body.to_email, finalSubject, finalBody, body.cc || '', body.bcc || '', JSON.stringify(body.attachments || []), status, user.email, t]
    );

    if (!success) {
      return jsonError('SMTP email sending failed. Verify your SMTP settings.', 500);
    }

    return jsonSuccess({ id: logId, message: 'Template email sent' });
  } catch (e: any) { return jsonError(e, 500); }
}
