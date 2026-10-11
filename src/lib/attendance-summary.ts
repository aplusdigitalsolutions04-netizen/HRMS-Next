// @ts-nocheck
import { query, execute } from './db';
import { uuidv4 } from './utils';
import { RowDataPacket } from 'mysql2';
import { attendanceWeightSql, attendanceCountSql } from './status-master';

const pad = (n: number) => String(n).padStart(2, '0');

// Re-adds up one employee's month in attendance_summary (the table behind the Attendance Summary page)
// after a single day was corrected by hand, so the summary matches the day records straight away.
export async function recalcAttendanceSummary(empCode: string, month: number, year: number) {
  const presentWeightSql = await attendanceWeightSql('status', 'present');
  const absentCountSql = await attendanceCountSql('status', 'absent');
  const emps = await query<RowDataPacket[]>('SELECT full_name FROM employees WHERE emp_code = ?', [empCode]);
  const metrics = await query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(${presentWeightSql}), 0) as present, COALESCE(SUM(${absentCountSql}), 0) as absent, COALESCE(SUM(working_hours), 0) as total_hours
     FROM attendance WHERE emp_code = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`,
    [empCode, month, year]
  );
  const last = new Date(year, month, 0).getDate();
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(last)}`;
  const existing = await query<RowDataPacket[]>(
    'SELECT id FROM attendance_summary WHERE employee_code = ? AND MONTH(attendance_from_date) = ? AND YEAR(attendance_from_date) = ?',
    [empCode, month, year]
  );
  if (existing.length > 0) {
    await execute(
      'UPDATE attendance_summary SET total_present_days=?, total_absent_days=?, total_working_hours=? WHERE id=?',
      [metrics[0].present, metrics[0].absent, metrics[0].total_hours, existing[0].id]
    );
  } else {
    await execute(
      'INSERT INTO attendance_summary (id, employee_code, employee_name, department, attendance_from_date, attendance_to_date, total_present_days, total_absent_days, total_working_hours, performance, is_verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [uuidv4(), empCode, emps[0]?.full_name || '', '', from, to, metrics[0].present, metrics[0].absent, metrics[0].total_hours, 'Good', 0]
    );
  }
}
