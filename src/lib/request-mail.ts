// @ts-nocheck
import { getMailKinds } from './masters';
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { sendEmail } from './email';
import { getStep } from './approvalEngine';
import { createNotification } from './utils';

// Emails for employee requests: leave, work from home, missed punch and late coming.
// The wording comes from an Email Template that HR picks in Settings > Request Mails (one per kind and
// step). With no template picked, a plain built-in mail is sent. Every mail carries the employee's reason.
//
// Flow of a request:  employee sends -> mail to the Reporting Manager (to HR when there is no manager)
//                     manager approves -> mail to HR  -> HR approves -> mail to the employee
//                     rejected at any step -> mail to the employee with the reason

// Starting values only; the live list of request types is the Request Types master (getMailKinds in masters.ts).
export const MAIL_KINDS: Record<string, string> = {
  leave: 'Leave',
  wfh: 'Work From Home',
  missed_punch: 'Missed punch',
  late_coming: 'Late coming',
};

export const MAIL_EVENTS: Record<string, string> = {
  submitted: 'Request sent - mail to the Reporting Manager (to HR if there is no manager)',
  to_hr: 'Manager approved - mail to HR',
  approved: 'Final approval - mail to the employee',
  rejected: 'Rejected - mail to the employee',
};

// Placeholders HR can use in a template (subject and body): {employee_name}, {reason}, ...
export const MAIL_VARIABLES: [string, string][] = [
  ['employee_name', 'Name of the employee'],
  ['emp_code', 'Employee code'],
  ['request_type', 'Leave type, Work From Home, Missed punch or Late coming'],
  ['leave_type', 'The leave type (Annual Leave, Sick Leave, ...) - leave mails'],
  ['from_date', 'First day (leave / WFH)'],
  ['to_date', 'Last day (leave / WFH)'],
  ['duration', 'Number of days (leave)'],
  ['date', 'The date of the request (missed punch / late coming)'],
  ['in_time', 'In time (missed punch) or the time you arrived (late coming)'],
  ['out_time', 'Out time (missed punch)'],
  ['reason', "The employee's reason"],
  ['message', "The employee's own message / letter (leave)"],
  ['manager_name', 'Reporting manager'],
  ['remarks', 'Note or rejection reason written by the approver'],
  ['status', 'Pending / Approved / Rejected'],
  ['review_link', 'Link to open the request'],
  ['company_name', 'Company name'],
];

const MAP_KEY = 'request_mail_templates';

export async function getMailTemplateMap(): Promise<Record<string, string>> {
  try {
    const r = await query<RowDataPacket[]>('SELECT setting_value FROM system_settings WHERE setting_key = ?', [MAP_KEY]);
    const v = r[0]?.setting_value ? JSON.parse(r[0].setting_value) : {};
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

export async function saveMailTemplateMap(map: Record<string, string>) {
  const value = JSON.stringify(map);
  const r = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [MAP_KEY]);
  if (r.length > 0) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, MAP_KEY]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [MAP_KEY, value]);
}

// A date as YYYY-MM-DD. MySQL DATE columns come back as Date objects at local midnight, so read the local
// parts (toISOString would shift the day back by the time-zone offset).
export const ymd = (d: any): string => {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const x = new Date(d);
  if (isNaN(x.getTime())) return String(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// A real address only: the placeholder logins made for imported staff are not mailboxes.
export const realEmail = (e?: string) => (e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !/placeholder\.local$/i.test(e) ? e : undefined);
// Several addresses may be typed in Cc / Bcc, separated by a comma, semicolon, space or new line.
// Returns the clean list, or the first address that is not valid.
export function parseAddressList(input: any): { list: string[]; bad?: string } {
  const parts = String(input || '').split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
  const list: string[] = [];
  for (const p of parts) {
    if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(p)) return { list: [], bad: p };
    if (!list.some(x => x.toLowerCase() === p.toLowerCase())) list.push(p);
  }
  return { list: list.slice(0, 20) };
}
export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;

// {name}, {{name}} or {NAME}: any brace count and case, like the other templates in the app.
function fill(text: string, vars: Record<string, string>, escapeValues: boolean) {
  return String(text || '').replace(/\{{1,2}\s*([a-z_]+)\s*\}{1,2}/gi, (m, k) => {
    const key = k.toLowerCase();
    if (!(key in vars)) return m;
    return key === 'review_link' || !escapeValues ? String(vars[key] ?? '') : esc(vars[key]);
  });
}

const ROWS: Record<string, [string, string][]> = {
  leave: [['Employee', 'employee_name'], ['Leave type', 'request_type'], ['From', 'from_date'], ['To', 'to_date'], ['Days', 'duration'], ['Reason', 'reason']],
  wfh: [['Employee', 'employee_name'], ['From', 'from_date'], ['To', 'to_date'], ['Reason', 'reason']],
  missed_punch: [['Employee', 'employee_name'], ['Date', 'date'], ['In time', 'in_time'], ['Out time', 'out_time'], ['Reason', 'reason']],
  late_coming: [['Employee', 'employee_name'], ['Date', 'date'], ['Arrived at', 'in_time'], ['Reason', 'reason']],
};

function defaultMail(kind: string, event: string, v: Record<string, string>, updated = false, what = 'Request') {
  const subjects: Record<string, string> = {
    submitted: `${what} request awaiting your approval - ${v.employee_name}`,
    to_hr: `${what} request approved by manager - ${v.employee_name}`,
    approved: `${what} request approved`,
    rejected: `${what} request rejected`,
  };
  const heads: Record<string, [string, string]> = {
    submitted: [`${what} request awaiting your approval`, '#0f172a'],
    to_hr: [`${what} request awaiting HR approval`, '#0f172a'],
    approved: [`${what} request approved`, '#16a34a'],
    rejected: [`${what} request rejected`, '#dc2626'],
  };
  const intro: Record<string, string> = {
    submitted: `${esc(v.employee_name)} has sent a ${esc(what.toLowerCase())} request.`,
    to_hr: `The reporting manager${v.manager_name ? ' (' + esc(v.manager_name) + ')' : ''} has approved this request. It now needs HR approval.`,
    approved: `Dear ${esc(v.employee_name)}, your ${esc(what.toLowerCase())} request has been approved.`,
    rejected: `Dear ${esc(v.employee_name)}, your ${esc(what.toLowerCase())} request has been rejected.`,
  };
  const rows = (ROWS[kind] || []).filter(([, k]) => v[k])
    .map(([label, k]) => `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">${label}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f172a;${k === 'reason' ? '' : 'font-weight:600'}">${esc(v[k])}</td></tr>`).join('');
  const remarks = v.remarks ? `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#64748b;font-size:13px">${event === 'rejected' ? 'Rejection reason' : 'Note'}</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f172a">${esc(v.remarks)}</td></tr>` : '';
  const message = v.message && event === 'submitted'
    ? `<div style="margin:16px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(v.message)}</div>` : '';
  const button = (event === 'submitted' || event === 'to_hr') && v.review_link
    ? `<p style="margin-top:20px"><a href="${v.review_link}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Review request</a></p>` : '';
  if (updated) { subjects[event] = 'Updated: ' + subjects[event]; heads[event][0] += ' (updated by the employee)'; }
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <h2 style="color:${heads[event][1]}">${heads[event][0]}</h2>
    <p style="color:#475569">${intro[event]}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${rows}${remarks}</table>${message}${button}
    <p style="color:#64748b;font-size:13px;margin-top:24px">This is an automated message from ${esc(v.company_name || 'HRMS')}.</p></div>`;
  return { subject: subjects[event], html };
}

export interface RequestMailOptions {
  kind: 'leave' | 'wfh' | 'missed_punch' | 'late_coming';
  event: 'submitted' | 'to_hr' | 'approved' | 'rejected';
  to: string;
  vars: Record<string, any>;
  cc?: string; bcc?: string;
  replyTo?: string; // the employee's own address, so a reply to a company-sent mail reaches them
  updated?: boolean; // the employee changed a request that is still waiting
  subject?: string; // the employee's own subject (only used for the first mail of a request)
  asUser?: { id: any; type: string; accountId?: string };
}

// Staff (employees, managers) send request mails only from their own connected email (My Mail). Without one, no mail is
// sent - the company/HR mail account is never used in their name. The request itself still reaches the manager and HR in
// the app (notifications). HR users may fall back to the company account, which is theirs.
export async function canSendAs(asUser?: { id: any; type: string }): Promise<boolean> {
  if (!asUser || asUser.type !== 'employee') return true;
  const r = await query<RowDataPacket[]>('SELECT id FROM user_email_accounts WHERE user_id = ? AND user_type = ? LIMIT 1', [asUser.id, asUser.type]);
  return r.length > 0;
}

export async function sendRequestMail(o: RequestMailOptions): Promise<boolean> {
  try {
    if (!o.to) return false;
    if (!(await canSendAs(o.asUser))) return false;
    const company = (await query<RowDataPacket[]>('SELECT company_name FROM company_settings LIMIT 1').catch(() => []))[0]?.company_name || 'HRMS';
    const vars: Record<string, string> = { ...Object.fromEntries(MAIL_VARIABLES.map(([k]) => [k, ''])), company_name: company, status: o.event === 'approved' ? 'Approved' : o.event === 'rejected' ? 'Rejected' : 'Pending' };
    for (const [k, val] of Object.entries(o.vars || {})) vars[k] = val === null || val === undefined ? '' : String(val);
    const kindName = (await getMailKinds(false))[o.kind] || MAIL_KINDS[o.kind] || 'Request';
    if (!vars.request_type) vars.request_type = kindName;
    if (o.kind === 'leave' && !vars.leave_type) vars.leave_type = vars.request_type;

    let subject = '', html = '';
    const tplId = (await getMailTemplateMap())[`${o.kind}.${o.event}`];
    const tpl = tplId ? (await query<RowDataPacket[]>('SELECT subject, body FROM email_templates WHERE id = ?', [tplId]).catch(() => []))[0] : null;
    if (tpl && (tpl.body || tpl.subject)) {
      let body = fill(tpl.body || '', vars, true);
      if (!/<[a-z][\s\S]*>/i.test(body)) body = esc(body).replace(/\n/g, '<br>'); // plain-text template
      if (vars.message && o.event === 'submitted' && !/\{{1,2}\s*message\s*\}{1,2}/i.test(tpl.body || '')) {
        body += `<div style="white-space:pre-wrap">${esc(vars.message)}</div>`;
      }
      if (vars.review_link && !/\{{1,2}\s*review_link/i.test(tpl.body || '') && (o.event === 'submitted' || o.event === 'to_hr')) {
        body += `<p><a href="${vars.review_link}">Open the request</a></p>`;
      }
      subject = fill(tpl.subject || '', vars, false) || defaultMail(o.kind, o.event, vars, false, kindName).subject;
      if (o.updated) subject = 'Updated: ' + subject;
      html = body;
    } else {
      ({ subject, html } = defaultMail(o.kind, o.event, vars, !!o.updated, kindName));
    }
    if (o.subject && o.event === 'submitted' && !o.updated) subject = o.subject;
    return await sendEmail(o.to, subject, html, { cc: o.cc || undefined, bcc: o.bcc || undefined, replyTo: o.replyTo || undefined, asUser: o.asUser });
  } catch (e: any) {
    console.error('[request-mail] failed:', e?.message || e);
    return false;
  }
}

// Who gets the "needs HR" mails: active HR admins, plus the default CC list from SMTP settings.
export async function hrRecipients(excludeEmail?: string): Promise<{ to: string; bcc: string }> {
  const hr = await query<RowDataPacket[]>('SELECT DISTINCT email FROM hr_admins WHERE email IS NOT NULL AND is_active = 1');
  const smtp = await query<RowDataPacket[]>('SELECT default_cc_emails, default_bcc_emails FROM smtp_settings LIMIT 1').catch(() => []);
  const split = (s: string) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  const to = [...new Set([...hr.map(r => r.email), ...split(smtp[0]?.default_cc_emails)])].filter(e => e && e !== excludeEmail);
  return { to: to.join(','), bcc: split(smtp[0]?.default_bcc_emails).join(',') };
}

export async function managerOf(employeeId: string): Promise<{ id: string; email_id: string; full_name: string } | null> {
  const r = await query<RowDataPacket[]>('SELECT m.id, m.email_id, m.full_name FROM employees e JOIN employees m ON e.manager_id = m.id WHERE e.id = ?', [employeeId]);
  return (r[0] as any) || null;
}

// An employee may change or withdraw a request until the first person (manager, or HR when there is no
// manager) has acted on it.
export async function requestHasActions(requestType: string, id: string | number): Promise<boolean> {
  const r = await query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM approval_actions WHERE request_type = ? AND request_id = ?', [requestType, String(id)]);
  return Number(r[0]?.n) > 0;
}

// Tell whoever the request is waiting for (manager or HR) that the employee changed it: mail + notification.
export async function mailApproverOfUpdate(o: {
  kind: RequestMailOptions['kind']; workflowId?: string | null; currentStep?: number | null; employeeId: string;
  vars: Record<string, any>; category: string; refId: string; title: string; text: string;
  hrLink: string; managerLink: string; asUser?: { id: any; type: string };
}) {
  try {
    const step = o.workflowId && o.currentStep ? await getStep(o.workflowId, o.currentStep) : null;
    const mgr = step && step.approver_type === 'MANAGER' ? await managerOf(o.employeeId) : null;
    if (mgr) {
      sendRequestMail({ kind: o.kind, event: 'submitted', to: mgr.email_id, updated: true, vars: { ...o.vars, manager_name: mgr.full_name, review_link: o.managerLink }, asUser: o.asUser });
      createNotification(o.title, o.text, o.category, o.refId, false, String(mgr.id));
    } else {
      const hr = await hrRecipients();
      if (hr.to) sendRequestMail({ kind: o.kind, event: 'submitted', to: hr.to, bcc: hr.bcc || undefined, updated: true, vars: { ...o.vars, review_link: o.hrLink }, asUser: o.asUser });
      createNotification(o.title, o.text, o.category, o.refId, true, null);
    }
  } catch (e: any) { console.error('[request-mail] update notice failed:', e?.message || e); }
}
