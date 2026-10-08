import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { ensureHolidaySchema } from '@/lib/holidays';
import { employeeCodes, inList, getStatuses } from '@/lib/status-master';
import { RowDataPacket } from 'mysql2';

// Read-only data for the HR dashboard widgets. It changes nothing: every number
// comes from existing tables. Each section checks the caller's own permission and
// fails on its own (a section that errors or is not allowed comes back as null and
// the dashboard simply hides that widget).
async function section<T>(allowed: boolean, fn: () => Promise<T>): Promise<T | null> {
  if (!allowed) return null;
  try {
    return await fn();
  } catch (e: any) {
    console.error('[dashboard/overview] section failed:', e?.message || e);
    return null;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Days from `today` until the next time a month/day (from a YYYY-MM-DD date) comes round.
function daysUntilNext(dateStr: string, today: Date): { days: number; next: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return null;
  const mo = parseInt(m[2]) - 1, da = parseInt(m[3]);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(t0.getFullYear(), mo, da);
  if (next < t0) next = new Date(t0.getFullYear() + 1, mo, da);
  return { days: Math.round((next.getTime() - t0.getTime()) / 86400000), next: ymd(next) };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return jsonError('Insufficient permissions', 403);

    const today = new Date();
    const todayStr = ymd(today);
    const can = (p: string) => checkPermission(user, p);
    // Which employees count as the working workforce, and what each attendance status means,
    // comes from Settings > Status Master - nothing about statuses is fixed in this file.
    const W = inList(await employeeCodes('is_working'));
    const attStatuses = await getStatuses('attendance', true);

    const [attendanceToday, leave, wfh, pending, celebrations, holidays, departments, joiners, hiring] = await Promise.all([
      // ---- Today's attendance --------------------------------------------------
      section(can('view_attendance'), async () => {
        const active = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM employees WHERE status IN ${W.sql} AND is_deleted = 0`, W.params);
        const rows = await query<RowDataPacket[]>(
          `SELECT a.status, COUNT(*) AS n FROM attendance a
           JOIN employees e ON e.emp_code = a.emp_code AND e.status IN ${W.sql} AND e.is_deleted = 0
           WHERE a.attendance_date = CURDATE() GROUP BY a.status`,
          W.params
        );
        const by: Record<string, number> = {};
        for (const r of rows) by[r.status] = Number(r.n);
        // Group today's statuses by what they mean (their behaviour in the master).
        const sum = (...behaviors: string[]) => attStatuses.filter(a => behaviors.includes(a.behavior)).reduce((t, a) => t + (by[a.code] || 0), 0);
        return {
          date: todayStr,
          totalActive: Number(active[0]?.n) || 0,
          present: sum('present', 'half_day', 'extra_work'),
          wfh: sum('wfh'),
          absent: sum('absent'),
          offOrHoliday: sum('week_off', 'holiday'),
          recorded: Object.values(by).reduce((a, b) => a + b, 0),
        };
      }),

      // ---- Who is on leave today / coming up ------------------------------------
      section(can('view_leave'), async () => {
        const p = await query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'Pending'");
        const onLeave = await query<RowDataPacket[]>(
          `SELECT e.full_name, e.emp_code, lr.leave_type,
                  DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date
           FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
           WHERE lr.status = 'Approved' AND CURDATE() BETWEEN lr.start_date AND lr.end_date
           ORDER BY lr.end_date LIMIT 8`
        );
        const upcoming = await query<RowDataPacket[]>(
          `SELECT e.full_name, lr.leave_type,
                  DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date
           FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
           WHERE lr.status = 'Approved' AND lr.start_date > CURDATE() AND lr.start_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
           ORDER BY lr.start_date LIMIT 5`
        );
        return { pending: Number(p[0]?.n) || 0, onLeaveToday: onLeave, upcoming };
      }),

      // ---- Work from home --------------------------------------------------------
      section(can('view_wfh') || can('approve_wfh') || can('view_attendance'), async () => {
        const p = await query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM wfh_requests WHERE status = 'Pending'");
        const t = await query<RowDataPacket[]>(
          `SELECT e.full_name, e.emp_code FROM wfh_requests w JOIN employees e ON e.id = w.employee_id
           WHERE w.status = 'Approved' AND CURDATE() BETWEEN w.start_date AND w.end_date ORDER BY e.full_name LIMIT 8`
        );
        return { pending: Number(p[0]?.n) || 0, today: t };
      }),

      // ---- Things waiting for HR -------------------------------------------------
      section(true, async () => {
        const out: Record<string, number | null> = { employees: null, documents: null };
        if (can('approve_employee') || can('view_employees')) {
          const r = await query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM employees WHERE status = 'pending' AND is_deleted = 0");
          out.employees = Number(r[0]?.n) || 0;
        }
        if (can('approve_documents')) {
          const r = await query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM document_approvals WHERE action = 'pending'");
          out.documents = Number(r[0]?.n) || 0;
        }
        return out;
      }),

      // ---- Birthdays and work anniversaries (next 30 days) ----------------------
      section(can('view_employees'), async () => {
        const rows = await query<RowDataPacket[]>(
          `SELECT full_name, emp_code, designation,
                  DATE_FORMAT(dob, '%Y-%m-%d') AS dob, DATE_FORMAT(date_of_joining, '%Y-%m-%d') AS doj
           FROM employees WHERE status IN ${W.sql} AND is_deleted = 0`,
          W.params
        );
        const birthdays: any[] = [], anniversaries: any[] = [];
        for (const r of rows) {
          const b = r.dob ? daysUntilNext(r.dob, today) : null;
          if (b && b.days <= 30) birthdays.push({ full_name: r.full_name, designation: r.designation, date: b.next, days: b.days });
          const a = r.doj ? daysUntilNext(r.doj, today) : null;
          if (a && a.days <= 30) {
            const years = parseInt(a.next.slice(0, 4)) - parseInt(String(r.doj).slice(0, 4));
            if (years >= 1) anniversaries.push({ full_name: r.full_name, designation: r.designation, date: a.next, days: a.days, years });
          }
        }
        const byDays = (x: any, y: any) => x.days - y.days || String(x.full_name).localeCompare(String(y.full_name));
        return { birthdays: birthdays.sort(byDays).slice(0, 6), anniversaries: anniversaries.sort(byDays).slice(0, 6) };
      }),

      // ---- Upcoming holidays (everyone may see these) ---------------------------
      section(true, async () => {
        await ensureHolidaySchema();
        return query<RowDataPacket[]>(
          `SELECT name, holiday_type, DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holiday_date
           FROM holidays WHERE holiday_date >= CURDATE() ORDER BY holiday_date LIMIT 5`
        );
      }),

      // ---- Headcount by department -----------------------------------------------
      section(can('view_employees'), async () => {
        return query<RowDataPacket[]>(
          `SELECT COALESCE(dp.name, 'Unassigned') AS department, COUNT(*) AS count
           FROM employees e
           LEFT JOIN designations d ON d.name = e.designation AND d.is_deleted = 0
           LEFT JOIN departments dp ON dp.id = d.department_id
           WHERE e.status IN ${W.sql} AND e.is_deleted = 0
           GROUP BY COALESCE(dp.name, 'Unassigned') ORDER BY count DESC LIMIT 8`,
          W.params
        );
      }),

      // ---- Newest people ----------------------------------------------------------
      section(can('view_employees'), async () => {
        return query<RowDataPacket[]>(
          `SELECT full_name, emp_code, designation, DATE_FORMAT(COALESCE(date_of_joining, created_on), '%Y-%m-%d') AS joined
           FROM employees WHERE status IN ${W.sql} AND is_deleted = 0
           ORDER BY COALESCE(date_of_joining, created_on) DESC LIMIT 5`,
          W.params
        );
      }),

      // ---- New hires per month (last 6 months) -------------------------------------
      section(can('view_employees'), async () => {
        const rows = await query<RowDataPacket[]>(
          `SELECT DATE_FORMAT(COALESCE(date_of_joining, created_on), '%Y-%m') AS ym, COUNT(*) AS count
           FROM employees WHERE is_deleted = 0 AND status IN ${W.sql}
             AND COALESCE(date_of_joining, created_on) >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
           GROUP BY ym`,
          W.params
        );
        const map = new Map(rows.map(r => [String(r.ym), Number(r.count)]));
        const out: { ym: string; label: string; count: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
          out.push({ ym, label: d.toLocaleDateString('en-US', { month: 'short' }), count: map.get(ym) || 0 });
        }
        return out;
      }),
    ]);

    return jsonSuccess({
      today: todayStr,
      attendanceToday, leave, wfh, pending, celebrations, holidays, departments, joiners, hiring,
    });
  } catch (e: any) {
    console.error('[dashboard/overview] failed:', e?.message || e);
    return jsonError(e, 500);
  }
}
