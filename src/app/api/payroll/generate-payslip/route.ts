// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensurePayslipColumns } from '@/lib/payroll-calc';
import { computeSalarySheet } from '@/lib/salary-sheet';
import { insertPayslipRow } from '@/lib/payslip-draft';
import { auditFrom } from '@/lib/audit';

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
    const id = await insertPayslipRow(r, month, year, user.email, 'DRAFT');
    await auditFrom(user, 'payslip_generated', 'payslip', id, { emp_code: r.emp_code, month, year, status: 'DRAFT' });
    return jsonSuccess({ id, message: 'Draft payslip created. Approve it in Payslip History to publish and email it.' });
  } catch (e: any) { return jsonError(e, 500); }
}
