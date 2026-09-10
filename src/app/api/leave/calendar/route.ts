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
    const month = searchParams.get('month') || String(new Date().getMonth() + 1);
    const year = searchParams.get('year') || String(new Date().getFullYear());
    const rows = await query<RowDataPacket[]>(
      `SELECT lr.*, e.full_name as emp_full_name, e.profile_photo FROM leave_requests lr LEFT JOIN employees e ON lr.employee_id=e.id WHERE MONTH(lr.start_date)=? AND YEAR(lr.start_date)=? AND lr.status IN ('Approved','Pending') ORDER BY lr.start_date`,
      [parseInt(month), parseInt(year)]
    );
    return jsonSuccess(rows);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
