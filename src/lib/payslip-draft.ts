// @ts-nocheck
import { query, execute } from './db';
import { uuidv4 } from './utils';
import { RowDataPacket } from 'mysql2';
import { ensurePayslipColumns } from './payroll-calc';
import { computeSalarySheet } from './salary-sheet';

// New payslips start as DRAFT: HR checks them, then approves (and emails). Employees only ever see
// APPROVED ones. Numbers always come from the Salary Sheet calculation, so a draft equals what the
// sheet showed when it was made.

export async function insertPayslipRow(r: any, month: number, year: number, generatedBy: string, status: 'DRAFT' | 'APPROVED' = 'DRAFT'): Promise<string> {
  const id = uuidv4();
  await execute(
    `INSERT INTO payslips (id, emp_code, month, year, basic_pay, hra, conveyance_allowance, food_vouchers, medical_insurance, other_deductions, incentives, el_encashment, gross_salary, total_deductions, total_adjustments, net_salary, paid_days, extra_work_days, extra_work_pay, variable_pay, extra_components, leave_availed, casual_leave, earned_leave, generated_by, generated_at, email_sent_at, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,NOW(),NULL,?)`,
    [id, r.emp_code, month, year, r.basic_pay, r.hra, r.conveyance_allowance, r.food_vouchers, r.insurance, r.other_deductions, r.incentive, r.el_pay, r.net_payable, r.total_deductions, r.total_adjustments, r.final_salary, r.paid_days, r.extra_work_days, r.extra_work_pay, r.variable_pay,
      r.extra_components && r.extra_components.length ? JSON.stringify(r.extra_components.map((x: any) => ({ label: x.label, amount: x.amount, type: x.type }))) : null,
      generatedBy, status]
  );
  return id;
}

// One payslip for every active employee with a salary structure who does not have one for the month yet.
export async function generatePayslipsForMonth(month: number, year: number, generatedBy: string, status: 'DRAFT' | 'APPROVED' = 'DRAFT') {
  const sheet = await computeSalarySheet(month, year);
  await ensurePayslipColumns();
  const results: { emp_code: string; status: string }[] = [];

  let existing = new Set<string>();
  if (sheet.length > 0) {
    const rows = await query<RowDataPacket[]>(
      `SELECT emp_code FROM payslips WHERE month=? AND year=? AND emp_code IN (${sheet.map(() => '?').join(',')})`,
      [month, year, ...sheet.map((r: any) => r.emp_code)]
    );
    existing = new Set(rows.map(r => r.emp_code));
  }
  for (const r of sheet) {
    if (existing.has(r.emp_code)) { results.push({ emp_code: r.emp_code, status: 'already_exists' }); continue; }
    await insertPayslipRow(r, month, year, generatedBy, status);
    results.push({ emp_code: r.emp_code, status: 'generated' });
  }
  const generated = results.filter(r => r.status === 'generated').length;
  return { generated, skipped: results.length - generated, results };
}
