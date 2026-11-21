// @ts-nocheck
import { query } from './db';
import { RowDataPacket } from 'mysql2';
import { computeSalarySheet } from './salary-sheet';
import { attendanceWeights } from './status-master';
import { getHolidayDates } from './holidays';

// Full and final settlement of an employee who is leaving. The lines are SUGGESTED from the salary sheet and attendance (HR can change
// every amount and add lines of their own before the settlement is marked done):
//   - salary of the last month up to the last working day (paid days x PerDay Salary)
//   - salary of earlier months that have no payslip yet (when the payslips of the employee stop before the last month)
//   - EL balance x PerDay Salary x the EL rate (Settings below)
//   - notice shortfall: days short of the notice period x PerDay Salary, recovered (can be switched off, and HR can set the amount to 0)

export interface FnfLine { key: string; label: string; amount: number; type: 'earning' | 'deduction'; auto: boolean }
const r2 = (v: number) => Math.round(v * 100) / 100;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function getFnfSettings(): Promise<{ noticeDays: number; elRate: number; noticeRecovery: boolean }> {
  const rows = await query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('exit_notice_days', 'fnf_el_rate', 'fnf_notice_recovery')");
  let noticeDays = 30, elRate = 1, noticeRecovery = true;
  for (const r of rows) {
    if (r.setting_key === 'exit_notice_days') { const n = parseInt(r.setting_value); if (n >= 0 && n <= 365) noticeDays = n; }
    if (r.setting_key === 'fnf_el_rate') { const n = Number(r.setting_value); if (n >= 0 && n <= 5) elRate = n; }
    if (r.setting_key === 'fnf_notice_recovery') noticeRecovery = r.setting_value !== '0';
  }
  return { noticeDays, elRate, noticeRecovery };
}

export const fnfNet = (lines: FnfLine[]) => r2(lines.reduce((t, l) => t + (l.type === 'deduction' ? -1 : 1) * (Number(l.amount) || 0), 0));

const daysBetween = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

export async function suggestFnf(exit: { emp_code: string; resignation_date: string; last_working_day: string; notice_days: number }): Promise<{ lines: FnfLine[]; info: any }> {
  const lines: FnfLine[] = [];
  const info: any = { warnings: [] };
  const cfg = await getFnfSettings();
  const lwd = String(exit.last_working_day).slice(0, 10);
  const y = +lwd.slice(0, 4), m = +lwd.slice(5, 7), d = +lwd.slice(8, 10);

  const row = (await computeSalarySheet(m, y, exit.emp_code))[0];
  if (!row) {
    info.warnings.push('This employee has no salary structure (or is not a working employee), so no salary lines could be suggested. Add the amounts by hand.');
    return { lines, info };
  }
  const perDay = row.month_days > 0 ? row.salary / row.month_days : 0;
  info.per_day = r2(perDay); info.month_days = row.month_days;

  // payslips that exist already
  const slips = await query<RowDataPacket[]>('SELECT month, year FROM payslips WHERE emp_code = ?', [exit.emp_code]);
  const hasSlip = new Set(slips.map(s => `${s.year}-${s.month}`));
  const lastSlip = slips.reduce((best: any, s: any) => (!best || s.year * 12 + s.month > best.year * 12 + best.month ? s : best), null);

  // earlier months without a payslip (only when payslips exist for this employee, so it is known where they stop)
  if (lastSlip) {
    let cy = lastSlip.year, cm = lastSlip.month + 1;
    if (cm > 12) { cm = 1; cy++; }
    while (cy * 12 + cm < y * 12 + m) {
      if (!hasSlip.has(`${cy}-${cm}`)) {
        const prev = (await computeSalarySheet(cm, cy, exit.emp_code))[0];
        if (prev) lines.push({ key: `salary_${cy}_${cm}`, label: `Salary for ${MONTHS[cm - 1]} ${cy} (no payslip yet)`, amount: r2(prev.final_salary), type: 'earning', auto: true });
      }
      cm++; if (cm > 12) { cm = 1; cy++; }
    }
  }

  // the last month, up to the last working day
  if (hasSlip.has(`${y}-${m}`)) {
    info.warnings.push(`A payslip for ${MONTHS[m - 1]} ${y} already exists, so the salary of the last month is not added again.`);
  } else {
    const weights = await attendanceWeights();
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const att = await query<RowDataPacket[]>("SELECT DATE_FORMAT(attendance_date, '%Y-%m-%d') AS d, status FROM attendance WHERE emp_code = ? AND attendance_date BETWEEN ? AND ?", [exit.emp_code, first, lwd]);
    const holidays = await getHolidayDates(first, lwd);
    let unpaid = 0;
    for (const a of att) { const w = weights[a.status]; if (w && w.unpaid > 0 && !holidays.has(a.d)) unpaid += w.unpaid; }
    const paid = Math.max(0, Math.min(d, row.month_days) - unpaid);
    info.paid_days = paid; info.unpaid_days = unpaid;
    const frac = row.month_days > 0 ? paid / row.month_days : 0;
    // only the salary of the days worked is suggested; Extra Work pay, incentives, insurance and other deductions of the month are added by HR
    lines.push({ key: 'salary_last', label: `Salary for 1 - ${d} ${MONTHS[m - 1]} ${y} (${paid} paid day${paid === 1 ? '' : 's'})`, amount: r2(row.salary * frac), type: 'earning', auto: true });
  }

  // EL
  info.el_balance = row.el_balance;
  if (row.el_balance > 0 && perDay > 0) lines.push({ key: 'el', label: `EL balance ${row.el_balance} day${row.el_balance === 1 ? '' : 's'} x PerDay Salary${cfg.elRate !== 1 ? ` x ${cfg.elRate}` : ''}`, amount: r2(row.el_balance * perDay * cfg.elRate), type: 'earning', auto: true });

  // notice period
  const served = Math.max(0, daysBetween(String(exit.resignation_date).slice(0, 10), lwd));
  const shortfall = Math.max(0, (Number(exit.notice_days) || 0) - served);
  info.notice_days = Number(exit.notice_days) || 0; info.notice_served = served; info.notice_shortfall = shortfall;
  if (cfg.noticeRecovery && shortfall > 0 && perDay > 0) lines.push({ key: 'notice', label: `Notice period shortfall ${shortfall} day${shortfall === 1 ? '' : 's'} x PerDay Salary`, amount: r2(shortfall * perDay), type: 'deduction', auto: true });

  return { lines, info };
}
