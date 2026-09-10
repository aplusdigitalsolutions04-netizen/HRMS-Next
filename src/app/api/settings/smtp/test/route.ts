import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const recipient = user.email;
    if (!recipient) {
      return jsonError('Your user account does not have an email address configured.', 400);
    }

    const success = await sendEmail(
      recipient,
      'HRMS SMTP Connection Test',
      `<h3>SMTP Test Successful</h3>
       <p>Hello ${user.name || 'User'},</p>
       <p>This is a test email sent from the HRMS system to verify your SMTP settings.</p>
       <p>If you are reading this, your SMTP connection is configured and working perfectly!</p>
       <br/>
       <p>Regards,<br/>HRMS System</p>`
    );

    if (success) {
      return jsonSuccess({ message: `SMTP connection test succeeded! A test email has been sent to ${recipient}.` });
    } else {
      return jsonError('SMTP connection test failed. Please check your SMTP settings and credentials, or review the server logs.');
    }
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
