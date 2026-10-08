import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

const n = (v: any) => Number(v) || 0;

// ---------------------------------------------------------------------------
// Salary split columns. The four built-in earnings (Basic, HRA, Conveyance, Food) always
// exist; HR can add more columns of their own (label + %) under Salary Structures >
// Configure Split. A custom column's amount is stored per employee in
// salary_structures.extra_components as [{key, label, amount}] and copied to the payslip
// (payslips.extra_components) as [{label, amount}] - so old payslips keep what they had
// even if a column is later renamed or removed.
// ---------------------------------------------------------------------------
// kind: earning (part of the monthly salary - the 100% cap applies to these), deduction (taken off
// the salary), adjustment (added on top: incentive, EL encashment).
export type SplitKind = 'earning' | 'deduction' | 'adjustment';
export interface SplitComponent { key: string; label: string; percent: number; builtin: boolean; kind: SplitKind }
export const BUILTIN_SPLIT: { key: string; label: string; legacy?: string; def: number; kind: SplitKind }[] = [
  { key: 'basic_pay', label: 'Basic Pay', legacy: 'default_basic_percent', def: 50, kind: 'earning' },
  { key: 'hra', label: 'House Rent Allowance', legacy: 'default_hra_percent', def: 30, kind: 'earning' },
  { key: 'conveyance_allowance', label: 'Conveyance Allowance', legacy: 'default_conveyance_percent', def: 15, kind: 'earning' },
  { key: 'food_vouchers', label: 'Food Vouchers', legacy: 'default_food_percent', def: 5, kind: 'earning' },
  { key: 'medical_insurance', label: 'Medical Insurance', def: 0, kind: 'deduction' },
  { key: 'other_deductions', label: 'Other Deductions', def: 0, kind: 'deduction' },
  { key: 'incentives', label: 'Incentives', def: 0, kind: 'adjustment' },
  { key: 'el_encashment', label: 'EL Encashment', def: 0, kind: 'adjustment' },
];
export const CUSTOM_KEY = /^x_[a-z0-9]{3,24}$/;

export async function getSplitComponents(): Promise<SplitComponent[]> {
  const keys = ['salary_split_components', ...BUILTIN_SPLIT.filter(b => b.legacy).map(b => b.legacy as string)];
  const rows = await query<RowDataPacket[]>(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`, keys
  );
  const s: Record<string, string> = {};
  for (const r of rows) s[r.setting_key] = r.setting_value;
  let saved: any[] = [];
  try { saved = JSON.parse(s.salary_split_components || '[]'); } catch { saved = []; }
  const out: SplitComponent[] = BUILTIN_SPLIT.map(b => {
    const fromJson = saved.find(x => x && x.key === b.key);
    const pct = fromJson ? Number(fromJson.percent) : parseFloat(b.legacy ? (s[b.legacy] ?? '') : '');
    return { key: b.key, label: b.label, percent: isNaN(pct) ? b.def : pct, builtin: true, kind: b.kind };
  });
  for (const c of saved) {
    if (c && CUSTOM_KEY.test(String(c.key)) && String(c.label || '').trim()) {
      out.push({ key: c.key, label: String(c.label).trim().slice(0, 40), percent: Number(c.percent) || 0, builtin: false, kind: c.kind === 'deduction' ? 'deduction' : 'earning' });
    }
  }
  return out;
}

// [{key,label,amount,type}] from the stored JSON (or an array); bad / empty input gives [].
// type is 'earning' (default - older data has none) or 'deduction'.
export function parseExtraComponents(raw: any): { key: string; label: string; amount: number; type: 'earning' | 'deduction' }[] {
  let arr: any = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => ({ key: String(x?.key || ''), label: String(x?.label || '').trim().slice(0, 40), amount: Number(x?.amount) || 0, type: (x?.type === 'deduction' ? 'deduction' : 'earning') as 'earning' | 'deduction' }))
    .filter(x => x.label);
}

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
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslips' AND COLUMN_NAME IN ('extra_work_days','extra_work_pay','variable_pay','extra_components')"
  );
  const have = new Set(cols.map(c => c.COLUMN_NAME));
  if (!have.has('extra_work_days')) await execute('ALTER TABLE payslips ADD COLUMN extra_work_days FLOAT NOT NULL DEFAULT 0');
  if (!have.has('extra_work_pay')) await execute('ALTER TABLE payslips ADD COLUMN extra_work_pay FLOAT NOT NULL DEFAULT 0');
  if (!have.has('variable_pay')) await execute('ALTER TABLE payslips ADD COLUMN variable_pay FLOAT NOT NULL DEFAULT 0');
  if (!have.has('extra_components')) await execute('ALTER TABLE payslips ADD COLUMN extra_components TEXT NULL');
  payslipColumnsReady = true;
}

export async function getEwMultiplier(): Promise<number> {
  const rows = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'ew_pay_multiplier'");
  const v = parseFloat(rows[0]?.setting_value);
  return v >= 0 ? v : 1;
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
