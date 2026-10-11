// @ts-nocheck
import { query } from './db';
import { RowDataPacket } from 'mysql2';
import { attendanceCountSql, employeeCodes, employeeCodesWithout, inList } from './status-master';

export interface ReportColumn { key: string; label: string; align?: 'left' | 'right' | 'center' }
export interface Report {
  type: string; title: string; subtitle: string;
  columns: ReportColumn[]; rows: Record<string, any>[];
  summary: { label: string; value: string | number }[];
}

export const REPORT_TYPES: Record<string, string> = {
  attendance: 'Attendance',
  leave: 'Leave',
  headcount: 'Headcount',
  attrition: 'Attrition',
};

const pad = (n: number) => String(n).padStart(2, '0');
const r1 = (v: number) => Math.round(v * 10) / 10;
const dstr = (v: any) => { if (!v) return ''; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? String(v) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function validRange(from: string, to: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 'Pick a valid From and To date';
  if (from > to) return 'From date must be on or before the To date';
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  if (days > 1100) return 'Please choose a range of 3 years or less';
  return null;
}

export async function buildReport(type: string, from: string, to: string): Promise<Report> {
  switch (type) {
    case 'attendance': return attendanceReport(from, to);
    case 'leave': return leaveReport(from, to);
    case 'headcount': return headcountReport(from, to);
    case 'attrition': return attritionReport(from, to);
    default: throw new Error('Unknown report');
  }
}

// ── Attendance: days per status for every employee, taken from the Status Master behaviours ──
async function attendanceReport(from: string, to: string): Promise<Report> {
  const cnt = async (...b: string[]) => attendanceCountSql('a.status', ...b);
  const excluded = await employeeCodesWithout('in_attendance');
  const exSql = excluded.length ? `AND e.status NOT IN (${excluded.map(() => '?').join(',')})` : '';
  const rows = await query<RowDataPacket[]>(
    `SELECT e.emp_code, e.full_name, COALESCE(dp.name, '') AS department,
       SUM(${await cnt('present')}) AS present, SUM(${await cnt('half_day')}) AS half_day, SUM(${await cnt('wfh')}) AS wfh,
       SUM(${await cnt('extra_work')}) AS extra_work, SUM(${await cnt('absent')}) AS absent,
       SUM(${await cnt('week_off', 'holiday')}) AS off_days, COALESCE(SUM(a.working_hours), 0) AS hours
     FROM employees e
     LEFT JOIN designations d ON d.name = e.designation AND d.is_deleted = 0
     LEFT JOIN departments dp ON dp.id = d.department_id
     LEFT JOIN attendance a ON a.emp_code = e.emp_code AND a.attendance_date BETWEEN ? AND ?
     WHERE e.is_deleted = 0 ${exSql}
     GROUP BY e.id, e.emp_code, e.full_name, dp.name ORDER BY e.full_name`,
    [from, to, ...excluded]
  );
  const out = rows.map(r => ({
    emp_code: r.emp_code, name: r.full_name, department: r.department,
    present: Number(r.present) || 0, half_day: Number(r.half_day) || 0, wfh: Number(r.wfh) || 0, extra_work: Number(r.extra_work) || 0,
    absent: Number(r.absent) || 0, off_days: Number(r.off_days) || 0, hours: r1(Number(r.hours) || 0),
  }));
  const sum = (k: string) => out.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  return {
    type: 'attendance', title: 'Attendance Report', subtitle: `${from} to ${to}`,
    columns: [
      { key: 'emp_code', label: 'Emp Code' }, { key: 'name', label: 'Employee' }, { key: 'department', label: 'Department' },
      { key: 'present', label: 'Present', align: 'right' }, { key: 'half_day', label: 'Half Day', align: 'right' }, { key: 'wfh', label: 'WFH', align: 'right' },
      { key: 'extra_work', label: 'Extra Work', align: 'right' }, { key: 'absent', label: 'Absent', align: 'right' },
      { key: 'off_days', label: 'Week Off / Holiday', align: 'right' }, { key: 'hours', label: 'Working Hours', align: 'right' },
    ],
    rows: out,
    summary: [
      { label: 'Employees', value: out.length }, { label: 'Present days', value: sum('present') }, { label: 'Absent days', value: sum('absent') },
      { label: 'Half days', value: sum('half_day') }, { label: 'Extra work days', value: sum('extra_work') }, { label: 'Total hours', value: r1(sum('hours')) },
    ],
  };
}

// ── Leave: every request that overlaps the range ──
async function leaveReport(from: string, to: string): Promise<Report> {
  const rows = await query<RowDataPacket[]>(
    `SELECT e.emp_code, e.full_name, lr.leave_type, lr.start_date, lr.end_date, lr.duration, lr.status, lr.applied_on, lr.reviewed_by, lr.reason
     FROM leave_requests lr LEFT JOIN employees e ON e.id = lr.employee_id
     WHERE lr.start_date <= ? AND lr.end_date >= ? ORDER BY lr.start_date, e.full_name`, [to, from]);
  const out = rows.map(r => ({
    emp_code: r.emp_code || '', name: r.full_name || '', leave_type: r.leave_type, from: dstr(r.start_date), to: dstr(r.end_date),
    days: Number(r.duration) || 0, status: r.status, applied_on: dstr(r.applied_on), reviewed_by: r.reviewed_by || '', reason: r.reason || '',
  }));
  const days = (st: string) => out.filter(r => String(r.status).toLowerCase() === st).reduce((t, r) => t + r.days, 0);
  const byType = new Map<string, number>();
  out.filter(r => String(r.status).toLowerCase() === 'approved').forEach(r => byType.set(r.leave_type, (byType.get(r.leave_type) || 0) + r.days));
  return {
    type: 'leave', title: 'Leave Report', subtitle: `${from} to ${to}`,
    columns: [
      { key: 'emp_code', label: 'Emp Code' }, { key: 'name', label: 'Employee' }, { key: 'leave_type', label: 'Leave Type' },
      { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'days', label: 'Days', align: 'right' },
      { key: 'status', label: 'Status' }, { key: 'applied_on', label: 'Applied On' }, { key: 'reviewed_by', label: 'Reviewed By' }, { key: 'reason', label: 'Reason' },
    ],
    rows: out,
    summary: [
      { label: 'Requests', value: out.length }, { label: 'Approved days', value: days('approved') }, { label: 'Pending days', value: days('pending') },
      { label: 'Rejected days', value: days('rejected') }, ...[...byType.entries()].map(([k, v]) => ({ label: `${k} (approved)`, value: v })),
    ],
  };
}

// helper: joining date of an employee row
const JOINED = 'COALESCE(e.date_of_joining, DATE(e.created_on))';
const EXITED = 'COALESCE(e.exit_date, DATE(e.deleted_at))';

// ── Headcount on the "To" date, by department, with joiners and leavers inside the range ──
async function headcountReport(from: string, to: string): Promise<Report> {
  const working = inList(await employeeCodes('is_working'));
  const rows = await query<RowDataPacket[]>(
    `SELECT COALESCE(dp.name, 'Unassigned') AS department,
       SUM(CASE WHEN ${JOINED} <= ? AND (${EXITED} IS NULL OR ${EXITED} > ?) AND (e.status IN ${working.sql} OR ${EXITED} IS NOT NULL) THEN 1 ELSE 0 END) AS headcount,
       SUM(CASE WHEN ${JOINED} BETWEEN ? AND ? AND (e.status IN ${working.sql} OR ${EXITED} IS NOT NULL) THEN 1 ELSE 0 END) AS joiners,
       SUM(CASE WHEN ${EXITED} BETWEEN ? AND ? THEN 1 ELSE 0 END) AS leavers
     FROM employees e
     LEFT JOIN designations d ON d.name = e.designation AND d.is_deleted = 0
     LEFT JOIN departments dp ON dp.id = d.department_id
     WHERE (e.is_deleted = 0 OR e.deleted_at IS NOT NULL)
     GROUP BY COALESCE(dp.name, 'Unassigned') ORDER BY headcount DESC`,
    [to, to, ...working.params, from, to, ...working.params, from, to]
  );
  const out = rows.map(r => ({ department: r.department, headcount: Number(r.headcount) || 0, joiners: Number(r.joiners) || 0, leavers: Number(r.leavers) || 0 })).filter(r => r.headcount || r.joiners || r.leavers);
  const sum = (k: string) => out.reduce((t, r) => t + r[k], 0);
  return {
    type: 'headcount', title: 'Headcount Report', subtitle: `Headcount as on ${to}; joiners and leavers ${from} to ${to}`,
    columns: [{ key: 'department', label: 'Department' }, { key: 'headcount', label: `Headcount on ${to}`, align: 'right' }, { key: 'joiners', label: 'Joined in range', align: 'right' }, { key: 'leavers', label: 'Left in range', align: 'right' }],
    rows: out,
    summary: [{ label: `Headcount on ${to}`, value: sum('headcount') }, { label: 'Joined in range', value: sum('joiners') }, { label: 'Left in range', value: sum('leavers') }],
  };
}

// ── Attrition: who left in the range, and the rate ──
async function attritionReport(from: string, to: string): Promise<Report> {
  const working = inList(await employeeCodes('is_working'));
  const leavers = await query<RowDataPacket[]>(
    `SELECT e.emp_code, e.full_name, e.designation, ${JOINED} AS joined, ${EXITED} AS exited, e.status
     FROM employees e WHERE ${EXITED} BETWEEN ? AND ? ORDER BY ${EXITED}, e.full_name`, [from, to]);
  const opening = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM employees e WHERE ${JOINED} < ? AND (${EXITED} IS NULL OR ${EXITED} >= ?) AND (e.status IN ${working.sql} OR ${EXITED} IS NOT NULL)`, [from, from, ...working.params]);
  const closing = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM employees e WHERE ${JOINED} <= ? AND (${EXITED} IS NULL OR ${EXITED} > ?) AND (e.status IN ${working.sql} OR ${EXITED} IS NOT NULL)`, [to, to, ...working.params]);
  const joiners = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM employees e WHERE ${JOINED} BETWEEN ? AND ? AND (e.status IN ${working.sql} OR ${EXITED} IS NOT NULL)`, [from, to, ...working.params]);
  const open = Number(opening[0].n) || 0, close = Number(closing[0].n) || 0;
  const avg = (open + close) / 2;
  const rate = avg > 0 ? r1((leavers.length / avg) * 100) : 0;
  const months = (a: any, b: any) => { const x = new Date(a), y = new Date(b); return Math.max(0, (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth())); };
  const out = leavers.map(r => ({
    emp_code: r.emp_code, name: r.full_name, designation: r.designation || '', joined: dstr(r.joined), exited: dstr(r.exited),
    tenure: r.joined && r.exited ? `${Math.floor(months(r.joined, r.exited) / 12)}y ${months(r.joined, r.exited) % 12}m` : '',
  }));
  return {
    type: 'attrition', title: 'Attrition Report', subtitle: `${from} to ${to}. Exit dates are recorded from the day an employee is marked Dropped or deleted.`,
    columns: [{ key: 'emp_code', label: 'Emp Code' }, { key: 'name', label: 'Employee' }, { key: 'designation', label: 'Designation' }, { key: 'joined', label: 'Joined' }, { key: 'exited', label: 'Left on' }, { key: 'tenure', label: 'Tenure' }],
    rows: out,
    summary: [
      { label: 'Headcount at start', value: open }, { label: 'Joined', value: Number(joiners[0].n) || 0 }, { label: 'Left', value: leavers.length },
      { label: 'Headcount at end', value: close }, { label: 'Attrition rate', value: `${rate}%` },
    ],
  };
}

// ── file formats ──
export function reportToXlsx(report: Report): Buffer {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  const head = report.columns.map(c => c.label);
  const aoa = [[report.title], [report.subtitle], [], head, ...report.rows.map(r => report.columns.map(c => r[c.key] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = report.columns.map(c => ({ wch: Math.max(10, Math.min(40, c.label.length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const sws = XLSX.utils.aoa_to_sheet([['Summary'], ...report.summary.map(s => [s.label, s.value])]);
  sws['!cols'] = [{ wch: 30 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, sws, 'Summary');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function reportToPdf(report: Report, companyName = ''): Promise<Buffer> {
  const puppeteer = (await import('puppeteer')).default;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; font-size:10px; margin:0; }
    h1 { font-size:18px; margin:0 0 2px; } .sub { color:#64748b; margin-bottom:10px; } .co { color:#2563eb; font-weight:700; margin-bottom:6px; }
    .sum { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; } .sum div { border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; background:#f8fafc; } .sum b { display:block; font-size:13px; }
    table { width:100%; border-collapse:collapse; } th { background:#1e3a8a; color:#fff; text-align:left; padding:6px 7px; font-size:9px; text-transform:uppercase; }
    td { padding:5px 7px; border-bottom:1px solid #e2e8f0; } tr:nth-child(even) td { background:#f8fafc; } .r { text-align:right; }
  </style></head><body>
    ${companyName ? `<div class="co">${esc(companyName)}</div>` : ''}
    <h1>${esc(report.title)}</h1><div class="sub">${esc(report.subtitle)}</div>
    <div class="sum">${report.summary.map(s => `<div><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('')}</div>
    <table><thead><tr>${report.columns.map(c => `<th class="${c.align === 'right' ? 'r' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${report.rows.length ? report.rows.map(r => `<tr>${report.columns.map(c => `<td class="${c.align === 'right' ? 'r' : ''}">${esc(r[c.key])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${report.columns.length}" style="text-align:center;color:#94a3b8;padding:18px">No data for this period</td></tr>`}</tbody></table>
  </body></html>`;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const buf = await page.pdf({ format: 'A4', landscape: true, printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
    return Buffer.from(buf);
  } finally { await browser.close(); }
}
