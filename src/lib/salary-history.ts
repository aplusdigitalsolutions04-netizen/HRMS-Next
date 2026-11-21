// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { parseExtraComponents } from './payroll-calc';
import { getConfig } from './app-config';

// Salary revision history. Every change of an employee's salary structure is kept with the date it applies from, the reason, and the
// structure before and after, so the history can be read later and a month's salary is worked out with the structure that was valid then.

const NUM = ['basic_pay', 'hra', 'conveyance_allowance', 'food_vouchers', 'medical_insurance', 'other_deductions', 'incentives', 'el_encashment'];
const n = (v: any) => Number(v) || 0;

// "Joining" belongs to the first structure and is added by the program; the others are kept in Settings > Rules & Limits.
export const revisionReasons = async (): Promise<string[]> => ['Joining', ...(await getConfig()).salary_revision_reasons];

// The parts of a structure that make up a revision, in one fixed shape (so two of them can be compared).
export function snapshotOf(row: any) {
  const snap: any = {};
  for (const k of NUM) snap[k] = Math.round(n(row?.[k]) * 100) / 100;
  snap.extra_components = parseExtraComponents(row?.extra_components).filter((x: any) => x.amount > 0).map((x: any) => ({ key: x.key, label: x.label, amount: n(x.amount), type: x.type }));
  snap.ctc = row?.ctc != null && row.ctc !== '' ? n(row.ctc) : null;
  snap.ctc_period = row?.ctc_period || 'monthly';
  return snap;
}

// What the employee earns in a month before deductions: Basic + HRA + Conveyance + Food Vouchers + custom earnings.
export function monthlyTotal(snap: any): number {
  const extras = (snap?.extra_components || []).filter((x: any) => x.type !== 'deduction').reduce((t: number, x: any) => t + n(x.amount), 0);
  return Math.round((n(snap?.basic_pay) + n(snap?.hra) + n(snap?.conveyance_allowance) + n(snap?.food_vouchers) + extras) * 100) / 100;
}

export const sameSnapshot = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

const ymd = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');

export async function recordRevision(o: { empCode: string; before: any | null; after: any; effectiveFrom?: string; reason?: string; note?: string; by?: string }) {
  const oldSnap = o.before ? snapshotOf(o.before) : null;
  const newSnap = snapshotOf(o.after);
  if (oldSnap && sameSnapshot(oldSnap, newSnap)) return false;      // nothing about the pay changed
  const today = new Date();
  const eff = ymd(o.effectiveFrom) || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const allReasons = await revisionReasons();
  const reason = allReasons.includes(String(o.reason)) ? String(o.reason) : (oldSnap ? allReasons[allReasons.length - 1] : 'Joining');
  await execute(
    `INSERT INTO salary_revisions (emp_code, effective_from, reason, note, old_json, new_json, old_total, new_total, revised_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
    [o.empCode, eff, reason, String(o.note || '').slice(0, 300) || null, oldSnap ? JSON.stringify(oldSnap) : null, JSON.stringify(newSnap),
      oldSnap ? monthlyTotal(oldSnap) : null, monthlyTotal(newSnap), o.by || null]
  );
  return true;
}

// A month's salary uses the structure that was valid in that month. The employee rows (current structure) are changed in place:
//  - a revision that applies from the end of that month or earlier: its new structure is used (the latest such one);
//  - otherwise, if a later revision exists: the structure before the earliest later revision is used.
// An employee without revisions, or whose only revision is the first one (no earlier structure kept), keeps the current structure.
export async function applyStructureHistory(employees: any[], month: number, year: number): Promise<void> {
  if (employees.length === 0) return;
  const last = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const codes = employees.map(e => String(e.emp_code));
  const revs = await query<RowDataPacket[]>(
    `SELECT emp_code, DATE_FORMAT(effective_from, '%Y-%m-%d') AS eff, old_json, new_json FROM salary_revisions WHERE emp_code IN (${codes.map(() => '?').join(',')}) ORDER BY effective_from ASC, id ASC`, codes);
  if (revs.length === 0) return;
  const by = new Map<string, any[]>();
  for (const r of revs) { const a = by.get(String(r.emp_code)) || []; a.push(r); by.set(String(r.emp_code), a); }

  for (const e of employees) {
    const list = by.get(String(e.emp_code));
    if (!list) continue;
    const upto = list.filter(r => r.eff <= last);
    let snap: any = null;
    if (upto.length) snap = JSON.parse(upto[upto.length - 1].new_json);
    else { const later = list[0]; if (later.old_json) snap = JSON.parse(later.old_json); }
    if (!snap) continue;
    for (const k of NUM) e[k] = snap[k];
    e.extra_components = snap.extra_components && snap.extra_components.length ? JSON.stringify(snap.extra_components) : null;
  }
}
