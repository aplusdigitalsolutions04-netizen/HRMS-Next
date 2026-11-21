import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { getEwMultiplier, getElPayoutInterval, elEncashmentForMonth, parseExtraComponents } from './payroll-calc';
import { getHolidayDates } from './holidays';
import { employeeCodes, inList, attendanceWeights } from './status-master';
import { applyStructureHistory } from './salary-history';
import { loadStatutoryRules, computeStatutory } from './statutory';

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
  statutory: { code: string; name: string; employee: number; employer: number }[];   // PF / ESI / TDS ... as set up in Statutory Deductions
  statutory_total: number;
  employer_contrib: number;  // what the company pays on top (not taken from the employee)
  incentive: number;
  incentive_overridden: boolean;
  variable_pay: number;      // typed by HR for the month
  el_days: number | null;    // HR-entered EL days for this month, if any
  el_pay: number;
  extra_work_days: number;
  extra_work_days_overridden: boolean;
  extra_work_pay: number;
  el_earned: number;         // EL days earned this month (= Extra Work days)
  el_credited: number;       // EL days given this month by the employee's EL period (the whole period at once, at its end)
  el_balance: number;        // all EL earned up to this month (only shown, never used up)
  cl_used: number;           // Casual Leave days taken this year up to this month (status CL = 1 day, CL/2 = half a day)
  cl_left: number;           // the yearly CL quota (Attendance Settings, 12 unless changed) minus cl_used
  total_deductions: number;
  total_adjustments: number;
  final_salary: number;
}

export async function computeSalarySheet(month: number, year: number, onlyEmpCode?: string): Promise<SalarySheetRow[]> {
  await ensureAdjustmentsTable();
  const [mode, ewMultiplier, elInterval] = await Promise.all([getMonthDaysMode(), getEwMultiplier(), getElPayoutInterval()]);
  const statRules = await loadStatutoryRules();

  // Which employee statuses are paid on the salary sheet: Settings > Status Master (Working employee).
  const working = inList(await employeeCodes('is_working'));
  const weights = await attendanceWeights();
  const employees = await query<RowDataPacket[]>(
    `SELECT e.emp_code, e.full_name, e.designation,
            ss.basic_pay, ss.hra, ss.conveyance_allowance, ss.food_vouchers,
            ss.medical_insurance, ss.other_deductions, ss.incentives, ss.el_encashment, ss.extra_components, ss.statutory_off, ef.months AS el_months
     FROM employees e JOIN salary_structures ss ON e.emp_code = ss.emp_code
     LEFT JOIN el_frequencies ef ON ef.id = ss.el_frequency_id AND ef.is_active = 1
     WHERE e.status IN ${working.sql} AND e.is_deleted = 0 ${onlyEmpCode ? 'AND e.emp_code = ?' : ''}
     ORDER BY e.full_name`,
    [...working.params, ...(onlyEmpCode ? [onlyEmpCode] : [])]
  );

  await applyStructureHistory(employees, month, year);   // a month before a salary revision is worked out with the structure of that time

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

  // EL (earned leave): every Extra Work day earns one EL day. Each month's earned days are known from attendance (HR's typed
  // Extra Work days for a month win). The balance is everything earned so far. "Given" shows the days the employee's EL period hands
  // over together at its end (Monthly: every month, Quarterly: Mar/Jun/Sep/Dec, ...). Nothing takes EL away - it is only shown and saved.
  const ewCodes = Object.keys(weights).filter(c => weights[c]?.extraPay);
  const earnedBy = new Map<string, number>();
  let firstYear = year;
  if (ewCodes.length) {
    const hist = await query<RowDataPacket[]>(
      `SELECT emp_code, YEAR(attendance_date) AS y, MONTH(attendance_date) AS m, COUNT(*) AS c FROM attendance
       WHERE status IN (${ewCodes.map(() => '?').join(',')}) AND attendance_date <= ? GROUP BY emp_code, y, m`,
      [...ewCodes, to]
    );
    for (const h of hist) { earnedBy.set(`${h.emp_code}|${h.y}|${h.m}`, n(h.c)); firstYear = Math.min(firstYear, Number(h.y)); }
  }
  const typed = await query<RowDataPacket[]>('SELECT emp_code, month, year, ew_days FROM salary_adjustments WHERE ew_days IS NOT NULL');
  for (const t of typed) { earnedBy.set(`${t.emp_code}|${t.year}|${t.month}`, n(t.ew_days)); firstYear = Math.min(firstYear, Number(t.year)); }
  // Casual Leave: a fixed number of days a year (Settings > Attendance Settings, 12 unless changed). Used days are the days marked
  // CL (1) and CL/2 (half) in attendance from January to this month. Shown on the sheet; it does not change anyone's pay.
  const clQuotaRow = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'cl_yearly_days'");
  const clQuota = Number(clQuotaRow[0]?.setting_value) >= 0 && clQuotaRow[0]?.setting_value !== undefined && clQuotaRow[0]?.setting_value !== '' ? Number(clQuotaRow[0].setting_value) : 12;
  const clRows = await query<RowDataPacket[]>(
    "SELECT emp_code, status, COUNT(*) AS c FROM attendance WHERE status IN ('CL', 'CL/2') AND attendance_date BETWEEN ? AND ? GROUP BY emp_code, status",
    [`${year}-01-01`, to]
  );
  const clUsedBy = new Map<string, number>();
  for (const c of clRows) clUsedBy.set(String(c.emp_code), (clUsedBy.get(String(c.emp_code)) || 0) + n(c.c) * (c.status === 'CL/2' ? 0.5 : 1));
  const earnedIn = (code: string, y: number, m: number) => earnedBy.get(`${code}|${y}|${m}`) || 0;
  const creditedIn = (code: string, y: number, m: number, period: number) => {
    if (m % period !== 0) return 0;
    let t = 0;
    for (let k = Math.max(1, m - period + 1); k <= m; k++) t += earnedIn(code, y, k);
    return t;
  };

  const sheet = employees.map((e): SalarySheetRow => {
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
    const elPay = elDays !== null ? r2(elDays * perDay) : n(elEncashmentForMonth(e.el_encashment, month, Number(e.el_months) >= 1 ? Number(e.el_months) : elInterval));

    const ewOverridden = !!o && has(o.ew_days);
    const ewDays = ewOverridden ? n(o!.ew_days) : hasAtt ? a!.ew : 0;
    const ewPay = r2(perDay * ewDays * ewMultiplier);

    const insurance = n(e.medical_insurance);
    const otherDed = n(e.other_deductions);
    const stat = computeStatutory(statRules, { basicPaid: basic, grossPaid: netPayable, fullGross: salary, off: String(e.statutory_off || '').split(',').map(x => x.trim()).filter(Boolean) });
    const totalDed = r2(insurance + otherDed + customDeductions + stat.employee);
    const totalAdj = r2(variablePay + incentive + elPay + ewPay);

    const code = String(e.emp_code);
    const period = Number(e.el_months) >= 1 ? Number(e.el_months) : elInterval;
    let elBalance = 0;
    for (let y = firstYear; y <= year; y++) for (let m = 1; m <= (y === year ? month : 12); m++) elBalance += earnedIn(code, y, m);

    return {
      emp_code: String(e.emp_code), full_name: e.full_name || '', designation: e.designation || '',
      month_days: monthDays, paid_days: paid, unpaid_days: unpaid, has_attendance: hasAtt,
      salary: r2(salary), per_day_salary: r2(perDay), net_payable: netPayable,
      basic_pay: basic, hra, conveyance_allowance: conv, food_vouchers: food, extra_components: [...extraPaid, ...extraDeds.map(x => ({ key: x.key, label: x.label, amount: r2(x.amount), type: 'deduction' as const }))], custom_deductions: customDeductions,
      insurance, other_deductions: otherDed, statutory: stat.lines, statutory_total: stat.employee, employer_contrib: stat.employer,
      incentive, incentive_overridden: incentiveOverridden,
      variable_pay: variablePay,
      el_days: elDays, el_pay: elPay,
      extra_work_days: ewDays, extra_work_days_overridden: ewOverridden, extra_work_pay: ewPay,
      el_earned: r2(ewDays), el_credited: r2(creditedIn(code, year, month, period)), el_balance: r2(elBalance),
      cl_used: r2(clUsedBy.get(code) || 0), cl_left: clQuota > 0 ? r2(clQuota - (clUsedBy.get(code) || 0)) : 0,   // a yearly CL limit of 0 means no limit, so there is nothing "left" to show
      total_deductions: totalDed, total_adjustments: totalAdj,
      final_salary: r2(netPayable - totalDed + totalAdj),
    };
  });

  // Saved in the database (one row per employee and month, rewritten each time the sheet is worked out). Future months are not saved.
  const nowD = new Date();
  if (year * 12 + month <= nowD.getFullYear() * 12 + nowD.getMonth() + 1) {
    await execute(`CREATE TABLE IF NOT EXISTS el_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY, emp_code VARCHAR(50) NOT NULL, month INT NOT NULL, year INT NOT NULL,
      earned_days FLOAT NOT NULL DEFAULT 0, credited_days FLOAT NOT NULL DEFAULT 0, balance_days FLOAT NOT NULL DEFAULT 0,
      period_months INT NOT NULL DEFAULT 1, updated_at DATETIME NULL, UNIQUE KEY uq_el_ledger (emp_code, month, year))`);
    for (const r of sheet) {
      const emp = employees.find(x => String(x.emp_code) === r.emp_code);
      const period = Number(emp?.el_months) >= 1 ? Number(emp?.el_months) : elInterval;
      await execute(
        `INSERT INTO el_ledger (emp_code, month, year, earned_days, credited_days, balance_days, period_months, updated_at) VALUES (?,?,?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE earned_days = VALUES(earned_days), credited_days = VALUES(credited_days), balance_days = VALUES(balance_days), period_months = VALUES(period_months), updated_at = NOW()`,
        [r.emp_code, month, year, r.el_earned, r.el_credited, r.el_balance, period]
      ).catch(() => {});
    }
  }
  return sheet;
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
