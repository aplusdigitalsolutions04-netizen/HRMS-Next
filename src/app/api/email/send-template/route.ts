import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmailDetailed } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const body = await req.json();
    if (!body.to_email) return jsonError('Recipient email required', 422);
    
    const logId = uuidv4(); const t = now();
    
    const finalSubject = body.subject || '';
    const finalBody = body.body || '';
    
    const { success, error, rejected } = await sendEmailDetailed(
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
    // the candidate and template names are kept so Email Logs can show who the mail went to
    let candName = String(body.candidate_name || '').trim() || null;
    if (!candName && body.candidate_id) {
      candName = (await query<RowDataPacket[]>('SELECT candidate_name FROM interview_candidates WHERE id=?', [body.candidate_id]).catch(() => []))[0]?.candidate_name || null;
    }
    const tplName = String(body.template_name || '').trim() || null;
    await execute(
      `INSERT INTO email_logs (id, candidate_id, candidate_name, template_name, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [logId, body.candidate_id || null, candName, tplName, body.to_email, finalSubject, finalBody, body.cc || '', body.bcc || '', JSON.stringify(body.attachments || []), status, user.email, t]
    );

    if (!success) {
      return jsonError(`Email sending failed: ${error || 'unknown error'}`, 500);
    }

    return jsonSuccess({ id: logId, message: rejected && rejected.length ? `Sent, but the mail server refused: ${rejected.join(', ')}` : 'Template email sent' });
  } catch (e: any) { return jsonError(e, 500); }
}
