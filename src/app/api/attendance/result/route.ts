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
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');

    let summary: RowDataPacket[];
    let selectedMonth: number | null = null;
    let selectedYear: number | null = null;

    // Start from employees (not attendance_summary) so employees with no
    // summary rows yet for the selected period still show up (with zeroed
    // stats), instead of silently disappearing from the list. Only employees
    // who have actually left the company ('dropped') are excluded.
    const baseSelect = `e.emp_code as employee_code, MAX(e.full_name) as employee_name, MAX(asm.department) as department, MIN(asm.attendance_from_date) as attendance_from_date, MAX(asm.attendance_to_date) as attendance_to_date, COALESCE(SUM(asm.total_present_days),0) as total_present_days, COALESCE(SUM(asm.total_absent_days),0) as total_absent_days, COALESCE(SUM(asm.total_working_hours),0) as total_working_hours, MAX(asm.performance) as performance, MAX(asm.is_verified) as is_verified, GROUP_CONCAT(DISTINCT asm.id) as summary_ids`;
    let joinCondition = 'asm.employee_code = e.emp_code';
    let params: any[] = [];

    if (monthParam && yearParam) {
      selectedMonth = parseInt(monthParam);
      selectedYear = parseInt(yearParam);
      joinCondition += ' AND MONTH(asm.attendance_from_date)=? AND YEAR(asm.attendance_from_date)=?';
      params = [selectedMonth, selectedYear];
    } else if (monthParam) {
      selectedMonth = parseInt(monthParam);
      joinCondition += ' AND MONTH(asm.attendance_from_date)=?';
      params = [selectedMonth];
    } else if (yearParam) {
      selectedYear = parseInt(yearParam);
      joinCondition += ' AND YEAR(asm.attendance_from_date)=?';
      params = [selectedYear];
    }

    summary = await query<RowDataPacket[]>(
      `SELECT ${baseSelect}
       FROM employees e
       LEFT JOIN attendance_summary asm ON ${joinCondition}
       WHERE e.status != 'dropped' AND e.is_deleted = 0
       GROUP BY e.emp_code
       ORDER BY employee_name`,
      params
    );
    
    const availableMonths = await query<RowDataPacket[]>('SELECT DISTINCT MONTH(attendance_from_date) as month FROM attendance_summary ORDER BY month');
    const availableYears = await query<RowDataPacket[]>('SELECT DISTINCT YEAR(attendance_from_date) as year FROM attendance_summary ORDER BY year DESC');
    
    return jsonSuccess({
      summary,
      availableMonths: availableMonths.map(r => r.month),
      availableYears: availableYears.map(r => r.year),
      selectedMonth,
      selectedYear
    });
  } catch (e: any) { return jsonError(e, 500); }
}
