// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { snapshotOf, monthlyTotal } from '@/lib/salary-history';

// What the "Make a letter" form can start with for an employee: the monthly salary of the salary structure (empty when there is none).
// GET ?employee_id=
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const id = new URL(req.url).searchParams.get('employee_id') || '';
    const e = (await query<RowDataPacket[]>('SELECT emp_code FROM employees WHERE id = ? AND is_deleted = 0', [id]))[0];
    if (!e) return jsonError('Employee not found', 404);
    const ss = (await query<RowDataPacket[]>('SELECT * FROM salary_structures WHERE emp_code = ?', [e.emp_code]))[0];
    const monthly = ss ? Math.round(monthlyTotal(snapshotOf(ss))) : 0;
    return jsonSuccess({ monthly_salary: monthly > 0 ? monthly : null });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
