// @ts-nocheck
import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { query } from './db';
import { RowDataPacket } from 'mysql2';

// A person's own mailbox: they connect their email (or webmail) once, then read the Inbox and Sent box and
// send mail from it. The password is stored encrypted. Hosts that point inside the server's own network are
// refused, so the connect form cannot be used to probe internal machines.

/* ── password at rest ── */
const KEY = () => crypto.createHash('sha256').update(String(process.env.JWT_SECRET || 'hrms-mail-key')).digest();
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return 'enc:v1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
// Older rows hold the plain password; those pass through unchanged.
export function decryptSecret(v: string): string {
  if (!v || !String(v).startsWith('enc:v1:')) return v;
  try {
    const buf = Buffer.from(String(v).slice(7), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch { return ''; }
}

/* ── no private hosts ── */
const privateIp = (ip: string) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const x = ip.toLowerCase();
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:127.') || x.startsWith('::ffff:10.') || x.startsWith('::ffff:192.168.');
};
export async function assertPublicHost(host: string) {
  const h = String(host || '').trim().toLowerCase();
  if (!h) throw new Error('Server name is required');
  if (!/^[a-z0-9.-]+$/.test(h) && !net.isIP(h)) throw new Error('That server name does not look right');
  if (process.env.NODE_ENV !== 'production') return; // local testing against a dev mail server
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('That server is not allowed');
  const addrs = net.isIP(h) ? [{ address: h }] : await dns.lookup(h, { all: true }).catch(() => { throw new Error(`Could not find the server "${h}"`); });
  if (addrs.some(a => privateIp(a.address))) throw new Error('That server is not allowed');
}

/* ── the account ── */
export interface MailAccount { id: string; is_default?: number; sender_email: string; sender_name: string; app_password: string; smtp_host: string; smtp_port: number; encryption: string; imap_host: string; imap_port: number; }

const asAccount = (row: any): MailAccount => ({ ...row, app_password: decryptSecret(row.app_password), imap_port: row.imap_port || 993 });

// All of a person's connected emails, the default one first.
export async function getAccounts(user: { id: any; type: string }): Promise<MailAccount[]> {
  const r = await query<RowDataPacket[]>('SELECT * FROM user_email_accounts WHERE user_id = ? AND user_type = ? ORDER BY is_default DESC, created_at ASC', [user.id, user.type]);
  return r.map(asAccount);
}

// The account with this id, or (no id) the default one. An id that belongs to somebody else finds nothing.
export async function getAccount(user: { id: any; type: string }, accountId?: string | null): Promise<MailAccount | null> {
  const list = await getAccounts(user);
  if (accountId) return list.find(a => String(a.id) === String(accountId)) || null;
  return list[0] || null;
}

const smtpTransport = (a: MailAccount) => {
  const secure = String(a.encryption || '').toUpperCase() === 'SSL';
  return nodemailer.createTransport({
    host: a.smtp_host, port: a.smtp_port || (secure ? 465 : 587), secure,
    auth: { user: a.sender_email, pass: a.app_password },
    tls: { rejectUnauthorized: false }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 25000,
  });
};

async function withImap<T>(a: MailAccount, fn: (c: any) => Promise<T>): Promise<T> {
  if (!a.imap_host) throw new Error('Incoming mail server (IMAP) is not set for this account. Open Account settings and add it.');
  await assertPublicHost(a.imap_host);
  const port = a.imap_port || 993;
  const c = new ImapFlow({
    host: a.imap_host, port, secure: port === 993,
    auth: { user: a.sender_email, pass: a.app_password },
    logger: false, tls: { rejectUnauthorized: false },
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  });
  c.on('error', () => {});
  try { await c.connect(); } catch (e: any) { throw new Error(friendly(e)); }
  try { return await fn(c); } finally { try { await c.logout(); } catch { /* closed */ } }
}
const friendly = (e: any) => {
  const m = String(e?.responseText || e?.message || e);
  if (/AUTHENTICATIONFAILED|Invalid credentials|auth.*fail|Login failed|LOGIN/i.test(m + ' ' + (e?.authenticationFailed ? 'AUTH' : ''))) return 'Sign in failed. Check the email and the password (Gmail and Outlook need an app password).';
  if (/ENOTFOUND|EAI_AGAIN/.test(m)) return 'Could not find the mail server. Check the server name.';
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(m)) return 'Could not reach the mail server. Check the server name and port.';
  return m.slice(0, 200);
};

/* ── connect and check (before saving) ── */
export async function testAccount(a: MailAccount): Promise<{ smtp: string; imap: string }> {
  await assertPublicHost(a.smtp_host);
  try { await smtpTransport(a).verify(); } catch (e: any) { throw new Error('Sending (SMTP): ' + friendly(e)); }
  await withImap(a, async (c) => { await c.mailboxOpen('INBOX', { readOnly: true }); }).catch((e: any) => { throw new Error('Receiving (IMAP): ' + e.message); });
  return { smtp: 'ok', imap: 'ok' };
}

/* ── folders ── */
const SENT_NAMES = ['Sent', 'Sent Items', 'Sent Mail', '[Gmail]/Sent Mail', 'INBOX.Sent', 'Sent Messages'];
async function folderPath(c: any, which: 'inbox' | 'sent'): Promise<string> {
  if (which === 'inbox') return 'INBOX';
  const list = await c.list();
  const special = list.find((m: any) => m.specialUse === '\\Sent');
  if (special) return special.path;
  const byName = SENT_NAMES.find(n => list.some((m: any) => m.path.toLowerCase() === n.toLowerCase()));
  if (byName) return list.find((m: any) => m.path.toLowerCase() === byName.toLowerCase()).path;
  // some servers hide folders from LIST: ask for the usual names directly
  for (const n of SENT_NAMES) { try { await c.status(n, { messages: true }); return n; } catch { /* not there */ } }
  throw new Error('No Sent folder was found in this mailbox');
}
const addr = (x: any) => (x ? { name: x.name || '', address: x.address || '' } : { name: '', address: '' });

export async function listMessages(a: MailAccount, which: 'inbox' | 'sent', o: { page: number; perPage: number; search?: string }) {
  return withImap(a, async (c) => {
    const path = await folderPath(c, which);
    const lock = await c.getMailboxLock(path, { readOnly: true });
    try {
      let total = c.mailbox.exists, range: any, useUid = false, uids: number[] = [];
      const q = String(o.search || '').trim();
      if (q) {
        uids = ((await c.search({ or: [{ subject: q }, { from: q }, { to: q }] }, { uid: true })) || []).sort((x: number, y: number) => y - x);
        total = uids.length;
        const slice = uids.slice((o.page - 1) * o.perPage, o.page * o.perPage);
        if (slice.length === 0) return { messages: [], total: 0, folder: path };
        range = slice.join(','); useUid = true;
      } else {
        if (total === 0) return { messages: [], total: 0, folder: path };
        const end = total - (o.page - 1) * o.perPage, start = Math.max(1, end - o.perPage + 1);
        if (end < 1) return { messages: [], total, folder: path };
        range = `${start}:${end}`;
      }
      const out: any[] = [];
      for await (const m of c.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: useUid })) {
        out.push({
          uid: m.uid, subject: m.envelope?.subject || '(no subject)', date: (m.envelope?.date || m.internalDate || null),
          from: addr((m.envelope?.from || [])[0]), to: (m.envelope?.to || []).map(addr), seen: m.flags?.has('\\Seen') || false,
        });
      }
      out.sort((x, y) => y.uid - x.uid);
      return { messages: out, total, folder: path };
    } finally { lock.release(); }
  });
}

async function fetchParsed(c: any, path: string, uid: number, markSeen: boolean) {
  const lock = await c.getMailboxLock(path, { readOnly: !markSeen });
  try {
    const msg = await c.fetchOne(String(uid), { source: true }, { uid: true });
    if (!msg || !msg.source) throw new Error('Message not found');
    const parsed = await simpleParser(msg.source);
    if (markSeen) { try { await c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }); } catch { /* read-only */ } }
    return parsed;
  } finally { lock.release(); }
}

export async function readMessage(a: MailAccount, which: 'inbox' | 'sent', uid: number) {
  return withImap(a, async (c) => {
    const path = await folderPath(c, which);
    const p = await fetchParsed(c, path, uid, true);
    let html = p.html || '';
    // pictures inside the mail (cid:) become small inline images; remote pictures stay blocked by the page
    if (html) {
      for (const at of p.attachments || []) {
        if (at.cid && /^image\//.test(at.contentType || '') && at.size < 2_000_000) {
          html = html.split(`cid:${at.cid}`).join(`data:${at.contentType};base64,${at.content.toString('base64')}`);
        }
      }
    }
    const list = (x: any) => (x?.value || []).map(addr);
    return {
      uid, subject: p.subject || '(no subject)', date: p.date || null, from: addr(p.from?.value?.[0]), to: list(p.to), cc: list(p.cc),
      messageId: p.messageId || '', references: p.references || [],
      html: html || '', text: p.text || '',
      attachments: (p.attachments || []).map((at: any, i: number) => ({ index: i, filename: at.filename || `attachment-${i + 1}`, size: at.size || 0, contentType: at.contentType || 'application/octet-stream', inline: !!at.related })),
    };
  });
}

export async function getAttachment(a: MailAccount, which: 'inbox' | 'sent', uid: number, index: number) {
  return withImap(a, async (c) => {
    const path = await folderPath(c, which);
    const p = await fetchParsed(c, path, uid, false);
    const at = (p.attachments || [])[index];
    if (!at) throw new Error('Attachment not found');
    return { filename: at.filename || `attachment-${index + 1}`, contentType: at.contentType || 'application/octet-stream', content: at.content };
  });
}

/* ── send ── */
const SAVES_SENT_ITSELF = /gmail|googlemail|office365|outlook|hotmail|yahoo/i;
export async function sendFromAccount(a: MailAccount, m: { to: string; cc?: string; bcc?: string; subject: string; html: string; text?: string; attachments?: any[]; inReplyTo?: string; references?: string[] }) {
  await assertPublicHost(a.smtp_host);
  const from = a.sender_name ? { name: a.sender_name, address: a.sender_email } : a.sender_email;
  const mail: any = { from, to: m.to, cc: m.cc || undefined, bcc: m.bcc || undefined, subject: m.subject, html: m.html, text: m.text, attachments: m.attachments || [] };
  if (m.inReplyTo) { mail.inReplyTo = m.inReplyTo; mail.references = m.references && m.references.length ? m.references : [m.inReplyTo]; }
  const raw: Buffer = await new MailComposer(mail).compile().build();
  const split = (s?: string) => String(s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
  const rcpt = [...split(m.to), ...split(m.cc), ...split(m.bcc)];
  try {
    await smtpTransport(a).sendMail({ envelope: { from: a.sender_email, to: rcpt }, raw });
  } catch (e: any) { throw new Error('Could not send: ' + friendly(e)); }
  // providers that do not file a copy themselves: put it in Sent so it shows in the Sent box
  let saved = true;
  if (!SAVES_SENT_ITSELF.test(a.smtp_host) && a.imap_host) {
    saved = await withImap(a, async (c) => { const path = await folderPath(c, 'sent'); await c.append(path, raw, ['\\Seen']); return true; }).catch(() => false);
  }
  return { saved };
}
