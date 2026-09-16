// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';

// Tests the caller's own connected webmail account (user_email_accounts),
// as opposed to /api/settings/smtp/test which only ever tests the shared
// company SMTP account - the two are separate credentials and one being
// fine says nothing about the other.
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

    const recipient = user.email;
    if (!recipient) {
      return jsonError('Your user account does not have an email address configured.', 400);
    }

    const success = await sendEmail(
      recipient,
      'HRMS Webmail Connection Test',
      `<h3>Webmail Test Successful</h3>
       <p>Hello ${user.name || 'User'},</p>
       <p>This is a test email sent from the HRMS system using your connected personal email account.</p>
       <p>If you are reading this, your webmail connection is configured and working perfectly!</p>
       <br/>
       <p>Regards,<br/>HRMS System</p>`,
      { asUser: { id: user.id, type: user.type } }
    );

    if (success) {
      return jsonSuccess({ message: `Connection test succeeded! A test email has been sent to ${recipient}.` });
    } else {
      return jsonError('Connection test failed. Please check your email/app password, or review the server logs.');
    }
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
