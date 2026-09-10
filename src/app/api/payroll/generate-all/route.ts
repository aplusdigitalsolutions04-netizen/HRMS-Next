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

    const employees = await query<RowDataPacket[]>(
      `SELECT e.emp_code, e.full_name, e.email_id, ss.* FROM employees e JOIN salary_structures ss ON e.emp_code=ss.emp_code WHERE e.status='active'`
    );
    
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const results = [];

    // One batched existence check for the whole roster instead of a
    // per-employee SELECT inside the loop.
    let existingEmpCodes = new Set<string>();
    if (employees.length > 0) {
      const placeholders = employees.map(() => '?').join(',');
      const existingRows = await query<RowDataPacket[]>(
        `SELECT emp_code FROM payslips WHERE month=? AND year=? AND emp_code IN (${placeholders})`,
        [month, year, ...employees.map(e => e.emp_code)]
      );
      existingEmpCodes = new Set(existingRows.map(r => r.emp_code));
    }

    for (const emp of employees) {
      if (existingEmpCodes.has(emp.emp_code)) { results.push({ emp_code: emp.emp_code, status: 'already_exists' }); continue; }

      const gross = (emp.basic_pay||0) + (emp.hra||0) + (emp.conveyance_allowance||0) + (emp.food_vouchers||0) + (emp.medical_insurance||0) + (emp.incentives||0) + (emp.el_encashment||0);
      const deductions = (emp.other_deductions||0);
      const net = gross - deductions;
      
      const id = uuidv4();
      await execute(
        `INSERT INTO payslips (id, emp_code, month, year, basic_pay, hra, conveyance_allowance, food_vouchers, medical_insurance, other_deductions, incentives, el_encashment, gross_salary, total_deductions, total_adjustments, net_salary, paid_days, leave_availed, casual_leave, earned_leave, generated_by, generated_at, email_sent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,30,0,0,0,?,NOW(),NULL)`,
        [id, emp.emp_code, month, year, emp.basic_pay||0, emp.hra||0, emp.conveyance_allowance||0, emp.food_vouchers||0, emp.medical_insurance||0, emp.other_deductions||0, emp.incentives||0, emp.el_encashment||0, gross, deductions, net, user.email]
      );
      results.push({ emp_code: emp.emp_code, status: 'generated' });
    }
    return jsonSuccess({ message: `Generated ${results.filter(r=>r.status==='generated').length} payslips`, results });
  } catch (e: any) { return jsonError(e, 500); }
}
