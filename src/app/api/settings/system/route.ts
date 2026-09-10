// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>('SELECT setting_key, setting_value FROM system_settings');
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.setting_key] = r.setting_value;
    return jsonSuccess(settings);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'settings_communication')) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const t = now();

    for (const item of items) {
      if (!item || !item.setting_key) continue;
      const value = item.setting_value === undefined || item.setting_value === null ? '' : String(item.setting_value);
      const existing = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key=?', [item.setting_key]);
      if (existing.length > 0) {
        await execute('UPDATE system_settings SET setting_value=?, updated_on=? WHERE setting_key=?', [value, t, item.setting_key]);
      } else {
        await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,?)', [item.setting_key, value, t]);
      }
    }

    return jsonSuccess({ message: 'System settings saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
