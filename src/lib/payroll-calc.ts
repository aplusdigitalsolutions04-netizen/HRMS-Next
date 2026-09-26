import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

const n = (v: any) => Number(v) || 0;

// Matches the PDF layout: Earnings (basic, HRA, conveyance, food), Deductions
// (medical insurance, others) and Adjustments (incentive, EL encash).
export function calcPayslipTotals(s: any, extraWorkPay = 0) {
  const gross = n(s.basic_pay) + n(s.hra) + n(s.conveyance_allowance) + n(s.food_vouchers);
  const deductions = n(s.medical_insurance) + n(s.other_deductions);
  const adjustments = n(s.incentives) + n(s.el_encashment) + n(extraWorkPay);
  return { gross, deductions, adjustments, net: gross - deductions + adjustments };
}

let payslipColumnsReady = false;
// payslips gets extra_work_days / extra_work_pay the first time it is needed.
export async function ensurePayslipColumns() {
  if (payslipColumnsReady) return;
  const cols = await query<RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND COLUMN_NAME IN ('extra_work_days','extra_work_pay','variable_pay')"
  );
  const have = new Set(cols.map(c => c.COLUMN_NAME));
  if (!have.has('extra_work_days')) await execute('ALTER TABLE payslips ADD COLUMN extra_work_days FLOAT NOT NULL DEFAULT 0');
  if (!have.has('extra_work_pay')) await execute('ALTER TABLE payslips ADD COLUMN extra_work_pay FLOAT NOT NULL DEFAULT 0');
  if (!have.has('variable_pay')) await execute('ALTER TABLE payslips ADD COLUMN variable_pay FLOAT NOT NULL DEFAULT 0');
  payslipColumnsReady = true;
}

// Extra Work (EW) days in the month are paid at one day's pay each
// (monthly gross / days in month) times the multiplier from Payslip Settings.
export async function getExtraWork(empCode: string, month: number, year: number, gross: number, multiplier: number) {
  const rows = await query<RowDataPacket[]>(
    "SELECT COUNT(*) AS days FROM attendance WHERE emp_code = ? AND status = 'EW' AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?",
    [empCode, month, year]
  );
  const days = Number(rows[0]?.days) || 0;
  const perDay = gross / new Date(year, month, 0).getDate();
  return { days, pay: Math.round(perDay * days * multiplier * 100) / 100 };
}

export async function getEwMultiplier(): Promise<number> {
  const rows = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'ew_pay_multiplier'");
  const v = parseFloat(rows[0]?.setting_value);
  return v >= 0 ? v : 1;
}

// Paid days from synced attendance: days in month minus absent days
// (half-days count 0.5). Weekly offs are paid. With no attendance at all
// for the month, falls back to the full month.
export async function getPaidDays(empCode: string, month: number, year: number): Promise<number> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status='A'), 0) AS absent,
            COALESCE(SUM(status='HD'), 0) AS half
     FROM attendance WHERE emp_code = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`,
    [empCode, month, year]
  );
  if (!rows[0] || Number(rows[0].total) === 0) return daysInMonth;
  return Math.max(0, daysInMonth - Number(rows[0].absent) - Number(rows[0].half) * 0.5);
}

// "Prepared By" / "Authorised By" names and signature images printed at the bottom
// of every payslip, managed under Settings > Payslip Settings.
export const SIGNATORY_KEYS = {
  prepared_by: 'payslip_prepared_by',
  authorised_by: 'payslip_authorised_by',
  prepared_signature: 'payslip_prepared_signature',
  authorised_signature: 'payslip_authorised_signature',
} as const;

export async function getPayslipSignatories(): Promise<Record<keyof typeof SIGNATORY_KEYS, string>> {
  const keys = Object.values(SIGNATORY_KEYS);
  const rows = await query<RowDataPacket[]>(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
    keys
  );
  const s: Record<string, string> = {};
  for (const r of rows) s[r.setting_key] = r.setting_value;
  const out: any = {};
  for (const [field, key] of Object.entries(SIGNATORY_KEYS)) out[field] = s[key] || '';
  return out;
}

// EL Encashment can be paid together every N months (Settings > Payslip Settings)
// instead of monthly. The salary structure keeps the per-month amount; on a payout
// month (month is a multiple of N) the payslip carries N months' worth, and the
// months in between carry 0. N = 1 (the default) keeps it paid every month.
export async function getElPayoutInterval(): Promise<number> {
  const rows = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'el_payout_interval_months'");
  const v = parseInt(rows[0]?.setting_value);
  return v >= 1 && v <= 12 ? v : 1;
}

export function elEncashmentForMonth(monthlyAmount: any, month: number, interval: number): number {
  const amount = Number(monthlyAmount) || 0;
  if (!interval || interval <= 1) return amount;
  return month % interval === 0 ? Math.round(amount * interval * 100) / 100 : 0;
}
