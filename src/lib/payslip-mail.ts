// @ts-nocheck
import { getConfig } from './app-config';
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { getPayslipSignatories } from './payroll-calc';
import { generatePDF } from './payslip-pdf';
import { sendEmailDetailed } from './email';
import { fillEmployeeTemplate, buildCompanyLogoEmail } from './emailTemplates';
import { mergeAddresses, parseAddressList } from './request-mail';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

async function loadPayslip(id: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT p.*, e.full_name, e.email_id, e.designation, e.pay_mode, e.date_of_joining, e.account_number, e.bank_name, e.location, e.pan, e.uan
     FROM payslips p JOIN employees e ON p.emp_code = e.emp_code WHERE p.id = ?`,
    [id]
  );
  const companyRows = await query<RowDataPacket[]>('SELECT company_name, company_address, company_logo FROM company_settings LIMIT 1');
  return { payslip: rows[0], company: companyRows[0] || {} };
}

// The mail text comes from the email template named "Payslip" (Settings > Templates) when there is one; without it the
// standard wording below is used. {{month}}, {{year}}, {{month_year}}, {{net_salary}} are filled in besides the usual
// {{name}}, {{emp_code}}, {{company_name}} and {{company_logo}}.
async function buildPayslipMail(payslip: any, company: any): Promise<{ subject: string; html: string; cc: string; bcc: string }> {
  const locale = (await getConfig()).locale;
  const monthLabel = monthNames[payslip.month - 1] || payslip.month;
  let subject = `Payslip for ${monthLabel} ${payslip.year}`;
  let html = `
      <h3>Dear ${payslip.full_name},</h3>
      <p>Please find attached your payslip for the month of <strong>${monthLabel} ${payslip.year}</strong>.</p>
      <br/>
      <p>Best regards,<br/>${company.company_name || ''}</p>
    `;
  const tmpl = (await query<RowDataPacket[]>("SELECT subject, body, cc_emails, bcc_emails FROM email_templates WHERE LOWER(TRIM(name)) = 'payslip' AND COALESCE(is_deleted, 0) = 0 LIMIT 1").catch(() => []))[0];
  if (tmpl && String(tmpl.body || '').trim()) {
    const companyName = company.company_name || '';
    const { html: logoHtml } = buildCompanyLogoEmail(company.company_logo, companyName);
    const vars = { fullName: payslip.full_name, email: payslip.email_id, empCode: payslip.emp_code, companyLogo: logoHtml, companyName };
    const extra = (t: string) => fillEmployeeTemplate(t || '', vars)
      .replace(/\{{1,2}month_year\}{1,2}/gi, () => `${monthLabel} ${payslip.year}`)
      .replace(/\{{1,2}month\}{1,2}/gi, () => String(monthLabel))
      .replace(/\{{1,2}year\}{1,2}/gi, () => String(payslip.year))
      .replace(/\{{1,2}net_salary\}{1,2}/gi, () => Number(payslip.net_salary || 0).toLocaleString(locale, { maximumFractionDigits: 2 }));
    html = extra(tmpl.body);
    if (String(tmpl.subject || '').trim()) subject = extra(tmpl.subject);
  }
  return { subject, html, cc: tmpl?.cc_emails || '', bcc: tmpl?.bcc_emails || '' };
}

// What the mail will look like, for the "Send Payslip Email" window where HR can still edit it. The logo is given as a data
// address too, because the browser cannot show the cid: picture a mail uses.
export async function previewPayslipEmail(id: string): Promise<{ ok: boolean; message?: string; status?: number; to?: string; subject?: string; html?: string; filename?: string; logo_data_url?: string }> {
  const { payslip, company } = await loadPayslip(id);
  if (!payslip) return { ok: false, message: 'Payslip not found', status: 404 };
  const { subject, html, cc, bcc } = await buildPayslipMail(payslip, company);
  const logo = /^data:[^;]+;base64,/.test(String(company.company_logo || '')) ? String(company.company_logo) : '';
  return { ok: true, to: payslip.email_id || '', subject, html, cc, bcc, filename: `Payslip_${payslip.emp_code}_${payslip.month}_${payslip.year}.pdf`, logo_data_url: logo };
}

// Emails one payslip (PDF attached automatically) to the employee and stamps email_sent_at. Shared by the "Send email"
// window and the approve-and-send action so both send the same mail. `edited` is the subject / text HR changed in the window.
export async function sendPayslipEmail(id: string, asUser?: { id: any; type: string }, edited?: { subject?: string; html?: string; cc?: string; bcc?: string }): Promise<{ ok: boolean; message: string; status?: number }> {
  const { payslip, company } = await loadPayslip(id);
  if (!payslip) return { ok: false, message: 'Payslip not found', status: 404 };
  if (String(payslip.status || 'APPROVED').toUpperCase() !== 'APPROVED') return { ok: false, message: 'Approve the payslip before emailing it.', status: 409 };
  if (!payslip.email_id) return { ok: false, message: 'Employee does not have an email address configured.', status: 400 };

  const pdfBuffer = await generatePDF({ ...payslip, ...company, ...(await getPayslipSignatories()) });
  const filename = `Payslip_${payslip.emp_code}_${payslip.month}_${payslip.year}.pdf`;
  const built = await buildPayslipMail(payslip, company);
  const subject = String(edited?.subject || '').trim() || built.subject;
  const html = String(edited?.html || '').trim() || built.html;
  // Cc / Bcc: what HR left in the window (it starts with the template's always-copy list); each address is checked
  const ccIn = edited && edited.cc !== undefined ? edited.cc : built.cc, bccIn = edited && edited.bcc !== undefined ? edited.bcc : built.bcc;
  const ccP = parseAddressList(ccIn), bccP = parseAddressList(bccIn);
  if (ccP.bad || bccP.bad) return { ok: false, message: `"${ccP.bad || bccP.bad}" is not a valid email address.`, status: 422 };
  const cc = mergeAddresses(ccP.list.join(','), '', payslip.email_id), bcc = mergeAddresses(bccP.list.join(','), '', payslip.email_id + ',' + cc);
  // the company logo travels as a small inline picture when the text uses it
  const { attachment: logoAttachment } = buildCompanyLogoEmail(company.company_logo, company.company_name || '');
  const attachments: any[] = [{ filename, content: pdfBuffer, contentType: 'application/pdf' }];
  if (logoAttachment && html.includes('cid:company-logo')) attachments.push(logoAttachment);

  const { success, error } = await sendEmailDetailed(payslip.email_id, subject, html, { attachments, cc: cc || undefined, bcc: bcc || undefined, ...(asUser ? { asUser } : {}) });
  if (!success) return { ok: false, message: `Failed to send payslip email: ${error || 'unknown error'}`, status: 500 };
  await execute('UPDATE payslips SET email_sent_at = NOW() WHERE id = ?', [id]);
  return { ok: true, message: `Payslip email sent successfully to ${payslip.email_id}.` };
}
