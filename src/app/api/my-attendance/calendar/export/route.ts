// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || String(new Date().getMonth() + 1);
    const year = searchParams.get('year') || String(new Date().getFullYear());
    const emp = await query<RowDataPacket[]>('SELECT emp_code FROM employees WHERE email_id = ?', [user.email || user.id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    
    const rows = await query<RowDataPacket[]>(
      `SELECT attendance_date as date, DAYNAME(attendance_date) as day, status, in_time, out_time, CASE WHEN in_time IS NOT NULL AND in_time!='--:--' AND out_time IS NOT NULL AND out_time!='--:--' THEN ROUND(TIME_TO_SEC(TIMEDIFF(out_time,in_time))/3600,1) ELSE 0 END as working_hours FROM attendance WHERE emp_code=? AND MONTH(attendance_date)=? AND YEAR(attendance_date)=? ORDER BY attendance_date`,
      [emp[0].emp_code, parseInt(month), parseInt(year)]
    );
    
    // Generate a simple CSV as blob
    let csv = 'Date,Day,Status,In Time,Out Time,Working Hours\n';
    for (const r of rows) { csv += `${r.date},${r.day},${r.status},${r.in_time||''},${r.out_time||''},${r.working_hours||''}\n`; }
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Attendance_Report_${month}_${year}.csv"`
      }
    });
  } catch (e: any) { return jsonError(e, 500); }
}
