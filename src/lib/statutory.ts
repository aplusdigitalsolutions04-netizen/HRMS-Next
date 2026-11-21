// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// Statutory deductions (PF, ESI, TDS, professional tax ... whatever the company has to deduct). NOTHING about them is built into the
// program: every rule, its rates, ceilings and slabs are entered by HR in Payroll > Statutory Deductions, and a rule deducts nothing
// until it is switched on. Rates change with the law, so they are only ever data.
//
//   percent  wage (Basic or Gross of the paid days, up to the ceiling) x employee % (and employer %)
//   fixed    the same amount every month
//   slab     income tax by slabs: (monthly gross x 12 - yearly exemption) is taxed band by band, plus cess %, divided by 12
//   A rule can apply only to employees whose monthly salary is at most a limit ("eligible below"), and each employee can be left
//   out of a rule on the salary structure.

export interface StatRule {
  id: number; code: string; name: string; kind: 'percent' | 'fixed' | 'slab'; enabled: number; wage_base: 'basic' | 'gross';
  employee_rate: number; employer_rate: number; wage_ceiling: number | null; eligible_below: number | null; fixed_amount: number; min_amount: number | null;
  rounding: 'none' | 'rupee' | 'up'; exemption: number; cess: number; slabs: { upto: number | null; rate: number }[]; sort_order: number;
}

const KINDS = ['percent', 'fixed', 'slab'];
const ROUNDING = ['none', 'rupee', 'up'];
const num = (v: any) => Number(v) || 0;
const orNull = (v: any) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));

// The rules start as empty, switched-off rows named after the usual deductions, so HR only has to fill them in (and can delete them).
export async function ensureStatutorySeed() {
  const done = await query<RowDataPacket[]>("SELECT id FROM system_settings WHERE setting_key = 'statutory_seeded'");
  if (done.length) return;
  const rows: [string, string, string, number][] = [['PF', 'Provident Fund (PF)', 'percent', 10], ['ESI', 'Employee State Insurance (ESI)', 'percent', 20], ['TDS', 'Income Tax (TDS)', 'slab', 30]];
  for (const [code, name, kind, order] of rows) {
    await execute('INSERT IGNORE INTO statutory_rules (code, name, kind, enabled, sort_order) VALUES (?,?,?,0,?)', [code, name, kind, order]);
  }
  await execute("INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES ('statutory_seeded', '1', NOW())");
}

export function rowToRule(r: any): StatRule {
  let slabs: any[] = [];
  try { slabs = r.slabs ? JSON.parse(r.slabs) : []; } catch { slabs = []; }
  return {
    id: r.id, code: r.code, name: r.name, kind: KINDS.includes(r.kind) ? r.kind : 'percent', enabled: Number(r.enabled) ? 1 : 0, wage_base: r.wage_base === 'gross' ? 'gross' : 'basic',
    employee_rate: num(r.employee_rate), employer_rate: num(r.employer_rate), wage_ceiling: orNull(r.wage_ceiling), eligible_below: orNull(r.eligible_below),
    fixed_amount: num(r.fixed_amount), min_amount: orNull(r.min_amount), rounding: ROUNDING.includes(r.rounding) ? r.rounding : 'rupee', exemption: num(r.exemption), cess: num(r.cess),
    slabs: slabs.map(s => ({ upto: orNull(s.upto), rate: num(s.rate) })), sort_order: num(r.sort_order),
  };
}

// what the browser may send for a rule, in a safe shape
export function cleanRule(b: any) {
  const code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20);
  const name = String(b.name || '').trim().slice(0, 80);
  const slabs = (Array.isArray(b.slabs) ? b.slabs : []).slice(0, 20).map((s: any) => ({ upto: orNull(s.upto), rate: Math.min(100, Math.max(0, num(s.rate))) }))
    .sort((a: any, c: any) => (a.upto === null ? Infinity : a.upto) - (c.upto === null ? Infinity : c.upto));
  return {
    code, name, kind: KINDS.includes(b.kind) ? b.kind : 'percent', enabled: b.enabled ? 1 : 0, wage_base: b.wage_base === 'gross' ? 'gross' : 'basic',
    employee_rate: Math.min(100, Math.max(0, num(b.employee_rate))), employer_rate: Math.min(100, Math.max(0, num(b.employer_rate))),
    wage_ceiling: orNull(b.wage_ceiling), eligible_below: orNull(b.eligible_below), fixed_amount: Math.max(0, num(b.fixed_amount)), min_amount: orNull(b.min_amount),
    rounding: ROUNDING.includes(b.rounding) ? b.rounding : 'rupee', exemption: Math.max(0, num(b.exemption)), cess: Math.min(100, Math.max(0, num(b.cess))),
    slabs: JSON.stringify(slabs), sort_order: parseInt(b.sort_order) || 100,
  };
}

// Read from the database every time (the table is tiny), so a change made on the Statutory Deductions page applies to the very next
// salary sheet, whichever part of the server handles it.
export function clearStatutoryCache() { /* nothing is kept in memory */ }

let seedChecked = false;
export async function loadStatutoryRules(): Promise<StatRule[]> {
  if (!seedChecked) { await ensureStatutorySeed(); seedChecked = true; }
  const rows = await query<RowDataPacket[]>('SELECT * FROM statutory_rules WHERE enabled = 1 ORDER BY sort_order, id');
  return rows.map(rowToRule);
}

const round = (v: number, mode: string) => (mode === 'up' ? Math.ceil(v - 1e-9) : mode === 'none' ? Math.round(v * 100) / 100 : Math.round(v));

export function computeStatutory(rules: StatRule[], o: { basicPaid: number; grossPaid: number; fullGross: number; off: string[] }) {
  const lines: { code: string; name: string; employee: number; employer: number }[] = [];
  let employee = 0, employer = 0;
  for (const r of rules) {
    if (o.off.includes(r.code)) continue;
    if (r.eligible_below !== null && o.fullGross > r.eligible_below) continue;
    let emp = 0, er = 0;
    if (r.kind === 'fixed') {
      emp = r.fixed_amount;
    } else if (r.kind === 'slab') {
      const annual = Math.max(0, o.fullGross * 12 - r.exemption);
      let tax = 0, prev = 0;
      for (const s of r.slabs) {
        const top = s.upto === null ? Infinity : s.upto;
        tax += Math.max(0, Math.min(annual, top) - prev) * (s.rate / 100);
        prev = top;
        if (annual <= top) break;
      }
      emp = (tax * (1 + r.cess / 100)) / 12;
    } else {
      let base = r.wage_base === 'gross' ? o.grossPaid : o.basicPaid;
      if (r.wage_ceiling !== null) base = Math.min(base, r.wage_ceiling);
      emp = base * (r.employee_rate / 100);
      er = base * (r.employer_rate / 100);
      if (r.min_amount !== null && emp > 0 && emp < r.min_amount) emp = r.min_amount;
    }
    emp = round(emp, r.rounding); er = round(er, r.rounding);
    if (emp > 0 || er > 0) { lines.push({ code: r.code, name: r.name, employee: emp, employer: er }); employee += emp; employer += er; }
  }
  return { lines, employee: Math.round(employee * 100) / 100, employer: Math.round(employer * 100) / 100 };
}
