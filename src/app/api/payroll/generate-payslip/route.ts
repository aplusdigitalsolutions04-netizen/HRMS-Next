// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.emp_code) return jsonError('Employee code required', 422);
    
    const emp = await query<RowDataPacket[]>('SELECT e.*, ss.* FROM employees e JOIN salary_structures ss ON e.emp_code=ss.emp_code WHERE e.emp_code=?', [body.emp_code]);
    if (emp.length === 0) return jsonError('Employee or salary structure not found', 404);
    
    const month = body.month || new Date().getMonth() + 1;
    const year = body.year || new Date().getFullYear();
    const existing = await query<RowDataPacket[]>('SELECT id FROM payslips WHERE emp_code=? AND month=? AND year=?', [body.emp_code, month, year]);
    if (existing.length > 0) return jsonError('Payslip already exists for this period', 409);
    
    const e = emp[0];
    const gross = (e.basic_pay||0) + (e.hra||0) + (e.conveyance_allowance||0) + (e.food_vouchers||0) + (e.medical_insurance||0) + (e.incentives||0) + (e.el_encashment||0);
    const deductions = (e.other_deductions||0);
    const net = gross - deductions;
    
    const id = uuidv4();
    await execute(
      `INSERT INTO payslips (id, emp_code, month, year, basic_pay, hra, conveyance_allowance, food_vouchers, medical_insurance, other_deductions, incentives, el_encashment, gross_salary, total_deductions, total_adjustments, net_salary, paid_days, generated_by, generated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,30,?,NOW())`,
      [id, e.emp_code, month, year, e.basic_pay||0, e.hra||0, e.conveyance_allowance||0, e.food_vouchers||0, e.medical_insurance||0, e.other_deductions||0, e.incentives||0, e.el_encashment||0, gross, deductions, net, user.email]
    );
    return jsonSuccess({ id, message: 'Payslip generated' });
  } catch (e: any) { return jsonError(e, 500); }
}
