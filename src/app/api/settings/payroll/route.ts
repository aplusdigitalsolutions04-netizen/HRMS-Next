// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Default share of the monthly salary that goes into each component when HR
// presses "Apply Split" on a salary structure. Editable via "Configure Split %";
// these are only the starting values. Everything else (medical insurance, other
// deductions, incentives, EL encashment) is always filled in by hand.
const DEFAULTS = {
  default_basic_percent: '50',
  default_hra_percent: '30',
  default_conveyance_percent: '15',
  default_food_percent: '5',
};
const KEYS = Object.keys(DEFAULTS);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const rows = await query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${KEYS.map(() => '?').join(',')})`,
      KEYS
    );
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.setting_key] = r.setting_value;

    const out: Record<string, string> = {};
    for (const k of KEYS) out[k] = settings[k] ?? DEFAULTS[k];
    return jsonSuccess(out);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_salary_structures')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const values: Record<string, number> = {};
    for (const k of KEYS) {
      const n = parseFloat(body[k] ?? DEFAULTS[k]);
      if (isNaN(n) || n < 0) return jsonError('Every split percentage must be a non-negative number', 422);
      values[k] = n;
    }
    const total = Object.values(values).reduce((a, b) => a + b, 0);
    if (total > 100.0001) return jsonError(`The percentages add up to ${total}%. They must total at most 100%`, 422);

    const t = now();
    for (const [key, value] of Object.entries(values)) {
      const existing = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key=?', [key]);
      if (existing.length > 0) {
        await execute('UPDATE system_settings SET setting_value=?, updated_on=? WHERE setting_key=?', [String(value), t, key]);
      } else {
        await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,?)', [key, String(value), t]);
      }
    }

    return jsonSuccess({ message: 'Payroll settings saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
