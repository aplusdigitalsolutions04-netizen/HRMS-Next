// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { employeeCodes, inList } from '@/lib/status-master';

// Everything the employee home page shows besides attendance, in one call: leave balance, last payslip, who is away today,
// birthdays and anniversaries this week, document expiry, company items, help desk tickets and how complete the profile is.
const DAY = 86400000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// profile items an employee can fill in; the label is what the home page asks for
const PROFILE: [string, string][] = [
  ['mobile_no', 'Mobile number'], ['dob', 'Date of birth'], ['present_address', 'Present address'], ['permanent_address', 'Permanent address'],
  ['bank_name', 'Bank name'], ['account_number', 'Bank account number'], ['pan', 'PAN'], ['profile_photo', 'Profile photo'],
  ['identity_proof', 'Identity proof'], ['address_proof', 'Address proof'],
];

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'employee') return jsonSuccess({ employee: false });
    const me = (await query<RowDataPacket[]>('SELECT * FROM employees WHERE id = ? AND is_deleted = 0', [String(user.id)]))[0];
    if (!me) return jsonSuccess({ employee: false });
    const now = new Date(); const today = ymd(now);
    const working = inList(await employeeCodes('is_working'));

    const balances = await query<RowDataPacket[]>('SELECT leave_type, total_days, used_days, (total_days - used_days) AS remaining FROM leave_balances WHERE employee_id = ? ORDER BY leave_type', [me.id]);

    const slip = (await query<RowDataPacket[]>("SELECT id, month, year, net_salary FROM payslips WHERE emp_code = ? AND status = 'APPROVED' ORDER BY year DESC, month DESC LIMIT 1", [me.emp_code]))[0] || null;

    const onLeave = await query<RowDataPacket[]>(
      `SELECT e.full_name, lr.leave_type, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS until FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
       WHERE lr.status = 'Approved' AND lr.start_date <= CURDATE() AND lr.end_date >= CURDATE() AND e.is_deleted = 0 AND e.status IN ${working.sql} ORDER BY e.full_name LIMIT 30`, working.params);
    const wfh = await query<RowDataPacket[]>(
      `SELECT e.full_name FROM wfh_requests w JOIN employees e ON e.id = w.employee_id
       WHERE LOWER(w.status) = 'approved' AND w.start_date <= CURDATE() AND w.end_date >= CURDATE() AND e.is_deleted = 0 AND e.status IN ${working.sql} ORDER BY e.full_name LIMIT 30`, working.params);
    const team = me.manager_id ? await query<RowDataPacket[]>(
      `SELECT full_name, designation FROM employees WHERE is_deleted = 0 AND status IN ${working.sql} AND id <> ? AND (manager_id = ? OR id = ?) ORDER BY (id = ?) DESC, full_name LIMIT 12`,
      [...working.params, me.id, me.manager_id, me.manager_id, me.manager_id]) : [];

    // birthdays and anniversaries in the next 7 days (the year of a birthday is never sent)
    const people = await query<RowDataPacket[]>(
      `SELECT full_name, dob, date_of_joining FROM employees WHERE is_deleted = 0 AND status IN ${working.sql} AND (dob IS NOT NULL OR date_of_joining IS NOT NULL)`, working.params);
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week: any[] = [];
    const next = (src: any, kind: string) => {
      if (!src) return; const s = new Date(src);
      let at = new Date(base.getFullYear(), s.getMonth(), s.getDate());
      if (at < base) at = new Date(base.getFullYear() + 1, s.getMonth(), s.getDate());
      const n = Math.round((at.getTime() - base.getTime()) / DAY);
      return n <= 7 ? { at, n, years: at.getFullYear() - s.getFullYear() } : null;
    };
    for (const p of people) {
      const b = next(p.dob, 'birthday'); if (b) week.push({ name: p.full_name, kind: 'birthday', date: ymd(b.at), in_days: b.n });
      const a = next(p.date_of_joining, 'anniversary'); if (a && a.years > 0) week.push({ name: p.full_name, kind: 'anniversary', date: ymd(a.at), in_days: a.n, years: a.years });
    }
    week.sort((x, y) => x.in_days - y.in_days || x.name.localeCompare(y.name));

    const expiry = (await query<RowDataPacket[]>("SELECT document_type, DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date, DATEDIFF(expiry_date, CURDATE()) AS days_left FROM document_expiry WHERE employee_id = ? AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) ORDER BY expiry_date", [me.id]))
      .map(r => ({ ...r, days_left: Number(r.days_left) }));

    const assets = await query<RowDataPacket[]>(
      `SELECT a.asset_type, a.name, a.asset_tag, DATE_FORMAT(s.assigned_on, '%Y-%m-%d') AS assigned_on FROM asset_assignments s JOIN assets a ON a.id = s.asset_id WHERE s.employee_id = ? AND s.returned_on IS NULL ORDER BY s.assigned_on DESC`, [me.id]);

    const tickets = await query<RowDataPacket[]>(
      `SELECT t.id, t.ticket_no, t.subject, t.status, (SELECT m.author_type FROM help_ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_from
       FROM help_tickets t WHERE t.employee_id = ? AND t.status NOT IN ('Resolved','Closed') ORDER BY t.updated_at DESC LIMIT 4`, [String(me.id)]);

    const missing = PROFILE.filter(([k]) => { const v = me[k]; return v === null || v === undefined || String(v).trim() === ''; }).map(([, l]) => l);

    return jsonSuccess({
      employee: true,
      balances: balances.map(b => ({ leave_type: b.leave_type, total: Number(b.total_days), used: Number(b.used_days), remaining: Number(b.remaining) })),
      payslip: slip && { id: slip.id, month: Number(slip.month), year: Number(slip.year), net_salary: Number(slip.net_salary) },
      on_leave: onLeave, wfh_today: wfh.map(r => r.full_name), team, celebrations: week.slice(0, 8),
      expiring: expiry, assets, tickets,
      profile: { percent: Math.round(((PROFILE.length - missing.length) / PROFILE.length) * 100), missing },
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
