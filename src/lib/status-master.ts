import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// ---------------------------------------------------------------------------
// Status Master. Every employee status and every attendance status is a row in
// the status_master table (Settings > Status Master), with its label, colour, what
// it means, what it is used for, and the behaviour flags the rest of the app reads
// (does it count as present, is the day unpaid, can the person log in, ...).
// Nothing outside this file needs to know the list of statuses.
//
// The default rows below are only a starting point: they are inserted once, when a
// code is missing, and are never overwritten afterwards, so edits made in the master
// always win. A code can never be changed after it exists (saved attendance and
// employee rows refer to it), but its label, colour, texts and behaviour can.
// ---------------------------------------------------------------------------

export type StatusGroup = 'employee' | 'attendance';

export interface StatusRow {
  id: number;
  group_key: StatusGroup;
  code: string;
  label: string;
  color: string;
  description: string;       // what the status means
  used_for: string;          // what the app does with it
  behavior: string;          // attendance: present | absent | half_day | week_off | holiday | wfh | extra_work | other
  present_weight: number;    // attendance: how much of a present day it counts for (1, 0.5, 0)
  unpaid_weight: number;     // attendance: how much of the day is unpaid in salary (0, 0.5, 1)
  extra_pay: number;         // attendance: 1 = each such day earns extra-work pay
  source_codes: string;      // attendance: TeamOffice status codes that map to this status (comma separated)
  can_login: number;         // employee: may sign in
  is_working: number;        // employee: counted as a working employee (payroll, dashboard, attendance totals)
  in_attendance: number;     // employee: shown in attendance lists and summaries
  is_system: number;         // built in: cannot be deleted
  is_active: number;
  sort_order: number;
}

const DEFAULTS: Omit<StatusRow, 'id'>[] = [
  // ---- Attendance -----------------------------------------------------------
  { group_key: 'attendance', code: 'P', label: 'Present', color: '#16a34a', behavior: 'present', present_weight: 1, unpaid_weight: 0, extra_pay: 0, source_codes: 'P,PRESENT',
    description: 'The employee came in and punched IN and OUT.', used_for: 'Counts as a full present day in attendance totals. The day is paid in full in the salary sheet.',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 10 },
  { group_key: 'attendance', code: 'A', label: 'Absent', color: '#dc2626', behavior: 'absent', present_weight: 0, unpaid_weight: 1, extra_pay: 0, source_codes: 'A,ABSENT',
    description: 'No punch and no approved leave, holiday or week off.', used_for: 'Counts as an absent day. The whole day is unpaid in the salary sheet (salary is cut for it).',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 20 },
  { group_key: 'attendance', code: 'HD', label: 'Half Day', color: '#d97706', behavior: 'half_day', present_weight: 0.5, unpaid_weight: 0.5, extra_pay: 0, source_codes: 'P/2,HD,HALF DAY',
    description: 'Worked less than the Half Day threshold (Attendance Settings), or TeamOffice marked it as half.', used_for: 'Counts as half a present day. Half of the day is unpaid in the salary sheet.',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 30 },
  { group_key: 'attendance', code: 'WO', label: 'Week Off', color: '#4f46e5', behavior: 'week_off', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: 'WO,WEEKEND,WEEK OFF',
    description: 'The weekly off day (for example Sunday).', used_for: 'Not a working day and not an absence. It is a paid day in the salary sheet. If the employee punches in on this day it becomes Extra Work.',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 40 },
  { group_key: 'attendance', code: 'HOL', label: 'Holiday', color: '#ea580c', behavior: 'holiday', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: 'NH,PH,FH,HOL,HOLIDAY',
    description: 'A government or company holiday (from the Holiday Calendar, or sent by TeamOffice as NH).', used_for: 'Not an absence. A paid day in the salary sheet. If the employee punches in on a holiday it becomes Extra Work.',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 50 },
  { group_key: 'attendance', code: 'WFH', label: 'Work From Home', color: '#0891b2', behavior: 'wfh', present_weight: 1, unpaid_weight: 0, extra_pay: 0, source_codes: '',
    description: 'Worked from home on an approved Work From Home request, or entered by HR.', used_for: 'Counts as a full present day. A paid day. Set automatically when a WFH request is fully approved. TeamOffice sync never overwrites it.',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 60 },
  { group_key: 'attendance', code: 'EW', label: 'Extra Work', color: '#9333ea', behavior: 'extra_work', present_weight: 0, unpaid_weight: 0, extra_pay: 1, source_codes: '',
    description: 'The employee worked on a week off or a holiday.', used_for: 'Each Extra Work day adds one day\'s pay (times the Extra Work rate in Payslip Settings) to the salary. Shown as its own count, not as a normal present day.',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 70 },

  // ---- Employee -------------------------------------------------------------
  { group_key: 'employee', code: 'active', label: 'Active', color: '#15803d', behavior: '', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: '',
    description: 'A current employee whose profile HR has approved.', used_for: 'Can log in. Counted as a working employee in payroll, the dashboard and attendance totals. Gets a row on the salary sheet.',
    can_login: 1, is_working: 1, in_attendance: 1, is_system: 1, is_active: 1, sort_order: 10 },
  { group_key: 'employee', code: 'pending', label: 'Pending Approval', color: '#a16207', behavior: '', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: '',
    description: 'The employee has filled in their details and is waiting for HR to approve.', used_for: 'Can log in to see their status. Shown in Employees > Pending Approvals until HR approves, sends back or drops them.',
    can_login: 1, is_working: 0, in_attendance: 1, is_system: 1, is_active: 1, sort_order: 20 },
  { group_key: 'employee', code: 'invited', label: 'Invited', color: '#2563eb', behavior: '', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: '',
    description: 'HR has sent an invite with login details. The employee has not filled in their profile yet.', used_for: 'Can log in to complete their profile. Becomes Pending Approval when they submit it.',
    can_login: 1, is_working: 0, in_attendance: 1, is_system: 1, is_active: 1, sort_order: 30 },
  { group_key: 'employee', code: 'needs_correction', label: 'Needs Correction', color: '#c2410c', behavior: '', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: '',
    description: 'HR sent the profile back with a reason. The employee has to fix it and submit again.', used_for: 'Can log in to see HR\'s remark and re-submit. Goes back to Pending Approval when re-submitted.',
    can_login: 1, is_working: 0, in_attendance: 1, is_system: 1, is_active: 1, sort_order: 40 },
  { group_key: 'employee', code: 'dropped', label: 'Dropped', color: '#dc2626', behavior: '', present_weight: 0, unpaid_weight: 0, extra_pay: 0, source_codes: '',
    description: 'The employee has left the company or was dropped by HR.', used_for: 'Cannot log in. Left out of attendance lists, payroll and dashboard counts.',
    can_login: 0, is_working: 0, in_attendance: 0, is_system: 1, is_active: 1, sort_order: 50 },
];

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await execute(`CREATE TABLE IF NOT EXISTS status_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_key VARCHAR(20) NOT NULL,
    code VARCHAR(20) NOT NULL,
    label VARCHAR(60) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#64748b',
    description VARCHAR(500) NOT NULL DEFAULT '',
    used_for VARCHAR(500) NOT NULL DEFAULT '',
    behavior VARCHAR(30) NOT NULL DEFAULT '',
    present_weight FLOAT NOT NULL DEFAULT 0,
    unpaid_weight FLOAT NOT NULL DEFAULT 0,
    extra_pay TINYINT(1) NOT NULL DEFAULT 0,
    source_codes VARCHAR(200) NOT NULL DEFAULT '',
    can_login TINYINT(1) NOT NULL DEFAULT 0,
    is_working TINYINT(1) NOT NULL DEFAULT 0,
    in_attendance TINYINT(1) NOT NULL DEFAULT 0,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 100,
    UNIQUE KEY uq_status (group_key, code)
  )`);
  // Insert any default that is not there yet. Existing rows are never touched.
  for (const d of DEFAULTS) {
    await execute(
      `INSERT IGNORE INTO status_master (group_key, code, label, color, description, used_for, behavior, present_weight, unpaid_weight, extra_pay, source_codes, can_login, is_working, in_attendance, is_system, is_active, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.group_key, d.code, d.label, d.color, d.description, d.used_for, d.behavior, d.present_weight, d.unpaid_weight, d.extra_pay, d.source_codes, d.can_login, d.is_working, d.in_attendance, d.is_system, d.is_active, d.sort_order]
    );
  }
  tableReady = true;
}

let cache: { at: number; rows: StatusRow[] } | null = null;
const TTL_MS = 3_000; // short, because each API route may hold its own copy of this cache

export function clearStatusCache() { cache = null; }

export async function getAllStatuses(): Promise<StatusRow[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  await ensureTable();
  const rows = await query<RowDataPacket[]>('SELECT * FROM status_master ORDER BY group_key, sort_order, id');
  cache = { at: Date.now(), rows: rows as unknown as StatusRow[] };
  return cache.rows;
}

export async function getStatuses(group: StatusGroup, includeInactive = false): Promise<StatusRow[]> {
  return (await getAllStatuses()).filter(s => s.group_key === group && (includeInactive || s.is_active));
}

// ---- Lookups used by the rest of the app --------------------------------------

// Codes of employee statuses with a flag switched on, e.g. employeeCodes('is_working').
export async function employeeCodes(flag: 'can_login' | 'is_working' | 'in_attendance'): Promise<string[]> {
  return (await getStatuses('employee', true)).filter(s => s[flag] === 1).map(s => s.code);
}

// Codes where a flag is OFF (used to exclude people, e.g. "not in attendance").
export async function employeeCodesWithout(flag: 'can_login' | 'is_working' | 'in_attendance'): Promise<string[]> {
  return (await getStatuses('employee', true)).filter(s => s[flag] !== 1).map(s => s.code);
}

// "(?,?,?)" and its params for an IN / NOT IN list. An empty list gives (NULL), which
// matches nothing for IN and, for NOT IN, would exclude nothing - callers handle that.
export function inList(codes: string[]): { sql: string; params: string[] } {
  if (codes.length === 0) return { sql: '(NULL)', params: [] };
  return { sql: `(${codes.map(() => '?').join(',')})`, params: codes };
}

export async function attendanceByBehavior(behavior: string): Promise<StatusRow | undefined> {
  return (await getStatuses('attendance', true)).find(s => s.behavior === behavior);
}

export async function attendanceCodesByBehavior(...behaviors: string[]): Promise<string[]> {
  return (await getStatuses('attendance', true)).filter(s => behaviors.includes(s.behavior)).map(s => s.code);
}

export async function attendanceCodes(): Promise<string[]> {
  return (await getStatuses('attendance')).map(s => s.code);
}

// Per attendance code: how much of a day it counts as present / unpaid.
export async function attendanceWeights(): Promise<Record<string, { present: number; unpaid: number; extraPay: boolean; behavior: string }>> {
  const out: Record<string, { present: number; unpaid: number; extraPay: boolean; behavior: string }> = {};
  for (const s of await getStatuses('attendance', true)) {
    out[s.code] = { present: Number(s.present_weight) || 0, unpaid: Number(s.unpaid_weight) || 0, extraPay: s.extra_pay === 1, behavior: s.behavior };
  }
  return out;
}

const esc = (v: string) => v.replace(/[^A-Za-z0-9_/ ]/g, '');

// SQL fragment: SUM-able "weight" of an attendance status column, built from the master,
// e.g. attendanceWeightSql('a.status', 'present') -> CASE WHEN a.status='P' THEN 1 ... ELSE 0 END
export async function attendanceWeightSql(column: string, kind: 'present' | 'unpaid'): Promise<string> {
  const field = kind === 'present' ? 'present_weight' : 'unpaid_weight';
  const parts = (await getStatuses('attendance', true))
    .filter(s => Number(s[field]) > 0)
    .map(s => `WHEN ${column}='${esc(s.code)}' THEN ${Number(s[field])}`);
  return parts.length ? `CASE ${parts.join(' ')} ELSE 0 END` : '0';
}

// SQL fragment counting rows of the given behaviors: attendanceCountSql('a.status','absent')
export async function attendanceCountSql(column: string, ...behaviors: string[]): Promise<string> {
  const codes = await attendanceCodesByBehavior(...behaviors);
  return codes.length ? `CASE WHEN ${column} IN (${codes.map(c => `'${esc(c)}'`).join(',')}) THEN 1 ELSE 0 END` : '0';
}

// Map a raw TeamOffice status (e.g. "P", "NH", "P/2") to a status row via source_codes.
export async function matchSourceCode(raw: string): Promise<StatusRow | undefined> {
  const r = (raw || '').trim().toUpperCase();
  if (!r) return undefined;
  const rows = await getStatuses('attendance', true);
  return rows.find(s => s.source_codes.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).includes(r));
}

// ---- Validation for the settings page -------------------------------------------
export const ATTENDANCE_BEHAVIORS = ['present', 'absent', 'half_day', 'week_off', 'holiday', 'wfh', 'extra_work', 'other'];
