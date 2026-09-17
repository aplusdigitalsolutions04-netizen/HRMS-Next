// @ts-nocheck
import nodemailer from 'nodemailer';
import { query } from './db';
import { RowDataPacket } from 'mysql2';

interface SmtpRow extends RowDataPacket {
  smtp_host: string;
  smtp_port: number;
  sender_email: string;
  sender_name: string;
  app_password: string;
  encryption: string;
}

// Templates and drafts are authored as plain text (a <textarea>, not a rich
// HTML editor) - they contain literal newlines and manually-typed bullets.
// HTML collapses bare whitespace, so sending that text as-is renders as one
// run-on paragraph. If the content doesn't already look like real HTML
// markup, wrap it so newlines/indentation are preserved as the author typed
// them, instead of touching every call site that composes an email body.
function toHtmlBody(content: string): string {
  if (/<\/?(p|div|br|table|tr|td|ul|ol|li|h[1-6])\b/i.test(content)) {
    return content;
  }
  return `<div style="white-space:pre-line;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">${content}</div>`;
}

async function resolveSmtpConfig(asUser?: { id: string; type: string }): Promise<SmtpRow | null> {
  if (asUser?.id) {
    const personal = await query<SmtpRow[]>(
      'SELECT * FROM user_email_accounts WHERE user_id=? AND user_type=?',
      [asUser.id, asUser.type]
    );
    if (personal.length > 0) return personal[0];
  }

  const rows = await query<SmtpRow[]>('SELECT * FROM smtp_settings LIMIT 1');
  return rows.length > 0 ? rows[0] : null;
}

function buildTransporter(s: SmtpRow) {
  const secure = (s.encryption || '').toUpperCase() === 'SSL';
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port || (secure ? 465 : 587),
    secure,
    auth: {
      user: s.sender_email,
      pass: s.app_password,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

// Checks that the SMTP host/credentials actually authenticate, without
// sending any mail - used by the "Test Connection" buttons so testing
// doesn't spam an inbox every time someone clicks it.
export async function verifyEmailConnection(
  asUser?: { id: string; type: string }
): Promise<{ ok: boolean; message: string }> {
  try {
    const s = await resolveSmtpConfig(asUser);
    if (!s) {
      return { ok: false, message: 'No SMTP settings configured.' };
    }
    if (!s.smtp_host || !s.sender_email || !s.app_password) {
      return { ok: false, message: 'Incomplete SMTP configuration (missing host/sender/password).' };
    }

    const transporter = buildTransporter(s);
    await transporter.verify();
    return { ok: true, message: `Connected to ${s.smtp_host} as ${s.sender_email}.` };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Connection failed.' };
  }
}

interface SendEmailOptions {
  cc?: string;
  bcc?: string;
  attachments?: any;
  // If the acting user has connected their own webmail account (see
  // user_email_accounts / Profile > "My Email Account"), send through it
  // instead of the shared company SMTP account.
  asUser?: { id: string; type: string };
}

// Same as sendEmail, but returns the actual SMTP error instead of a bare
// boolean - callers that surface failures to the user (rather than just
// logging "sent"/"failed") should use this so the error isn't stuck in
// server logs the user can't see on a live deployment.
export async function sendEmailDetailed(
  to: string,
  subject: string,
  html: string,
  options?: SendEmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const s = await resolveSmtpConfig(options?.asUser);
    if (!s) {
      return { success: false, error: 'No SMTP settings configured.' };
    }

    if (!s.smtp_host || !s.sender_email || !s.app_password) {
      return { success: false, error: 'Incomplete SMTP configuration (missing host/sender/password).' };
    }

    const transporter = buildTransporter(s);

    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      console.warn('[email] transporter.verify() warning (continuing):', verifyErr?.message || verifyErr);
    }

    const mailOptions: any = {
      from: s.sender_name ? `"${s.sender_name}" <${s.sender_email}>` : s.sender_email,
      to,
      subject,
      html: toHtmlBody(html),
    };

    if (options?.cc) mailOptions.cc = options.cc;
    if (options?.bcc) mailOptions.bcc = options.bcc;

    if (options?.attachments) {
      let atts = options.attachments;
      if (typeof atts === 'string') {
        try { atts = JSON.parse(atts); } catch { atts = []; }
      }
      if (Array.isArray(atts)) {
        mailOptions.attachments = atts.map(a => {
          const res: any = {};
          if (a.filename) res.filename = a.filename;
          if (a.path) res.path = a.path;
          if (a.content) res.content = a.content;
          if (a.contentType) res.contentType = a.contentType;
          // Referenced from the HTML body as <img src="cid:...">. Most email
          // clients (Gmail included) block/strip data: URI images outright,
          // but will render a cid-referenced inline attachment.
          if (a.cid) res.cid = a.cid;
          if (a.encoding) res.encoding = a.encoding;
          return res;
        });
      }
    }

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (e: any) {
    console.error('[email] Send failed:', e?.message || e);
    return { success: false, error: e?.message || 'Send failed.' };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: SendEmailOptions
): Promise<boolean> {
  const result = await sendEmailDetailed(to, subject, html, options);
  return result.success;
}
