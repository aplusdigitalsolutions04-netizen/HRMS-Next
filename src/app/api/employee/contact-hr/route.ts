// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    
    // Ensure it's an employee
    const emps = await query<RowDataPacket[]>('SELECT id, full_name, emp_code FROM employees WHERE email_id=?', [user.email || user.id]);
    if (emps.length === 0) return jsonError('Employee not found', 404);
    const emp = emps[0];

    const body = await req.json();
    const { category, subject, message } = body;

    if (!subject || !message) return jsonError('Subject and message are required', 400);

    // Get company email to send to
    const company = await query<RowDataPacket[]>('SELECT company_email FROM company_settings LIMIT 1');
    const hrEmail = company[0]?.company_email;
    if (!hrEmail) return jsonError('HR Email (Company Email) is not configured in settings', 400);

    const emailSubject = `[${category || 'Concern'}] ${subject} - from ${emp.full_name} (${emp.emp_code})`;
    const emailBody = `
      <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #4338ca;">New Employee Concern</h2>
        <p><strong>Employee:</strong> ${emp.full_name} (${emp.emp_code})</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Category:</strong> ${category || 'General'}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p><strong>Message:</strong></p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          ${message.replace(/\n/g, '<br/>')}
        </div>
      </div>
    `;

    // We can also CC the employee so they have a copy
    const success = await sendEmail(hrEmail, emailSubject, emailBody, { cc: user.email, asUser: { id: user.id, type: user.type } });

    if (!success) {
      return jsonError('Failed to send email. Verify SMTP settings.', 500);
    }

    return jsonSuccess({ message: 'Email sent successfully to HR' });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
