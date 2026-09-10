import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

    // Matches the ADMIN_HR_STAFF access level the frontend routes this page at.
    if (!checkPermission(user, 'view_attendance')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || new Date().getMonth() + 1;
    const year = searchParams.get('year') || new Date().getFullYear();

    // Start from employees (not attendance) so employees with no punches yet
    // this month still show up. Exclude only employees who have actually left
    // the company ('dropped') - 'pending' employees (portal login not yet
    // approved) can still have real punch data and should still show.
    // Unioned with attendance rows whose emp_code has no employees record at
    // all (e.g. synced from TeamOffice for someone not yet registered in HR)
    // - those wouldn't otherwise appear since the first half is driven by
    // the employees table.
    const sql = `
      SELECT
        e.emp_code, e.full_name AS name, e.designation AS department,
        a.id, a.attendance_date, a.day, a.in_time, a.out_time, a.working_hours, a.status, a.remark
      FROM employees e
      LEFT JOIN attendance a
        ON a.emp_code = e.emp_code
        AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?
        AND a.attendance_date <= CURDATE()
      WHERE e.status != 'dropped'

      UNION ALL

      SELECT
        a.emp_code, a.name, a.department,
        a.id, a.attendance_date, a.day, a.in_time, a.out_time, a.working_hours, a.status, a.remark
      FROM attendance a
      LEFT JOIN employees e ON e.emp_code = a.emp_code
      WHERE e.emp_code IS NULL
        AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?
        AND a.attendance_date <= CURDATE()

      ORDER BY name ASC, attendance_date DESC
    `;

    const records = await query<RowDataPacket[]>(sql, [month, year, month, year]);

    return NextResponse.json({ success: true, data: records });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
