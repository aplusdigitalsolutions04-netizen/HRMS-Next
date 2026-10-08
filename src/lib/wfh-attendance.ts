import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { uuidv4 } from './utils';
import { attendanceByBehavior, attendanceCodesByBehavior } from './status-master';

const pad = (v: number) => String(v).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// When a Work From Home request is fully approved, every day in the range becomes a
// WFH attendance day (a paid day). They are saved as manual entries, so the
// TeamOffice sync will not turn them back into Absent (no punch on a WFH day).
// Weekly offs and holidays inside the range are left as they are.
export async function markWfhDays(employeeId: string, start: any, end: any, by: string): Promise<number> {
  const emps = await query<RowDataPacket[]>('SELECT emp_code, full_name FROM employees WHERE id = ?', [employeeId]);
  if (emps.length === 0 || !emps[0].emp_code) return 0;
  const { emp_code: empCode, full_name: name } = emps[0];

  const from = new Date(start);
  const to = new Date(end);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0;

  // The WFH status and the days it must not overwrite come from Settings > Status Master.
  const wfhCode = (await attendanceByBehavior('wfh'))?.code || 'WFH';
  const keepCodes = await attendanceCodesByBehavior('week_off', 'holiday');
  let marked = 0;
  for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d.setDate(d.getDate() + 1)) {
    const date = ymd(d);
    const day = d.toLocaleDateString('en-US', { weekday: 'long' });
    const existing = await query<RowDataPacket[]>('SELECT id, status FROM attendance WHERE emp_code = ? AND attendance_date = ?', [empCode, date]);
    if (existing.length > 0) {
      if (keepCodes.includes(existing[0].status)) continue;
      await execute(
        "UPDATE attendance SET status=?, remark='Manual entry: WFH approved', created_by=?, is_status=1 WHERE id=?",
        [wfhCode, by, existing[0].id]
      );
    } else {
      await execute(
        "INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, in_time, out_time, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,NULL,NULL,0,?,'Manual entry: WFH approved',?,1)",
        [uuidv4(), empCode, name, null, date, day, wfhCode, by]
      );
    }
    marked++;
  }
  return marked;
}
