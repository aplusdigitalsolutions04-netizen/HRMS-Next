// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getSplitComponents, BUILTIN_SPLIT, CUSTOM_KEY } from '@/lib/payroll-calc';

// The salary split: what share of the monthly salary goes into each column when HR presses
// "Apply Split" on a salary structure. The four built-in columns always exist (their % can
// change); HR can add columns of their own. Everything else (insurance, other deductions,
// incentives, EL encashment) is always filled in by hand. Editable via "Configure Split".
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

    const components = await getSplitComponents();
    // The four old percent keys are still returned for anything that reads them.
    const out: Record<string, any> = { components };
    for (const b of BUILTIN_SPLIT) if (b.legacy) out[b.legacy] = String(components.find(c => c.key === b.key)?.percent ?? b.def);
    return jsonSuccess(out);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!checkPermission(user, 'manage_salary_structures')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const incoming: any[] = Array.isArray(body.components) ? body.components : [];
    if (incoming.length === 0) return jsonError('components are required', 422);

    const list: { key: string; label: string; percent: number; kind: string }[] = [];
    for (const b of BUILTIN_SPLIT) {
      const c = incoming.find(x => x && x.key === b.key);
      const pct = parseFloat(c ? c.percent : b.def);
      if (isNaN(pct) || pct < 0 || pct > 100) return jsonError(`${b.label} % must be a number between 0 and 100`, 422);
      list.push({ key: b.key, label: b.label, percent: pct, kind: b.kind });
    }
    const labels = new Set(list.map(x => x.label.toLowerCase()));
    for (const c of incoming) {
      if (!c || BUILTIN_SPLIT.some(b => b.key === c.key)) continue;
      const label = String(c.label || '').trim().slice(0, 40);
      if (!CUSTOM_KEY.test(String(c.key))) return jsonError('Invalid column id', 422);
      if (!label) return jsonError('Every new column needs a name', 422);
      if (labels.has(label.toLowerCase())) return jsonError(`"${label}" is used twice. Column names must be different`, 422);
      labels.add(label.toLowerCase());
      const pct = parseFloat(c.percent);
      if (isNaN(pct) || pct < 0 || pct > 100) return jsonError(`${label} % must be a number between 0 and 100`, 422);
      list.push({ key: c.key, label, percent: pct, kind: c.kind === 'deduction' ? 'deduction' : 'earning' });
    }
    // The 100% limit is for the salary columns (earnings). Deductions / incentives / EL are separate.
    const total = list.filter(x => x.kind === 'earning').reduce((t, x) => t + x.percent, 0);
    if (total > 100.0001) return jsonError(`The salary columns add up to ${Math.round(total * 100) / 100}%. They must total at most 100%`, 422);

    const t = now();
    const values: Record<string, string> = { salary_split_components: JSON.stringify(list) };
    for (const b of BUILTIN_SPLIT) if (b.legacy) values[b.legacy] = String(list.find(x => x.key === b.key)!.percent);
    for (const [key, value] of Object.entries(values)) {
      const existing = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key=?', [key]);
      if (existing.length > 0) {
        await execute('UPDATE system_settings SET setting_value=?, updated_on=? WHERE setting_key=?', [value, t, key]);
      } else {
        await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,?)', [key, value, t]);
      }
    }

    return jsonSuccess({ message: 'Payroll settings saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
