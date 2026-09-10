// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_attendance')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    let month = searchParams.get('month') || String(new Date().getMonth() + 1);
    let year = searchParams.get('year') || String(new Date().getFullYear());
    
    const emp = await query<RowDataPacket[]>('SELECT emp_code, full_name FROM employees WHERE id=? OR emp_code=?', [id, id]);
    if (emp.length === 0) return jsonError('Employee not found', 404);
    
    let rows = await query<RowDataPacket[]>(
      `SELECT attendance_date as date, DAYNAME(attendance_date) as day, status, in_time, out_time, CASE WHEN in_time IS NOT NULL AND in_time!='--:--' AND out_time IS NOT NULL AND out_time!='--:--' THEN ROUND(TIME_TO_SEC(TIMEDIFF(out_time,in_time))/3600,1) ELSE 0 END as working_hours FROM attendance WHERE emp_code=? AND MONTH(attendance_date)=? AND YEAR(attendance_date)=? ORDER BY attendance_date`,
      [emp[0].emp_code, parseInt(month), parseInt(year)]
    );
    
    // If no data for requested month, fall back to most recent month with data
    if (rows.length === 0) {
      const lastRow = await query<RowDataPacket[]>('SELECT MAX(attendance_date) as last_date FROM attendance WHERE emp_code=?', [emp[0].emp_code]);
      if (lastRow.length > 0 && lastRow[0].last_date) {
        const d = new Date(lastRow[0].last_date);
        month = String(d.getMonth() + 1);
        year = String(d.getFullYear());
        rows = await query<RowDataPacket[]>(
          `SELECT attendance_date as date, DAYNAME(attendance_date) as day, status, in_time, out_time, CASE WHEN in_time IS NOT NULL AND in_time!='--:--' AND out_time IS NOT NULL AND out_time!='--:--' THEN ROUND(TIME_TO_SEC(TIMEDIFF(out_time,in_time))/3600,1) ELSE 0 END as working_hours FROM attendance WHERE emp_code=? AND MONTH(attendance_date)=? AND YEAR(attendance_date)=? ORDER BY attendance_date`,
          [emp[0].emp_code, parseInt(month), parseInt(year)]
        );
      }
    }
    
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let csv = `Employee,${emp[0].full_name||emp[0].emp_code}\nMonth,${monthNames[parseInt(month)-1]} ${year}\n\nDate,Day,Status,In Time,Out Time,Working Hours\n`;
    for (const r of rows) { csv += `${r.date},${r.day},${r.status},${r.in_time||''},${r.out_time||''},${r.working_hours||''}\n`; }
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="Attendance_Report_${month}_${year}.csv"`
      }
    });
  } catch (e: any) { return jsonError(e, 500); }
}
