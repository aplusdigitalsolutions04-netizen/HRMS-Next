import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { getEwMultiplier, getElPayoutInterval, elEncashmentForMonth, parseExtraComponents } from './payroll-calc';
import { getHolidayDates } from './holidays';
import { employeeCodes, inList, attendanceWeights } from './status-master';

const n = (v: any) => Number(v) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;
const pad = (v: number) => String(v).padStart(2, '0');

// ---------------------------------------------------------------------------
// Monthly salary sheet. One calculation shared by the Salary Sheet page, its
// Excel export and payslip generation, so all three always show the same numbers.
//
//   Month Days     actual days in the month (or a fixed 30, see Payslip Settings)
//   UnPaid Days    absent (A) days + 0.5 for every half day (HD)
//                  - weekly offs, WFH, Extra Work and holidays are always paid
//                  - a day that is in the Holiday Calendar (Settings) is paid even
//                    if attendance says absent
//   Paid Days      Month Days - UnPaid Days
//   Salary         Basic + HRA + Conveyance + Food Vouchers (from the structure)
//   PerDaySalary   Salary / Month Days
//   Net Payable    PerDaySalary x Paid Days (each component is prorated the same way)
//   EL Pay         PerDaySalary x EL days typed by HR for the month
//   Final Transfer Net Payable - Insurance - Other Deductions
//                  + Variable Pay + Incentive + EL Pay + Extra Work pay
//
// HR fixes a single day by editing it in Daily Attendance (e.g. mark it HOL or
// WFH); an approved WFH request marks its days WFH by itself.
// ---------------------------------------------------------------------------

let adjustmentsReady = false;
export async function ensureAdjustmentsTable() {
  if (adjustmentsReady) return;
  await execute(`CREATE TABLE IF NOT EXISTS salary_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    emp_code VARCHAR(50) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    incentive FLOAT NULL,
    el_days FLOAT NULL,
    variable_pay FLOAT NULL,
    ew_days FLOAT NULL,
    updated_by VARCHAR(100) NULL,
    updated_at DATETIME NULL,
    UNIQUE KEY uq_adj (emp_code, month, year)
  )`);
  // Tables created by an earlier version get the newer columns added once.
  const cols = await query<RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'salary_adjustments'"
  );
  const have = new Set(cols.map(c => c.COLUMN_NAME));
  if (!have.has('variable_pay')) await execute('ALTER TABLE salary_adjustments ADD COLUMN variable_pay FLOAT NULL');
  if (!have.has('ew_days')) await execute('ALTER TABLE salary_adjustments ADD COLUMN ew_days FLOAT NULL');
  adjustmentsReady = true;
}

export async function getMonthDaysMode(): Promise<'actual' | '30'> {
  const rows = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'salary_month_days_mode'");
  return rows[0]?.setting_value === '30' ? '30' : 'actual';
}

export interface SalarySheetRow {
  emp_code: string;
  full_name: string;
  designation: string;
  month_days: number;
  paid_days: number;
  unpaid_days: number;
  has_attendance: boolean;
  salary: number;            // full monthly salary from the structure
  per_day_salary: number;
  net_payable: number;       // prorated salary (= sum of the four components below)
  basic_pay: number;
  hra: number;
  conveyance_allowance: number;
  food_vouchers: number;
  extra_components: { key: string; label: string; amount: number; type: 'earning' | 'deduction' }[]; // custom split columns (earnings prorated, deductions as saved)
  custom_deductions: number;
  insurance: number;
  other_deductions: number;
  incentive: number;
  incentive_overridden: boolean;
  variable_pay: number;      // typed by HR for the month
  el_days: number | null;    // HR-entered EL days for this month, if any
  el_pay: number;
  extra_work_days: number;
  extra_work_days_overridden: boolean;
  extra_work_pay: number;
  total_deductions: number;
  total_adjustments: number;
  final_salary: number;
}

export async function computeSalarySheet(month: number, year: number, onlyEmpCode?: string): Promise<SalarySheetRow[]> {
  await ensureAdjustmentsTable();
  const [mode, ewMultiplier, elInterval] = await Promise.all([getMonthDaysMode(), getEwMultiplier(), getElPayoutInterval()]);

  // Which employee statuses are paid on the salary sheet: Settings > Status Master (Working employee).
  const working = inList(await employeeCodes('is_working'));
  const weights = await attendanceWeights();
  const employees = await query<RowDataPacket[]>(
    `SELECT e.emp_code, e.full_name, e.designation,
            ss.basic_pay, ss.hra, ss.conveyance_allowance, ss.food_vouchers,
            ss.medical_insurance, ss.other_deductions, ss.incentives, ss.el_encashment, ss.extra_components
     FROM employees e JOIN salary_structures ss ON e.emp_code = ss.emp_code
     WHERE e.status IN ${working.sql} AND e.is_deleted = 0 ${onlyEmpCode ? 'AND e.emp_code = ?' : ''}
     ORDER BY e.full_name`,
    [...working.params, ...(onlyEmpCode ? [onlyEmpCode] : [])]
  );

  const calendarDays = new Date(year, month, 0).getDate();
  const monthDays = mode === '30' ? 30 : calendarDays;
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(calendarDays)}`;

  // Government/company holidays from Settings > Holiday Calendar (not a generic calendar).
  const holidays = await getHolidayDates(from, to);

  // Per employee: how many days have a record, and which days are absent / half day.
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const rowsAtt = await query<RowDataPacket[]>(
    `SELECT emp_code, DATE_FORMAT(attendance_date, '%Y-%m-%d') AS d, status
     FROM attendance WHERE attendance_date BETWEEN ? AND ?`,
    [from, to]
  );
  const attBy = new Map<string, { total: number; unpaid: number; ew: number }>();
  for (const a of rowsAtt) {
    const k = String(a.emp_code);
    const t = attBy.get(k) || { total: 0, unpaid: 0, ew: 0 };
    t.total++;
    const w = weights[a.status]; // from Settings > Status Master
    if (w?.extraPay) t.ew++;
    // A holiday is a paid day whatever the punch data says. A future day (TeamOffice
    // lists the whole month, with no-punch days as absent) is not unpaid yet either.
    if (w && w.unpaid > 0 && !holidays.has(a.d) && a.d <= today) t.unpaid += w.unpaid;
    attBy.set(k, t);
  }

  const adj = await query<RowDataPacket[]>('SELECT emp_code, incentive, el_days, variable_pay, ew_days FROM salary_adjustments WHERE month = ? AND year = ?', [month, year]);
  const adjByEmp = new Map(adj.map(a => [String(a.emp_code), a]));
  const has = (v: any) => v !== null && v !== undefined;

  return employees.map((e): SalarySheetRow => {
    const a = attBy.get(String(e.emp_code));
    const hasAtt = !!a && a.total > 0;
    const unpaid = hasAtt ? a!.unpaid : 0;
    const paid = Math.max(0, Math.min(monthDays, monthDays - unpaid));
    const factor = monthDays > 0 ? paid / monthDays : 0;

    const allExtras = parseExtraComponents(e.extra_components);
    const extras = allExtras.filter(x => x.type === 'earning');            // part of the salary
    const extraDeds = allExtras.filter(x => x.type === 'deduction');       // taken off, never prorated
    const customDeductions = r2(extraDeds.reduce((t, x) => t + x.amount, 0));
    const salary = n(e.basic_pay) + n(e.hra) + n(e.conveyance_allowance) + n(e.food_vouchers) + extras.reduce((t, x) => t + x.amount, 0);
    const perDay = monthDays > 0 ? salary / monthDays : 0;
    const basic = r2(n(e.basic_pay) * factor);
    const hra = r2(n(e.hra) * factor);
    const conv = r2(n(e.conveyance_allowance) * factor);
    const food = r2(n(e.food_vouchers) * factor);
    const extraPaid = extras.map(x => ({ key: x.key, label: x.label, amount: r2(x.amount * factor), type: 'earning' as const }));
    const netPayable = r2(basic + hra + conv + food + extraPaid.reduce((t, x) => t + x.amount, 0));

    const o = adjByEmp.get(String(e.emp_code));
    const incentiveOverridden = !!o && has(o.incentive);
    const incentive = incentiveOverridden ? n(o!.incentive) : n(e.incentives);
    const variablePay = o && has(o.variable_pay) ? n(o.variable_pay) : 0;
    const elDays = o && has(o.el_days) ? n(o.el_days) : null;
    const elPay = elDays !== null ? r2(elDays * perDay) : n(elEncashmentForMonth(e.el_encashment, month, elInterval));

    const ewOverridden = !!o && has(o.ew_days);
    const ewDays = ewOverridden ? n(o!.ew_days) : hasAtt ? a!.ew : 0;
    const ewPay = r2(perDay * ewDays * ewMultiplier);

    const insurance = n(e.medical_insurance);
    const otherDed = n(e.other_deductions);
    const totalDed = r2(insurance + otherDed + customDeductions);
    const totalAdj = r2(variablePay + incentive + elPay + ewPay);

    return {
      emp_code: String(e.emp_code), full_name: e.full_name || '', designation: e.designation || '',
      month_days: monthDays, paid_days: paid, unpaid_days: unpaid, has_attendance: hasAtt,
      salary: r2(salary), per_day_salary: r2(perDay), net_payable: netPayable,
      basic_pay: basic, hra, conveyance_allowance: conv, food_vouchers: food, extra_components: [...extraPaid, ...extraDeds.map(x => ({ key: x.key, label: x.label, amount: r2(x.amount), type: 'deduction' as const }))], custom_deductions: customDeductions,
      insurance, other_deductions: otherDed,
      incentive, incentive_overridden: incentiveOverridden,
      variable_pay: variablePay,
      el_days: elDays, el_pay: elPay,
      extra_work_days: ewDays, extra_work_days_overridden: ewOverridden, extra_work_pay: ewPay,
      total_deductions: totalDed, total_adjustments: totalAdj,
      final_salary: r2(netPayable - totalDed + totalAdj),
    };
  });
}

// HR sets a month's manual entries for one employee. null clears an entry (back
// to the salary structure / attendance value).
export type AdjustmentPatch = { incentive?: number | null; el_days?: number | null; variable_pay?: number | null; ew_days?: number | null };
const ADJ_FIELDS = ['incentive', 'el_days', 'variable_pay', 'ew_days'] as const;

export async function saveAdjustment(empCode: string, month: number, year: number, patch: AdjustmentPatch, by: string) {
  await ensureAdjustmentsTable();
  const existing = await query<RowDataPacket[]>('SELECT * FROM salary_adjustments WHERE emp_code = ? AND month = ? AND year = ?', [empCode, month, year]);
  const merged: Record<string, number | null> = {};
  for (const f of ADJ_FIELDS) merged[f] = f in patch ? (patch as any)[f] : existing[0]?.[f] ?? null;
  if (existing.length > 0) {
    await execute(
      'UPDATE salary_adjustments SET incentive = ?, el_days = ?, variable_pay = ?, ew_days = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [merged.incentive, merged.el_days, merged.variable_pay, merged.ew_days, by, existing[0].id]
    );
  } else {
    await execute(
      'INSERT INTO salary_adjustments (emp_code, month, year, incentive, el_days, variable_pay, ew_days, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?,NOW())',
      [empCode, month, year, merged.incentive, merged.el_days, merged.variable_pay, merged.ew_days, by]
    );
  }
}
