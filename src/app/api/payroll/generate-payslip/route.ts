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
    const body = await req.json();
    if (!body.emp_code) return jsonError('Employee code required', 422);

    const month = Number(body.month) || new Date().getMonth() + 1;
    const year = Number(body.year) || new Date().getFullYear();
    const existing = await query<RowDataPacket[]>('SELECT id FROM payslips WHERE emp_code=? AND month=? AND year=?', [body.emp_code, month, year]);
    if (existing.length > 0) return jsonError('Payslip already exists for this period', 409);

    // Same numbers as the Salary Sheet: attendance-based paid days, prorated
    // earnings, insurance/other deductions, incentive, EL pay and extra work pay.
    const [r] = await computeSalarySheet(month, year, body.emp_code);
    if (!r) return jsonError('Employee not found, not active, or has no salary structure', 404);

    await ensurePayslipColumns();
    const id = uuidv4();
    await execute(
      `INSERT INTO payslips (id, emp_code, month, year, basic_pay, hra, conveyance_allowance, food_vouchers, medical_insurance, other_deductions, incentives, el_encashment, gross_salary, total_deductions, total_adjustments, net_salary, paid_days, extra_work_days, extra_work_pay, variable_pay, extra_components, generated_by, generated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [id, r.emp_code, month, year, r.basic_pay, r.hra, r.conveyance_allowance, r.food_vouchers, r.insurance, r.other_deductions, r.incentive, r.el_pay, r.net_payable, r.total_deductions, r.total_adjustments, r.final_salary, r.paid_days, r.extra_work_days, r.extra_work_pay, r.variable_pay, r.extra_components.length ? JSON.stringify(r.extra_components.map(x => ({ label: x.label, amount: x.amount, type: x.type }))) : null, user.email]
    );
    return jsonSuccess({ id, message: 'Payslip generated' });
  } catch (e: any) { return jsonError(e, 500); }
}
