// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { renderLetterPdf, longDate } from './letters';
import { sendEmailDetailed } from './email';
import { fillEmployeeTemplate, buildCompanyLogoEmail } from './emailTemplates';
import { uuidv4 } from './utils';
import { mergeAddresses, parseAddressList } from './request-mail';

// A letter that was made can be emailed to the employee with its PDF attached. The words of the mail come from the email template named
// "Letter" (Settings > Email Templates), which can be edited like any other template. It is put in once with a standard wording. Besides the usual
// {{name}}, {{emp_code}}, {{company_name}} and {{company_logo}}, {{letter_name}}, {{ref_no}} and {{date}} are filled in.

const STANDARD_SUBJECT = '{{letter_name}} - {{ref_no}}';
const STANDARD_BODY = `<p>Dear {{name}},</p>
<p>Please find attached your <strong>{{letter_name}}</strong> (reference {{ref_no}}), dated {{date}}.</p>
<p>You can also open it any time from your employee portal, under Documents &gt; My Letters.</p>
<p>Best regards,<br/>{{company_name}}</p>`;

async function ensureLetterMailTemplate() {
  const done = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letter_mail_template_seeded'"))[0];
  if (done) return;
  const have = (await query<RowDataPacket[]>("SELECT id FROM email_templates WHERE LOWER(TRIM(name)) = 'letter' AND COALESCE(is_deleted, 0) = 0 LIMIT 1"))[0];
  if (!have) {
    await execute("INSERT INTO email_templates (id, name, subject, body, variables, created_on, template_type, is_deleted) VALUES (?,?,?,?,?,NOW(),?,0)",
      [uuidv4(), 'Letter', STANDARD_SUBJECT, STANDARD_BODY, JSON.stringify(['name', 'emp_code', 'letter_name', 'ref_no', 'date', 'company_name', 'company_logo']), 'employee']).catch(async () => {
      await execute("INSERT INTO email_templates (id, name, subject, body, created_on, is_deleted) VALUES (?,?,?,?,NOW(),0)", [uuidv4(), 'Letter', STANDARD_SUBJECT, STANDARD_BODY]);
    });
  }
  await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_mail_template_seeded', '1')");
}

async function load(id: string) {
  const l = (await query<RowDataPacket[]>("SELECT *, IF(no_date = 1, '', DATE_FORMAT(issued_on, '%Y-%m-%d')) AS day FROM letters_issued WHERE id = ?", [id]))[0];
  if (!l) return null;
  const e = (await query<RowDataPacket[]>('SELECT id, full_name, emp_code, email_id, official_email FROM employees WHERE id = ?', [l.employee_id]))[0];
  const co = (await query<RowDataPacket[]>('SELECT company_name, company_logo FROM company_settings LIMIT 1'))[0] || {};
  return { l, e, co };
}

// the addresses the mail can go to: the employee's own two (personal / login address and official address)
export function recipientsOf(e: any): { key: 'personal' | 'official'; label: string; address: string }[] {
  const out: any[] = [];
  if (e?.email_id && !/@placeholder\.local$/i.test(e.email_id)) out.push({ key: 'personal', label: 'Personal email', address: e.email_id });
  if (e?.official_email) out.push({ key: 'official', label: 'Official email', address: e.official_email });
  return out;
}

async function build(l: any, e: any, co: any): Promise<{ subject: string; html: string; cc: string; bcc: string }> {
  await ensureLetterMailTemplate();
  const tmpl = (await query<RowDataPacket[]>("SELECT subject, body, cc_emails, bcc_emails FROM email_templates WHERE LOWER(TRIM(name)) = 'letter' AND COALESCE(is_deleted, 0) = 0 LIMIT 1"))[0];
  const body = tmpl && String(tmpl.body || '').trim() ? tmpl.body : STANDARD_BODY;
  const subj = tmpl && String(tmpl.subject || '').trim() ? tmpl.subject : STANDARD_SUBJECT;
  const companyName = co.company_name || '';
  const { html: logoHtml } = buildCompanyLogoEmail(co.company_logo, companyName);
  const vars = { fullName: e.full_name, email: e.email_id, empCode: e.emp_code, companyLogo: logoHtml, companyName };
  const extra = (t: string) => fillEmployeeTemplate(t || '', vars)
    .replace(/\{{1,2}letter_name\}{1,2}/gi, () => String(l.title || 'Letter'))
    .replace(/\{{1,2}ref_no\}{1,2}/gi, () => String(l.ref_no || ''))
    .replace(/\{{1,2}date\}{1,2}/gi, () => longDate(l.day));
  // with no reference number, close the gap it leaves: "Letter - " and "(reference )"
  const noRef = (t: string) => (l.ref_no ? t : t.replace(/\s*\(\s*reference\s*\)/gi, '').replace(/\s*[-\u2013:]\s*$/, ''));
  // and with no date, ", dated ." becomes "."
  const noDate = (t: string) => (l.day ? t : t.replace(/,?\s*dated\s*(?=[.<])/gi, ''));
  const tidy = (t: string) => noDate(noRef(t));
  return { subject: tidy(extra(subj)).trim(), html: tidy(extra(body)), cc: tmpl?.cc_emails || '', bcc: tmpl?.bcc_emails || '' };
}

export async function previewLetterEmail(id: string): Promise<{ ok: boolean; message?: string; status?: number; recipients?: any[]; subject?: string; html?: string; cc?: string; bcc?: string; filename?: string; emailed_at?: any; emailed_to?: string }> {
  const d = await load(id);
  if (!d) return { ok: false, message: 'Letter not found', status: 404 };
  const { subject, html, cc, bcc } = await build(d.l, d.e || {}, d.co);
  return { ok: true, recipients: recipientsOf(d.e), subject, html, cc, bcc, filename: `${String(d.l.ref_no || 'Letter').replace(/[^\w.-]/g, '_')}.pdf`, emailed_at: d.l.emailed_at, emailed_to: d.l.emailed_to };
}

// Sends the letter (PDF attached) to one of the employee's own addresses. `to` is 'personal' or 'official'; an address typed by the caller is not accepted.
export async function sendLetterEmail(id: string, to: string, by: { id: any; type: string; email?: string }, edited?: { subject?: string; html?: string; cc?: string; bcc?: string }): Promise<{ ok: boolean; message: string; status?: number }> {
  const d = await load(id);
  if (!d) return { ok: false, message: 'Letter not found', status: 404 };
  const rc = recipientsOf(d.e).find(r => r.key === to);
  if (!rc) return { ok: false, message: 'The employee has no email address of that kind. Pick another one, or add it to the employee profile.', status: 422 };

  const pdf = await renderLetterPdf({ title: d.l.title, ref: d.l.ref_no || '', date: longDate(d.l.day), text: d.l.body });
  const filename = `${String(d.l.ref_no || 'Letter').replace(/[^\w.-]/g, '_')}.pdf`;
  const built = await build(d.l, d.e, d.co);
  const subject = String(edited?.subject || '').trim() || built.subject;
  const html = String(edited?.html || '').trim() || built.html;
  // Cc / Bcc: what HR left in the window (it starts with the template's always-copy list); each address is checked
  const ccIn = edited && edited.cc !== undefined ? edited.cc : built.cc, bccIn = edited && edited.bcc !== undefined ? edited.bcc : built.bcc;
  const ccP = parseAddressList(ccIn), bccP = parseAddressList(bccIn);
  if (ccP.bad || bccP.bad) return { ok: false, message: `"${ccP.bad || bccP.bad}" is not a valid email address.`, status: 422 };
  const cc = mergeAddresses(ccP.list.join(','), '', rc.address), bcc = mergeAddresses(bccP.list.join(','), '', rc.address + ',' + cc);
  const { attachment: logoAttachment } = buildCompanyLogoEmail(d.co.company_logo, d.co.company_name || '');
  const attachments: any[] = [{ filename, content: pdf, contentType: 'application/pdf' }];
  if (logoAttachment && html.includes('cid:company-logo')) attachments.push(logoAttachment);

  const { success, error } = await sendEmailDetailed(rc.address, subject, html, { attachments, cc: cc || undefined, bcc: bcc || undefined, asUser: { id: by.id, type: by.type } });
  // every attempt is written to the Email Log
  const logId = uuidv4();
  const status = success ? 'sent' : 'failed';
  await execute('INSERT INTO email_logs (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, sent_by, sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',
    [logId, null, rc.address, subject, html, cc || null, bcc || null, filename, status, by.email || String(by.id)]).catch(() => { });
  if (!success) return { ok: false, message: `The email could not be sent: ${error || 'unknown error'}`, status: 502 };
  await execute('UPDATE letters_issued SET emailed_at = NOW(), emailed_to = ?, emailed_by = ? WHERE id = ?', [rc.address, by.email || String(by.id), id]);
  return { ok: true, message: `Letter emailed to ${rc.address}.` };
}
