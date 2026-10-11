// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { getAccount, sendFromAccount } from '@/lib/mailbox';
import { auditFrom } from '@/lib/audit';

const MAX_FILE = 10 * 1024 * 1024, MAX_TOTAL = 20 * 1024 * 1024;
const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const EMAIL = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/;
const addresses = (s: string) => String(s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);

// POST multipart: to, cc, bcc, subject, body (plain text), in_reply_to, references, files[]
// Goes out from the person's own mailbox, and a copy shows in their Sent box.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const fd = await req.formData();
    const a = await getAccount(user, String(fd.get('account_id') || '') || null);
    if (!a) return jsonError('Connect your email first', 409);
    const to = String(fd.get('to') || ''), cc = String(fd.get('cc') || ''), bcc = String(fd.get('bcc') || '');
    const subject = String(fd.get('subject') || '').trim().slice(0, 250);
    const body = String(fd.get('body') || '');
    for (const x of [...addresses(to), ...addresses(cc), ...addresses(bcc)]) if (!EMAIL.test(x)) return jsonError(`"${x}" is not a valid email address`, 422);
    if (addresses(to).length === 0) return jsonError('Add at least one recipient in To', 422);
    if (addresses(to).length + addresses(cc).length + addresses(bcc).length > 50) return jsonError('Too many recipients (50 at most)', 422);
    if (!subject && !body.trim()) return jsonError('Write a subject or a message', 422);

    const attachments: any[] = []; let total = 0;
    for (const f of fd.getAll('files')) {
      if (typeof f === 'string' || !f.size) continue;
      total += f.size;
      if (f.size > MAX_FILE) return jsonError(`"${f.name}" is bigger than 10 MB`, 422);
      if (total > MAX_TOTAL) return jsonError('Attachments are bigger than 20 MB in all', 422);
      attachments.push({ filename: f.name, content: Buffer.from(await f.arrayBuffer()), contentType: f.type || undefined });
    }

    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;white-space:pre-wrap">${esc(body)}</div>`;
    const refs = String(fd.get('references') || '').split(/\s+/).filter(Boolean).slice(-10);
    const r = await sendFromAccount(a, { to, cc, bcc, subject: subject || '(no subject)', html, text: body, attachments, inReplyTo: String(fd.get('in_reply_to') || '') || undefined, references: refs });
    await auditFrom(user, 'mail_sent', 'mail', String(user.id), { from: a.sender_email, to: addresses(to).length, subject: subject.slice(0, 80) });
    return jsonSuccess({ message: 'Mail sent', saved_in_sent: r.saved });
  } catch (e: any) { return jsonError(e?.message || e, 502); }
}
