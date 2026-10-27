// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmailDetailed } from '@/lib/email';
import { auditFrom } from '@/lib/audit';

const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A follow-up mail to a candidate who has not answered. It goes out from the HR person's own connected email, or from the
// company account when they have none (HR's own address). The follow-up counter goes up only when the mail was sent.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_candidates')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const c = (await query<RowDataPacket[]>('SELECT id, candidate_name, email_id, no_response FROM interview_candidates WHERE id = ?', [id]))[0];
    if (!c) return jsonError('Candidate not found', 404);
    if (!c.email_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email_id)) return jsonError('This candidate has no valid email address', 422);
    const subject = String(b.subject || '').trim().slice(0, 200), message = String(b.message || '').trim().slice(0, 5000);
    if (!subject || !message) return jsonError('Write the subject and the message', 422);

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>`;
    const r = await sendEmailDetailed(c.email_id, subject, html, { asUser: { id: user.id, type: user.type } });
    if (!r.success) return jsonError(r.error || 'The mail could not be sent', 502);

    await execute('UPDATE interview_candidates SET follow_up_count = COALESCE(follow_up_count, 0) + 1, last_follow_up_on = NOW() WHERE id = ?', [id]);
    await auditFrom(user, 'candidate_follow_up_sent', 'candidate', id, { name: c.candidate_name });
    return jsonSuccess({ message: 'Follow-up mail sent' });
  } catch (e: any) { return jsonError(e, 500); }
}
