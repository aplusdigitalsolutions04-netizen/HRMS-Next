import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, checkPermission, calcHours } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// P present, A absent, HD half day, WO weekly off, WFH work from home,
// EW extra work (came in on a weekly off / holiday).
const STATUSES = ['P', 'A', 'HD', 'WO', 'WFH', 'EW', 'HOL'];
const MANUAL_REMARK = 'Manual entry';

// HR adds or corrects one day of attendance (e.g. Work From Home, or Extra
// Work on a holiday). TeamOffice syncs skip rows marked as manual entries.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const empCode = String(body.emp_code || '').trim();
    const date = String(body.date || '').slice(0, 10);
    const status = String(body.status || '').toUpperCase();
    if (!empCode || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError('emp_code and date (YYYY-MM-DD) are required', 422);
    if (!STATUSES.includes(status)) return jsonError(`Status must be one of ${STATUSES.join(', ')}`, 422);

    const emps = await query<RowDataPacket[]>('SELECT full_name FROM employees WHERE emp_code = ?', [empCode]);
    if (emps.length === 0) return jsonError('Employee not found', 404);

    const clean = (t: any) => { const s = String(t || '').trim(); return /^\d{1,2}:\d{2}/.test(s) ? s : null; };
    const inTime = clean(body.in_time);
    const outTime = clean(body.out_time);
    const hours = parseFloat(calcHours(inTime || undefined, outTime || undefined)) || 0;
    const day = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const remark = body.remark ? `${MANUAL_REMARK}: ${String(body.remark).slice(0, 150)}` : MANUAL_REMARK;

    const existing = await query<RowDataPacket[]>('SELECT id FROM attendance WHERE emp_code = ? AND attendance_date = ?', [empCode, date]);
    if (existing.length > 0) {
      await execute(
        'UPDATE attendance SET in_time=?, out_time=?, working_hours=?, status=?, remark=?, created_by=?, is_status=1 WHERE id=?',
        [inTime, outTime, hours, status, remark, user.email, existing[0].id]
      );
    } else {
      await execute(
        'INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, in_time, out_time, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)',
        [uuidv4(), empCode, emps[0].full_name, null, date, day, inTime, outTime, hours, status, remark, user.email]
      );
    }
    return jsonSuccess({ message: 'Attendance saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
