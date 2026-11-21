// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, hasAnyPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_payroll', 'manage_salary_structures', 'generate_payslips'])) return jsonError('Insufficient permissions', 403);
    const rows = await query<RowDataPacket[]>(
      `SELECT e.id, e.emp_code, e.full_name, e.designation, ss.id as salary_structure_id FROM employees e LEFT JOIN salary_structures ss ON e.emp_code=ss.emp_code WHERE e.is_deleted = 0 ORDER BY e.full_name`
    );
    return jsonSuccess(rows.map(r => ({ ...r, department: '' })));
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
