// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensurePayslipColumns } from '@/lib/payroll-calc';
import { computeSalarySheet } from '@/lib/salary-sheet';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);

    const body = await req.json().catch(() => ({}));
    const month = Number(body.month) || new Date().getMonth() + 1;
    const year = Number(body.year) || new Date().getFullYear();

    // The same rows the Salary Sheet shows: every active employee with a salary structure.
    const sheet = await computeSalarySheet(month, year);
    await ensurePayslipColumns();
    const results = [];

    // One batched existence check for the whole roster instead of a per-employee SELECT.
    let existingEmpCodes = new Set<string>();
    if (sheet.length > 0) {
      const placeholders = sheet.map(() => '?').join(',');
      const existingRows = await query<RowDataPacket[]>(
        `SELECT emp_code FROM payslips WHERE month=? AND year=? AND emp_code IN (${placeholders})`,
        [month, year, ...sheet.map(r => r.emp_code)]
      );
      existingEmpCodes = new Set(existingRows.map(r => r.emp_code));
    }

    for (const r of sheet) {
      if (existingEmpCodes.has(r.emp_code)) { results.push({ emp_code: r.emp_code, status: 'already_exists' }); continue; }
      await execute(
        `INSERT INTO payslips (id, emp_code, month, year, basic_pay, hra, conveyance_allowance, food_vouchers, medical_insurance, other_deductions, incentives, el_encashment, gross_salary, total_deductions, total_adjustments, net_salary, paid_days, extra_work_days, extra_work_pay, variable_pay, extra_components, leave_availed, casual_leave, earned_leave, generated_by, generated_at, email_sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,?,NOW(),NULL)`,
        [uuidv4(), r.emp_code, month, year, r.basic_pay, r.hra, r.conveyance_allowance, r.food_vouchers, r.insurance, r.other_deductions, r.incentive, r.el_pay, r.net_payable, r.total_deductions, r.total_adjustments, r.final_salary, r.paid_days, r.extra_work_days, r.extra_work_pay, r.variable_pay, r.extra_components.length ? JSON.stringify(r.extra_components.map(x => ({ label: x.label, amount: x.amount, type: x.type }))) : null, user.email]
      );
      results.push({ emp_code: r.emp_code, status: 'generated' });
    }
    const generated = results.filter(r => r.status === 'generated').length;
    const skipped = results.length - generated;
    return jsonSuccess({
      message: `Generated ${generated} payslip(s) for ${month}/${year}` + (skipped ? `, skipped ${skipped} that already existed` : '') + '. Open Payslip History to review and email them.',
      count: generated, skipped, results,
    });
  } catch (e: any) { return jsonError(e, 500); }
}
