// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { verifyEmailConnection } from '@/lib/email';

// Tests the caller's own connected webmail account (user_email_accounts),
// as opposed to /api/settings/smtp/test which only ever tests the shared
// company SMTP account - the two are separate credentials and one being
// fine says nothing about the other. Only authenticates - doesn't send an
// actual email, so clicking "Test" repeatedly doesn't spam anyone's inbox.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const rows = await query<RowDataPacket[]>(
      'SELECT id FROM user_email_accounts WHERE user_id=? AND user_type=?',
      [user.id, user.type]
    );
    if (rows.length === 0) {
      return jsonError('No personal email account connected yet.', 400);
    }

    const result = await verifyEmailConnection({ id: user.id, type: user.type });

    if (result.ok) {
      return jsonSuccess({ message: `Connection succeeded! ${result.message}` });
    } else {
      return jsonError(`Connection failed: ${result.message}`);
    }
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
