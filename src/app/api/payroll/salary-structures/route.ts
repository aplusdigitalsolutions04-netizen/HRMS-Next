// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4 } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_payroll')) return jsonError('Insufficient permissions', 403);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    let where = 'WHERE 1=1'; const params = [];
    if (search.trim()) { where += ' AND (e.full_name LIKE ? OR e.emp_code LIKE ?)'; const q = `%${search.trim()}%`; params.push(q, q); }
    const rows = await query<RowDataPacket[]>(
      `SELECT ss.*, e.full_name, e.designation, e.email_id FROM salary_structures ss JOIN employees e ON ss.emp_code=e.emp_code ${where} ORDER BY e.full_name`, params
    );
    return jsonSuccess(rows.map(r => ({ ...r, department: '' })));
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_salary_structures')) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.emp_code) return jsonError('Employee code required', 422);
    
    const existing = await query<RowDataPacket[]>('SELECT id FROM salary_structures WHERE emp_code=?', [body.emp_code]);
    if (existing.length > 0) return jsonError('Salary structure already exists for this employee', 409);
    
    await execute(
      `INSERT INTO salary_structures (id, emp_code, basic_pay, hra, conveyance_allowance, food_vouchers, medical_insurance, other_deductions, incentives, el_encashment, ctc, ctc_period, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [uuidv4(), body.emp_code, body.basic_pay||0, body.hra||0, body.conveyance_allowance||0, body.food_vouchers||0, body.medical_insurance||0, body.other_deductions||0, body.incentives||0, body.el_encashment||0, body.ctc || null, body.ctc_period || 'monthly']
    );

    await logAudit({
      action: 'create_salary_structure',
      entity_type: 'salary_structures',
      entity_id: body.emp_code,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: body
    });

    return jsonSuccess({ message: 'Salary structure created' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_salary_structures')) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.emp_code) return jsonError('Employee code required', 422);

    const existing = await query<RowDataPacket[]>('SELECT id FROM salary_structures WHERE emp_code=?', [body.emp_code]);
    if (existing.length === 0) return jsonError('Salary structure not found for this employee', 404);

    await execute(
      `UPDATE salary_structures SET basic_pay=?, hra=?, conveyance_allowance=?, food_vouchers=?, medical_insurance=?, other_deductions=?, incentives=?, el_encashment=?, ctc=?, ctc_period=?, updated_at=NOW() WHERE emp_code=?`,
      [body.basic_pay||0, body.hra||0, body.conveyance_allowance||0, body.food_vouchers||0, body.medical_insurance||0, body.other_deductions||0, body.incentives||0, body.el_encashment||0, body.ctc || null, body.ctc_period || 'monthly', body.emp_code]
    );

    await logAudit({
      action: 'update_salary_structure',
      entity_type: 'salary_structures',
      entity_id: body.emp_code,
      performed_by: String(user.id),
      performed_by_email: user.email,
      details: body
    });

    return jsonSuccess({ message: 'Salary structure updated' });
  } catch (e: any) { return jsonError(e, 500); }
}
