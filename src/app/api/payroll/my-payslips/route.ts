// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || '';
    const year = searchParams.get('year') || '';

    let where = 'WHERE p.emp_code=?'; const params = [user.emp_code];
    if (month) { where += ' AND p.month=?'; params.push(parseInt(month)); }
    if (year) { where += ' AND p.year=?'; params.push(parseInt(year)); }

    const rows = await query<RowDataPacket[]>(
      `SELECT p.* FROM payslips p ${where} ORDER BY p.year DESC, p.month DESC`, params
    );
    return jsonSuccess({ data: rows });
  } catch (e: any) { return jsonError(e, 500); }
}
