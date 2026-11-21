import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { uuidv4 } from './utils';
import { getWeeklyOffDays } from './teamoffice';
import { getHolidayDates } from './holidays';
import { attendanceByBehavior, attendanceCodesByBehavior } from './status-master';

const pad = (v: number) => String(v).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// Casual Leave days an employee gets in one calendar month (Settings > Attendance Settings). 1 unless HR changes it.
export async function getClPerMonth(): Promise<number> {
  const r = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'cl_monthly_days'");
  const raw = r[0]?.setting_value;
  const v = raw === undefined || raw === null || raw === '' ? 1 : Number(raw);
  return v >= 0 ? v : 1;
}

// The Casual Leave rules (Settings > Attendance Settings), all set by HR:
//   monthly   CL days earned in a calendar month (1)            yearly      most CL days in a calendar year (12; 0 = no yearly limit)
//   carry     unused CL of the earlier months of the year can be used later (off: a month's CL is for that month only)
//   halfRule  'cl' = a half-day leave uses half a CL when there is one, else it is an unpaid Half Day; 'unpaid' = a half-day leave is always an unpaid Half Day
//   afterMonths  CL can be used only after this many months from the joining date (0 = from the first day)
//   maxPerLeave  most CL days one leave request can use; the rest of its days are Unpaid Leave (0 = no limit)
//   sandwichUsesCl  weekly offs / holidays that count as leave because of the sandwich rule may use CL (off: they are always Unpaid Leave)
export interface ClRules { monthly: number; yearly: number; carry: boolean; halfRule: 'cl' | 'unpaid'; afterMonths: number; maxPerLeave: number; sandwichUsesCl: boolean }
export async function getClRules(): Promise<ClRules> {
  const keys = ['cl_monthly_days', 'cl_yearly_days', 'cl_carry_forward', 'cl_half_day_rule', 'cl_after_months', 'cl_max_per_leave', 'cl_sandwich_uses_cl'];
  const r = await query<RowDataPacket[]>(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`, keys);
  const m: Record<string, string> = {}; r.forEach(x => { m[x.setting_key] = x.setting_value; });
  const num = (k: string, d: number, lo: number, hi: number) => { const v = m[k]; if (v === undefined || v === null || v === '') return d; const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
  return {
    monthly: num('cl_monthly_days', 1, 0, 31), yearly: num('cl_yearly_days', 12, 0, 366), carry: m.cl_carry_forward === '1',
    halfRule: m.cl_half_day_rule === 'unpaid' ? 'unpaid' : 'cl', afterMonths: Math.floor(num('cl_after_months', 0, 0, 60)), maxPerLeave: num('cl_max_per_leave', 0, 0, 366), sandwichUsesCl: m.cl_sandwich_uses_cl !== '0',
  };
}

// Sandwich leave (Settings > Attendance Settings): when a leave has at least this many working days (3 unless changed), the weekly offs
// and holidays that fall between its leave days count as leave too, so Thu + Fri + Mon makes Saturday and Sunday leave days as well.
export async function getSandwichSettings(): Promise<{ on: boolean; minDays: number; weekoff: boolean; holiday: boolean }> {
  const r = await query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('sandwich_leave_on', 'sandwich_min_days', 'sandwich_weekoff', 'sandwich_holiday')");
  let on = true, minDays = 3, weekoff = true, holiday = true;
  for (const x of r) {
    if (x.setting_key === 'sandwich_leave_on') on = x.setting_value !== '0';
    if (x.setting_key === 'sandwich_weekoff') weekoff = x.setting_value !== '0';
    if (x.setting_key === 'sandwich_holiday') holiday = x.setting_value !== '0';
    if (x.setting_key === 'sandwich_min_days') { const n = Number(x.setting_value); if (n >= 1 && n <= 31) minDays = n; }
  }
  return { on, minDays, weekoff, holiday };
}

// Undo markLeaveDays when an approved leave is cancelled: the rows it wrote (manual "Leave approved" entries) in the range are removed, so
// the days go back to what the attendance sync makes of them, and the CL they used counts as unused again (CL used is counted from these rows).
export async function unmarkLeaveDays(employeeId: string, start: any, end: any): Promise<number> {
  const emps = await query<RowDataPacket[]>('SELECT emp_code FROM employees WHERE id = ?', [employeeId]);
  if (emps.length === 0 || !emps[0].emp_code) return 0;
  const from = new Date(start), to = new Date(end);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0;
  const r: any = await execute(
    "DELETE FROM attendance WHERE emp_code = ? AND attendance_date BETWEEN ? AND ? AND remark LIKE 'Manual entry: Leave approved%' AND in_time IS NULL",
    [emps[0].emp_code, ymd(new Date(from.getFullYear(), from.getMonth(), from.getDate())), ymd(new Date(to.getFullYear(), to.getMonth(), to.getDate()))]
  );
  return Number(r?.affectedRows ?? r?.[0]?.affectedRows ?? 0);
}

// When a leave request is fully approved, every working day in its range goes into attendance as paid or unpaid leave:
// the month's Casual Leave (1 day a month) is used first, and the days beyond it become Unpaid Leave (UPL). So 3 leave days
// in a month are 1 CL + 2 UPL. A half-day leave uses half a CL, or becomes a Half Day when the CL is already used up.
// Weekly offs, holidays, Extra Work days and days the employee actually punched in are left alone. The rows are saved as manual
// entries, so the TeamOffice sync does not turn them back into Absent.
export async function markLeaveDays(employeeId: string, start: any, end: any, duration: any, by: string): Promise<{ cl: number; upl: number; half: number; skipped: number; sandwich: number }> {
  const out = { cl: 0, upl: 0, half: 0, skipped: 0, sandwich: 0 };
  const emps = await query<RowDataPacket[]>('SELECT emp_code, full_name, DATE_FORMAT(date_of_joining, \'%Y-%m-%d\') AS joined FROM employees WHERE id = ?', [employeeId]);
  if (emps.length === 0 || !emps[0].emp_code) return out;
  const { emp_code: empCode, full_name: name } = emps[0];

  const from = new Date(start), to = new Date(end);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return out;
  const fromD = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toD = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  const weeklyOff = await getWeeklyOffDays();
  const holidays = await getHolidayDates(ymd(fromD), ymd(toD));
  const keepCodes = await attendanceCodesByBehavior('week_off', 'holiday', 'extra_work');
  const halfDayCode = (await attendanceByBehavior('half_day'))?.code || 'HD';
  const rules = await getClRules();
  const jm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(emps[0].joined || ''));
  const joinedAt = jm ? new Date(+jm[1], +jm[2] - 1, +jm[3]) : null;
  const halfLeave = fromD.getTime() === toD.getTime() && Number(duration) > 0 && Number(duration) < 1;
  const weight = halfLeave ? 0.5 : 1;

  // CL already used in each month of a year (days of this range that are being marked again do not count twice)
  const monthUsed = new Map<string, number>();
  const loaded = new Set<number>();
  const loadYear = async (y: number) => {
    if (loaded.has(y)) return;
    loaded.add(y);
    const rows = await query<RowDataPacket[]>(
      "SELECT DATE_FORMAT(attendance_date, '%Y-%m') AS ym, status, COUNT(*) AS c FROM attendance WHERE emp_code = ? AND status IN ('CL', 'CL/2') AND YEAR(attendance_date) = ? AND NOT (attendance_date BETWEEN ? AND ?) GROUP BY ym, status",
      [empCode, y, ymd(fromD), ymd(toD)]
    );
    rows.forEach(r => monthUsed.set(r.ym, (monthUsed.get(r.ym) || 0) + Number(r.c) * (r.status === 'CL/2' ? 0.5 : 1)));
  };
  // CL a day can still use under HR's rules
  const clAvailable = async (d: Date): Promise<number> => {
    const y = d.getFullYear(), m = d.getMonth() + 1;
    await loadYear(y);
    let usedMonth = 0, usedYtd = 0, usedYear = 0;
    for (let i = 1; i <= 12; i++) { const v = monthUsed.get(`${y}-${pad(i)}`) || 0; usedYear += v; if (i <= m) usedYtd += v; if (i === m) usedMonth = v; }
    if (rules.afterMonths > 0 && joinedAt) {
      const since = (y - joinedAt.getFullYear()) * 12 + (m - 1 - joinedAt.getMonth()) - (d.getDate() < joinedAt.getDate() ? 1 : 0);
      if (since < rules.afterMonths) return 0;
    }
    const startMonth = joinedAt && joinedAt.getFullYear() === y ? joinedAt.getMonth() + 1 : 1;
    let avail = rules.carry ? rules.monthly * Math.max(1, m - startMonth + 1) - usedYtd : rules.monthly - usedMonth;
    if (rules.yearly > 0) avail = Math.min(avail, rules.yearly - usedYear);
    return avail;
  };
  let clWeightThisLeave = 0;

  // every day of the range, and whether it is an off day (weekly off or holiday)
  const days: { d: Date; off: boolean; sandwiched: boolean }[] = [];
  for (let d = new Date(fromD); d <= toD; d.setDate(d.getDate() + 1)) days.push({ d: new Date(d), off: weeklyOff.includes(d.getDay()) || holidays.has(ymd(d)), sandwiched: false });

  // Sandwich: off days with a leave (working) day before and after them inside this leave, when the leave is long enough.
  const sandwich = await getSandwichSettings();
  const working = days.map((x, i) => (x.off ? -1 : i)).filter(i => i >= 0);
  if (sandwich.on && !halfLeave && working.length >= sandwich.minDays) {
    const firstW = working[0], lastW = working[working.length - 1];
    // HR decides which kinds of off day can be sandwiched: weekly offs (Sat/Sun), holidays, or both. A holiday counts as a holiday even when it falls on a weekly off.
    for (let i = firstW; i <= lastW; i++) {
      if (!days[i].off) continue;
      const isHoliday = holidays.has(ymd(days[i].d));
      if (isHoliday ? sandwich.holiday : sandwich.weekoff) days[i].sandwiched = true;
    }
  }

  for (const { d, off, sandwiched } of days) {
    if (off && !sandwiched) continue;
    const date = ymd(d);
    const existing = await query<RowDataPacket[]>('SELECT id, status, in_time FROM attendance WHERE emp_code = ? AND attendance_date = ?', [empCode, date]);
    // a week off / holiday row can be turned into leave only by the sandwich rule; Extra Work and punched days are always left alone
    const keep = sandwiched ? await attendanceCodesByBehavior('extra_work') : keepCodes;
    if (existing.length > 0 && (keep.includes(existing[0].status) || existing[0].in_time)) { out.skipped++; continue; }

    let status: string, kind: 'cl' | 'upl' | 'half';
    const clAllowed = !(sandwiched && !rules.sandwichUsesCl) && !(halfLeave && rules.halfRule === 'unpaid')
      && (rules.maxPerLeave === 0 || clWeightThisLeave + weight <= rules.maxPerLeave + 1e-9);
    if (clAllowed && (await clAvailable(d)) >= weight - 1e-9) { status = halfLeave ? 'CL/2' : 'CL'; kind = 'cl'; monthUsed.set(ym(d), (monthUsed.get(ym(d)) || 0) + weight); clWeightThisLeave += weight; }
    else if (halfLeave) { status = halfDayCode; kind = 'half'; }
    else { status = 'UPL'; kind = 'upl'; }

    const remark = `Manual entry: Leave approved (${status}${sandwiched ? ', sandwich' : ''})`;
    if (existing.length > 0) {
      await execute('UPDATE attendance SET status=?, in_time=NULL, out_time=NULL, working_hours=0, remark=?, created_by=?, is_status=1 WHERE id=?', [status, remark, by, existing[0].id]);
    } else {
      await execute(
        'INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, in_time, out_time, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,NULL,NULL,0,?,?,?,1)',
        [uuidv4(), empCode, name, null, date, d.toLocaleDateString('en-US', { weekday: 'long' }), status, remark, by]
      );
    }
    out[kind]++;
    if (sandwiched) out.sandwich++;
  }
  return out;
}
