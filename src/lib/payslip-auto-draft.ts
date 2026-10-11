// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { generatePayslipsForMonth } from './payslip-draft';
import { createNotification } from './utils';
import { logAudit } from './audit';

// Once a month the server prepares DRAFT payslips for the month that just ended, so HR only has to
// check and approve. Switched on/off (and the day of the month) in Settings > Payslip Settings.
// Nothing is emailed and employees see nothing until HR approves. It runs inside the app's own
// server process (started from instrumentation.ts), once per month, and never twice.

const g = globalThis as any;

async function getSetting(key: string): Promise<string | null> {
  const rows = await query<RowDataPacket[]>('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
  return rows[0]?.setting_value ?? null;
}
async function saveSetting(key: string, value: string) {
  const rows = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  if (rows.length > 0) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, key]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [key, value]);
}

export async function runPayslipAutoDraftOnce(force = false): Promise<{ ran: boolean; message: string }> {
  if (!force && (await getSetting('payslip_auto_draft')) === '0') return { ran: false, message: 'Auto draft is switched off' };
  const dayRaw = (await getSetting('payslip_draft_day')) || '1';
  const now = new Date();
  const daysThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let target: Date; // the month the drafts are for
  if (dayRaw === 'last') {
    // last day of the month (28 / 29 / 30 / 31): drafts are made for the month that is ending today.
    // If that day was missed (server off), the next run still prepares the month that just ended.
    target = now.getDate() === daysThisMonth ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (!force && now.getDate() !== daysThisMonth) {
      const pm = target.getMonth() + 1, py = target.getFullYear();
      if (await getSetting(`payslip_auto_draft_done_${py}-${String(pm).padStart(2, '0')}`)) return { ran: false, message: 'Waiting for the last day of the month' };
    }
  } else {
    const day = Math.min(28, Math.max(1, parseInt(dayRaw) || 1));
    if (!force && now.getDate() < day) return { ran: false, message: `Waiting for day ${day}` };
    target = new Date(now.getFullYear(), now.getMonth() - 1, 1); // the month that has just finished
  }
  const month = target.getMonth() + 1, year = target.getFullYear();
  const doneKey = `payslip_auto_draft_done_${year}-${String(month).padStart(2, '0')}`;
  if (!force && (await getSetting(doneKey))) return { ran: false, message: 'Already prepared for this month' };

  const { generated, skipped } = await generatePayslipsForMonth(month, year, 'auto-draft', 'DRAFT');
  await saveSetting(doneKey, new Date().toISOString());
  await logAudit({ action: 'payslips_auto_drafted', entity_type: 'payslip', entity_id: `${month}/${year}`, performed_by_email: 'system', details: { month, year, generated, skipped } });
  if (generated > 0) {
    await createNotification('Payslip drafts are ready', `${generated} draft payslip(s) for ${month}/${year} are waiting for your check. Open Payroll > Payslip History to review and approve.`, 'payroll_draft', null, true, null);
  }
  return { ran: true, message: `Prepared ${generated} draft payslip(s) for ${month}/${year}` + (skipped ? ` (${skipped} already existed)` : '') };
}

export function startPayslipAutoDraft() {
  if (g.__payslipAutoDraftStarted) return;
  g.__payslipAutoDraftStarted = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { const r = await runPayslipAutoDraftOnce(); if (r.ran) console.log('[payslip-auto-draft]', r.message); }
    catch (e: any) { console.error('[payslip-auto-draft] failed:', e?.message || e); }
    finally { running = false; }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 60 * 60_000); // hourly check; the monthly marker keeps it to once
  console.log('[payslip-auto-draft] started');
}
