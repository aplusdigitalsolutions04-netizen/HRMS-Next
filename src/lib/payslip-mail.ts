// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { getPayslipSignatories } from './payroll-calc';
import { generatePDF } from './payslip-pdf';
import { sendEmailDetailed } from './email';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Emails one payslip (PDF attached) to the employee and stamps email_sent_at. Shared by the
// "Send email" button and the approve-and-send action so both send exactly the same mail.
export async function sendPayslipEmail(id: string, asUser?: { id: any; type: string }): Promise<{ ok: boolean; message: string; status?: number }> {
  const rows = await query<RowDataPacket[]>(
    `SELECT p.*, e.full_name, e.email_id, e.designation, e.pay_mode, e.date_of_joining, e.account_number, e.bank_name, e.location, e.pan, e.uan
     FROM payslips p JOIN employees e ON p.emp_code = e.emp_code WHERE p.id = ?`,
    [id]
  );
  if (rows.length === 0) return { ok: false, message: 'Payslip not found', status: 404 };
  const payslip = rows[0];
  if (String(payslip.status || 'APPROVED').toUpperCase() !== 'APPROVED') return { ok: false, message: 'Approve the payslip before emailing it.', status: 409 };
  if (!payslip.email_id) return { ok: false, message: 'Employee does not have an email address configured.', status: 400 };

  const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_address, company_logo FROM company_settings LIMIT 1');
  const pdfBuffer = await generatePDF({ ...payslip, ...(companyRows[0] || {}), ...(await getPayslipSignatories()) });

  const monthLabel = monthNames[payslip.month - 1] || payslip.month;
  const subject = `Payslip for ${monthLabel} ${payslip.year}`;
  const filename = `Payslip_${payslip.emp_code}_${payslip.month}_${payslip.year}.pdf`;
  const html = `
      <h3>Dear ${payslip.full_name},</h3>
      <p>Please find attached your payslip for the month of <strong>${monthLabel} ${payslip.year}</strong>.</p>
      <br/>
      <p>Best regards,<br/>HR & Finance Team<br/>A Plus Digital Solutions</p>
    `;
  const { success, error } = await sendEmailDetailed(payslip.email_id, subject, html, {
    attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    ...(asUser ? { asUser } : {}),
  });
  if (!success) return { ok: false, message: `Failed to send payslip email: ${error || 'unknown error'}`, status: 500 };
  await execute('UPDATE payslips SET email_sent_at = NOW() WHERE id = ?', [id]);
  return { ok: true, message: `Payslip email sent successfully to ${payslip.email_id}.` };
}
