// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || '';
    const year = searchParams.get('year') || '';

    if (!user.emp_code) return jsonSuccess({ data: [] });   // an account with no employee record (an administrator) has no payslips of its own
    let where = "WHERE p.emp_code=? AND p.status = 'APPROVED'"; const params = [user.emp_code];
    if (month && Number.isInteger(parseInt(month))) { where += ' AND p.month=?'; params.push(parseInt(month)); }
    if (year && Number.isInteger(parseInt(year))) { where += ' AND p.year=?'; params.push(parseInt(year)); }

    const rows = await query<RowDataPacket[]>(
      `SELECT p.* FROM payslips p ${where} ORDER BY p.year DESC, p.month DESC`, params
    );
    return jsonSuccess({ data: rows });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
