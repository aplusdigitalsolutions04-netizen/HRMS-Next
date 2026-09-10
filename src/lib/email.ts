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

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options?: {
    cc?: string;
    bcc?: string;
    attachments?: any;
    // If the acting user has connected their own webmail account (see
    // user_email_accounts / Profile > "My Email Account"), send through it
    // instead of the shared company SMTP account.
    asUser?: { id: string; type: string };
  }
): Promise<boolean> {
  try {
    let s: SmtpRow | undefined;

    if (options?.asUser?.id) {
      const personal = await query<SmtpRow[]>(
        'SELECT * FROM user_email_accounts WHERE user_id=? AND user_type=?',
        [options.asUser.id, options.asUser.type]
      );
      if (personal.length > 0) s = personal[0];
    }

    if (!s) {
      const rows = await query<SmtpRow[]>('SELECT * FROM smtp_settings LIMIT 1');
      if (rows.length === 0) {
        console.error('[email] No SMTP settings configured');
        return false;
      }
      s = rows[0];
    }

    if (!s.smtp_host || !s.sender_email || !s.app_password) {
      console.error('[email] Incomplete SMTP configuration (missing host/sender/password)');
      return false;
    }

    const secure = (s.encryption || '').toUpperCase() === 'SSL';
    const transporter = nodemailer.createTransport({
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
          return res;
        });
      }
    }

    await transporter.sendMail(mailOptions);
    return true;
  } catch (e: any) {
    console.error('[email] Send failed:', e?.message || e);
    return false;
  }
}
