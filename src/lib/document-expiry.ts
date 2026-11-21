// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { createNotification } from './utils';
import { DOC_OPTIONS } from './documents';
import { sendEmailDetailed } from './email';
import { getConfig } from './app-config';

// Document expiry reminders. Each document with an expiry date is reminded at the points set in Settings > Rules & Limits (days before it
// expires; 0 is the day it expires and after). Each point is sent once (the last one sent is kept in document_expiry.last_notice, and a new expiry date starts again).
// The employee gets a bell notification and a mail; HR gets a bell notification. Mail can be switched off with the setting doc_expiry_mail = 0.
const label = (k: string) => DOC_OPTIONS.find(d => d.key === k)?.label || k;

export async function runDocumentExpiryCheck(): Promise<{ checked: number; reminded: number }> {
  // the points, from the earliest to the latest (for example 30, 7, 0)
  const points = [...new Set((await getConfig()).doc_expiry_notice_days.map(Number).filter(n => Number.isInteger(n) && n >= 0))].sort((a, b) => b - a).map(String);
  if (!points.length) return { checked: 0, reminded: 0 };
  const rows = await query<RowDataPacket[]>(
    `SELECT x.id, x.employee_id, x.document_type, DATE_FORMAT(x.expiry_date, '%Y-%m-%d') AS expiry_date, DATEDIFF(x.expiry_date, CURDATE()) AS days, x.last_notice,
            e.full_name, e.emp_code, e.email_id
     FROM document_expiry x JOIN employees e ON e.id = x.employee_id WHERE e.is_deleted = 0 AND x.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`, [Number(points[0])]);
  const mailRow = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'doc_expiry_mail'");
  const mailOn = mailRow[0]?.setting_value !== '0';
  let reminded = 0;

  for (const r of rows) {
    const days = Number(r.days);
    const point = [...points].reverse().find(p => days <= Number(p));   // the nearest point that has been reached
    if (point === undefined) continue;
    if (r.last_notice && points.indexOf(r.last_notice) >= points.indexOf(point)) continue;   // this point (or a later one) was already sent

    const doc = label(r.document_type);
    const when = days < 0 ? `expired ${-days} day${-days === 1 ? '' : 's'} ago` : days === 0 ? 'expires today' : `expires in ${days} day${days === 1 ? '' : 's'} (${r.expiry_date})`;
    await createNotification(`Document ${days <= 0 ? 'expired' : 'expiring'}: ${doc}`, `Your ${doc} ${when}. Please upload a new one or contact HR.`, 'document_expiry', String(r.employee_id), false, String(r.employee_id));
    await createNotification(`Document ${days <= 0 ? 'expired' : 'expiring'}: ${r.full_name}`, `${r.full_name} (${r.emp_code}): ${doc} ${when}.`, 'document_expiry', String(r.employee_id), true, null);
    if (mailOn && r.email_id) {
      sendEmailDetailed(r.email_id, `Your ${doc} ${days <= 0 ? 'has expired' : 'is about to expire'}`,
        `<p>Hello ${String(r.full_name).replace(/</g, '&lt;')},</p><p>Your <b>${doc}</b> ${when}.</p><p>Please upload a new document in the portal (Documents) or contact HR.</p>`).catch(() => {});
    }
    await execute('UPDATE document_expiry SET last_notice = ? WHERE id = ?', [point, r.id]);
    reminded++;
  }
  return { checked: rows.length, reminded };
}

// runs a little after the server starts and then every 6 hours; the "once per point" rule keeps it from repeating
export function startDocumentExpiryJob() {
  const g = globalThis as any;
  if (g.__docExpiryStarted) return;
  g.__docExpiryStarted = true;
  const run = () => { runDocumentExpiryCheck().catch(e => console.error('[document-expiry] failed:', e?.message || e)); };
  setTimeout(run, 120_000);
  setInterval(run, 6 * 60 * 60 * 1000);
}
