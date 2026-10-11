// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4 } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { encryptSecret, getAccount, getAccounts, testAccount, assertPublicHost } from '@/lib/mailbox';
import { auditFrom } from '@/lib/audit';

// The signed-in person's own mailboxes (employee or HR). A person can connect several emails; one is the default.
// Passwords are never sent back.
const safe = (a: any) => ({ id: a.id, sender_email: a.sender_email, sender_name: a.sender_name || '', smtp_host: a.smtp_host, smtp_port: a.smtp_port, encryption: a.encryption, imap_host: a.imap_host || '', imap_port: a.imap_port || 993, is_default: Number(a.is_default) === 1 });

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const list = await getAccounts(user);
    const company = (await query<RowDataPacket[]>('SELECT sender_email FROM smtp_settings LIMIT 1'))[0]?.sender_email || '';
    return jsonSuccess({ company_sender: company, accounts: list.map(safe), account: list[0] ? safe(list[0]) : null });
  } catch (e: any) { return jsonError(e, 500); }
}

// Check the details against the real servers, and only then save. An address that is already connected is updated.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const b = await req.json();
    const email = String(b.sender_email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonError('Enter a valid email address', 422);
    const all = await getAccounts(user);
    const cur = (b.id ? all.find(a => String(a.id) === String(b.id)) : null) || all.find(a => a.sender_email.toLowerCase() === email.toLowerCase()) || null;
    // leaving the password empty keeps the saved one (editing the other fields)
    const password = String(b.app_password || '') || (cur ? cur.app_password : '');
    if (!password) return jsonError('Enter the password (for Gmail and Outlook, an app password)', 422);
    const acc: any = {
      sender_email: email, sender_name: String(b.sender_name || '').trim().slice(0, 100), app_password: password,
      smtp_host: String(b.smtp_host || '').trim(), smtp_port: parseInt(b.smtp_port) || 587, encryption: String(b.encryption || 'TLS').toUpperCase() === 'SSL' ? 'SSL' : 'TLS',
      imap_host: String(b.imap_host || '').trim(), imap_port: parseInt(b.imap_port) || 993,
    };
    if (!acc.smtp_host) return jsonError('Outgoing mail server (SMTP) is required', 422);
    if (!acc.imap_host) return jsonError('Incoming mail server (IMAP) is required', 422);
    if (!cur && all.length >= 5) return jsonError('You can connect up to 5 email addresses', 422);
    await assertPublicHost(acc.smtp_host);
    await testAccount(acc);

    const enc = encryptSecret(password);
    if (cur) {
      await execute('UPDATE user_email_accounts SET sender_email=?, app_password=?, sender_name=?, smtp_host=?, smtp_port=?, encryption=?, imap_host=?, imap_port=?, updated_at=NOW() WHERE id=? AND user_id=? AND user_type=?',
        [acc.sender_email, enc, acc.sender_name, acc.smtp_host, acc.smtp_port, acc.encryption, acc.imap_host, acc.imap_port, cur.id, user.id, user.type]);
    } else {
      await execute('INSERT INTO user_email_accounts (id, user_id, user_type, sender_email, app_password, sender_name, smtp_host, smtp_port, encryption, imap_host, imap_port, is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [uuidv4(), user.id, user.type, acc.sender_email, enc, acc.sender_name, acc.smtp_host, acc.smtp_port, acc.encryption, acc.imap_host, acc.imap_port, all.length === 0 ? 1 : 0]);
    }
    await auditFrom(user, 'mail_account_connected', 'mail_account', String(user.id), { email: acc.sender_email });
    return jsonSuccess({ message: 'Email connected' });
  } catch (e: any) { return jsonError(e?.message || e, e?.status || 422); }
}

// Make one of the connected emails the default.
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const b = await req.json();
    const a = await getAccount(user, b.id);
    if (!a) return jsonError('Email not found', 404);
    await execute('UPDATE user_email_accounts SET is_default = (id = ?) WHERE user_id = ? AND user_type = ?', [a.id, user.id, user.type]);
    return jsonSuccess({ message: 'Default email changed' });
  } catch (e: any) { return jsonError(e, 500); }
}

// Remove one connected email (?id=). If it was the default, another one takes over.
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const id = new URL(req.url).searchParams.get('id');
    const all = await getAccounts(user);
    const target = id ? all.find(a => String(a.id) === String(id)) : null;
    if (id && !target) return jsonError('Email not found', 404);
    if (target) {
      await execute('DELETE FROM user_email_accounts WHERE id=? AND user_id=? AND user_type=?', [target.id, user.id, user.type]);
      const left = await getAccounts(user);
      if (left.length > 0 && !left.some(a => Number(a.is_default) === 1)) await execute('UPDATE user_email_accounts SET is_default = 1 WHERE id = ?', [left[0].id]);
      await auditFrom(user, 'mail_account_removed', 'mail_account', String(user.id), { email: target.sender_email });
    } else {
      await execute('DELETE FROM user_email_accounts WHERE user_id=? AND user_type=?', [user.id, user.type]);
      await auditFrom(user, 'mail_account_removed', 'mail_account', String(user.id), { all: true });
    }
    return jsonSuccess({ message: 'Email removed' });
  } catch (e: any) { return jsonError(e, 500); }
}
