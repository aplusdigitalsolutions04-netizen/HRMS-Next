// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { generatePDF } from '@/lib/payslip-pdf';
import { sendEmailDetailed } from '@/lib/email';

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);

    const { id } = await params;
    const rows = await query<RowDataPacket[]>(
      `SELECT p.*, e.full_name, e.email_id, e.designation, e.pay_mode, e.date_of_joining, e.account_number, e.bank_name, e.location, e.pan, e.uan
       FROM payslips p JOIN employees e ON p.emp_code = e.emp_code WHERE p.id = ?`,
      [id]
    );
    if (rows.length === 0) return jsonError('Payslip not found', 404);

    const payslip = rows[0];
    if (!payslip.email_id) {
      return jsonError('Employee does not have an email address configured.', 400);
    }

    const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_address, company_logo FROM company_settings LIMIT 1');
    const pdfBuffer = await generatePDF({ ...payslip, ...(companyRows[0] || {}) });
    
    const monthLabel = monthNames[payslip.month - 1] || payslip.month;
    const subject = `Payslip for ${monthLabel} ${payslip.year}`;
    const filename = `Payslip_${payslip.emp_code}_${payslip.month}_${payslip.year}.pdf`;
    
    const html = `
      <h3>Dear ${payslip.full_name},</h3>
      <p>Please find attached your payslip for the month of <strong>${monthLabel} ${payslip.year}</strong>.</p>
      <br/>
      <p>Best regards,<br/>HR & Finance Team<br/>A Plus Digital Solutions</p>
    `;

    const { success, error } = await sendEmailDetailed(
      payslip.email_id,
      subject,
      html,
      {
        attachments: [{
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }],
        asUser: { id: user.id, type: user.type },
      }
    );

    if (success) {
      await execute('UPDATE payslips SET email_sent_at = NOW() WHERE id = ?', [id]);
      return jsonSuccess({ message: `Payslip email sent successfully to ${payslip.email_id}.` });
    } else {
      return jsonError(`Failed to send payslip email: ${error || 'unknown error'}`, 500);
    }
  } catch (e: any) { 
    return jsonError(e, 500); 
  }
}
