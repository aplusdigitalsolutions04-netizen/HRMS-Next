// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, checkPermission } from '@/lib/utils';
import { query, execute, withNamedLock } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensurePayslipColumns } from '@/lib/payroll-calc';
import { computeSalarySheet } from '@/lib/salary-sheet';
import { insertPayslipRow } from '@/lib/payslip-draft';
import { auditFrom } from '@/lib/audit';

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.emp_code) return jsonError('Employee code required', 422);

    const month = Number(body.month) || new Date().getMonth() + 1;
    const year = Number(body.year) || new Date().getFullYear();
    // the check and the insert happen under one lock per month (the same lock the whole-month run takes), so two requests cannot both pass the check
    const done = await withNamedLock(`payslips:${year}-${month}`, 30, async () => {
      const existing = await query<RowDataPacket[]>('SELECT id FROM payslips WHERE emp_code=? AND month=? AND year=?', [body.emp_code, month, year]);
      if (existing.length > 0) return { error: jsonError('Payslip already exists for this period', 409) };

      // Same numbers as the Salary Sheet: attendance-based paid days, prorated
      // earnings, insurance/other deductions, incentive, EL pay and extra work pay.
      const [r] = await computeSalarySheet(month, year, body.emp_code);
      if (!r) return { error: jsonError('Employee not found, not active, or has no salary structure', 404) };

      await ensurePayslipColumns();
      const id = await insertPayslipRow(r, month, year, user.email, 'DRAFT');
      await auditFrom(user, 'payslip_generated', 'payslip', id, { emp_code: r.emp_code, month, year, status: 'DRAFT' });
      return { id };
    });
    if (!done.locked) return jsonError('Another payslip run for this month is in progress. Try again in a moment.', 409);
    if (done.value.error) return done.value.error;
    return jsonSuccess({ id: done.value.id, message: 'Draft payslip created. Approve it in Payslip History to publish and email it.' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
