import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireRole } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    // Matches the ADMIN_HR-only access level '/attendance/update' is routed at.
    if (!requireRole(user, [])) {
      return NextResponse.json({ detail: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const empCode = searchParams.get('emp_code');
    if (!empCode) return NextResponse.json({ detail: 'emp_code is required' }, { status: 422 });

    const month = parseInt(searchParams.get('month') || '') || (new Date().getMonth() + 1);
    const year = parseInt(searchParams.get('year') || '') || new Date().getFullYear();

    const emp = await query<RowDataPacket[]>('SELECT full_name FROM employees WHERE emp_code = ?', [empCode]);
    if (emp.length === 0) return NextResponse.json({ detail: 'Employee not found' }, { status: 404 });

    const days = await query<RowDataPacket[]>(
      `SELECT id, emp_code, department, attendance_date, day, in_time, out_time, working_hours, status
       FROM attendance
       WHERE emp_code = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?
       ORDER BY attendance_date ASC`,
      [empCode, month, year]
    );

    const department = days.find((d) => d.department)?.department || '';

    return NextResponse.json({
      emp_code: empCode,
      full_name: emp[0].full_name,
      department,
      days,
    });
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Server error' }, { status: 500 });
  }
}
