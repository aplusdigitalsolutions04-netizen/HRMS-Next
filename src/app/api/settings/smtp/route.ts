// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>('SELECT * FROM smtp_settings LIMIT 1');
    if (rows.length > 0) {
      const r = rows[0];
      // Mask password for security
      if (r.app_password) r.app_password = '********';
      return jsonSuccess(r);
    }
    return jsonSuccess({
      smtp_host: '',
      smtp_port: 587,
      sender_email: '',
      sender_name: '',
      app_password: '',
      encryption: 'TLS',
      default_cc_emails: '',
      default_bcc_emails: ''
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    const existing = await query<RowDataPacket[]>('SELECT id, app_password FROM smtp_settings LIMIT 1');
    const t = now();
    
    let pwd = body.app_password;
    if (existing.length > 0) {
      if (!pwd || pwd === '********') {
        pwd = existing[0].app_password;
      }
    }

    if (existing.length > 0) {
      await execute('UPDATE smtp_settings SET smtp_host=?, smtp_port=?, sender_email=?, sender_name=?, app_password=?, encryption=?, default_cc_emails=?, default_bcc_emails=?, updated_on=? WHERE id=?',
        [
          body.smtp_host || '',
          body.smtp_port || 587,
          body.sender_email || '',
          body.sender_name || '',
          pwd || '',
          body.encryption || 'TLS',
          body.default_cc_emails || '',
          body.default_bcc_emails || '',
          t,
          existing[0].id
        ]);
    } else {
      await execute('INSERT INTO smtp_settings (smtp_host, smtp_port, sender_email, sender_name, app_password, encryption, default_cc_emails, default_bcc_emails, updated_on) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          body.smtp_host || '',
          body.smtp_port || 587,
          body.sender_email || '',
          body.sender_name || '',
          pwd || '',
          body.encryption || 'TLS',
          body.default_cc_emails || '',
          body.default_bcc_emails || '',
          t
        ]);
    }
    return jsonSuccess({ message: 'SMTP settings saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
