// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4 } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const rows = await query<RowDataPacket[]>(
      'SELECT id, smtp_host, smtp_port, sender_email, sender_name, encryption, updated_at FROM user_email_accounts WHERE user_id=? AND user_type=?',
      [user.id, user.type]
    );
    // Password is intentionally never returned to the client.
    return jsonSuccess(rows[0] || null);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const body = await req.json();
    const { sender_email, app_password, sender_name, smtp_host, smtp_port, encryption } = body;
    if (!sender_email || !app_password) return jsonError('Email and app password are required', 422);
    if (!smtp_host) return jsonError('SMTP host is required', 422);

    const existing = await query<RowDataPacket[]>(
      'SELECT id FROM user_email_accounts WHERE user_id=? AND user_type=?',
      [user.id, user.type]
    );

    if (existing.length > 0) {
      await execute(
        'UPDATE user_email_accounts SET sender_email=?, app_password=?, sender_name=?, smtp_host=?, smtp_port=?, encryption=?, updated_at=NOW() WHERE id=?',
        [sender_email, app_password, sender_name || '', smtp_host, smtp_port || 587, encryption || 'TLS', existing[0].id]
      );
    } else {
      await execute(
        'INSERT INTO user_email_accounts (id, user_id, user_type, sender_email, app_password, sender_name, smtp_host, smtp_port, encryption) VALUES (?,?,?,?,?,?,?,?,?)',
        [uuidv4(), user.id, user.type, sender_email, app_password, sender_name || '', smtp_host, smtp_port || 587, encryption || 'TLS']
      );
    }
    return jsonSuccess({ message: 'Email account saved' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    await execute('DELETE FROM user_email_accounts WHERE user_id=? AND user_type=?', [user.id, user.type]);
    return jsonSuccess({ message: 'Email account removed' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
