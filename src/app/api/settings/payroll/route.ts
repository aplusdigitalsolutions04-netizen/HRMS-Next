// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

const KEYS = ['default_basic_percent', 'default_hra_percent'];

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

    return jsonSuccess({
      default_basic_percent: settings.default_basic_percent ?? '50',
      default_hra_percent: settings.default_hra_percent ?? '20',
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'manage_salary_structures')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const basic = parseFloat(body.default_basic_percent);
    const hra = parseFloat(body.default_hra_percent);
    if (isNaN(basic) || isNaN(hra) || basic < 0 || hra < 0 || basic + hra > 100) {
      return jsonError('Basic % and HRA % must be non-negative and sum to at most 100', 422);
    }

    const t = now();
    for (const [key, value] of [['default_basic_percent', String(basic)], ['default_hra_percent', String(hra)]]) {
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
