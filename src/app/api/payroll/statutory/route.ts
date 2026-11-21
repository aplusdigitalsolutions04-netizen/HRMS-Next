// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { ensureStatutorySeed, rowToRule, cleanRule, clearStatutoryCache } from '@/lib/statutory';
import { auditFrom } from '@/lib/audit';

// Statutory deductions (PF, ESI, TDS ...). Every rule and its rates are entered here by HR; nothing is built into the program.
// GET (view_payroll) lists them all. POST / PUT / DELETE need manage_salary_structures.
const canManage = (u: any) => u.type === 'admin' && checkPermission(u, 'manage_salary_structures');

function check(c: any): string | null {
  if (!c.code) return 'Give the rule a short code (letters and numbers)';
  if (!c.name) return 'Give the rule a name';
  if (c.kind === 'slab') {
    const s = JSON.parse(c.slabs);
    if (c.enabled && s.length === 0) return 'Add at least one slab before switching this rule on';
    if (s.filter((x: any) => x.upto === null).length > 1) return 'Only the last slab can have no upper limit';
  }
  return null;
}

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_payroll')) return jsonError('Insufficient permissions', 403);
    await ensureStatutorySeed();
    const rows = await query<RowDataPacket[]>('SELECT * FROM statutory_rules ORDER BY sort_order, id');
    return jsonSuccess({ rules: rows.map(rowToRule) });
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const c = cleanRule(await req.json());
    const bad = check(c); if (bad) return jsonError(bad, 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM statutory_rules WHERE code = ?', [c.code]);
    if (dup.length) return jsonError('A rule with this code already exists', 409);
    const r = await execute(
      `INSERT INTO statutory_rules (code, name, kind, enabled, wage_base, employee_rate, employer_rate, wage_ceiling, eligible_below, fixed_amount, min_amount, rounding, exemption, cess, slabs, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [c.code, c.name, c.kind, c.enabled, c.wage_base, c.employee_rate, c.employer_rate, c.wage_ceiling, c.eligible_below, c.fixed_amount, c.min_amount, c.rounding, c.exemption, c.cess, c.slabs, c.sort_order]);
    clearStatutoryCache();
    await auditFrom(user, 'statutory_rule_added', 'settings', c.code, { name: c.name, enabled: c.enabled });
    return jsonSuccess({ id: r.insertId, message: 'Rule added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const cur = (await query<RowDataPacket[]>('SELECT * FROM statutory_rules WHERE id = ?', [b.id]))[0];
    if (!cur) return jsonError('Rule not found', 404);
    const c = cleanRule({ ...rowToRule(cur), ...b, slabs: b.slabs !== undefined ? b.slabs : rowToRule(cur).slabs });
    const bad = check(c); if (bad) return jsonError(bad, 422);
    const dup = await query<RowDataPacket[]>('SELECT id FROM statutory_rules WHERE code = ? AND id <> ?', [c.code, cur.id]);
    if (dup.length) return jsonError('Another rule has this code', 409);
    await execute(
      `UPDATE statutory_rules SET code=?, name=?, kind=?, enabled=?, wage_base=?, employee_rate=?, employer_rate=?, wage_ceiling=?, eligible_below=?, fixed_amount=?, min_amount=?, rounding=?, exemption=?, cess=?, slabs=?, sort_order=? WHERE id=?`,
      [c.code, c.name, c.kind, c.enabled, c.wage_base, c.employee_rate, c.employer_rate, c.wage_ceiling, c.eligible_below, c.fixed_amount, c.min_amount, c.rounding, c.exemption, c.cess, c.slabs, c.sort_order, cur.id]);
    clearStatutoryCache();
    await auditFrom(user, 'statutory_rule_changed', 'settings', c.code, { name: c.name, enabled: c.enabled, employee_rate: c.employee_rate, employer_rate: c.employer_rate });
    return jsonSuccess({ message: c.enabled ? 'Saved. This rule is ON and will be deducted from the next salary sheet.' : 'Saved. This rule is OFF, nothing is deducted for it.' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!canManage(user)) return jsonError('Insufficient permissions', 403);
    const id = new URL(req.url).searchParams.get('id');
    const cur = (await query<RowDataPacket[]>('SELECT code FROM statutory_rules WHERE id = ?', [id]))[0];
    if (!cur) return jsonError('Rule not found', 404);
    await execute('DELETE FROM statutory_rules WHERE id = ?', [id]);
    clearStatutoryCache();
    await auditFrom(user, 'statutory_rule_deleted', 'settings', cur.code, {});
    return jsonSuccess({ message: 'Rule deleted' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
