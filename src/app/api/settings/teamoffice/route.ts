// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

const KEYS = ['teamoffice_api_url', 'teamoffice_corp_id', 'teamoffice_username', 'teamoffice_password'];

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'settings_attendance')) return jsonError('Insufficient permissions', 403);

    const rows = await query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${KEYS.map(() => '?').join(',')})`,
      KEYS
    );
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.setting_key] = r.setting_value;

    return jsonSuccess({
      teamoffice_api_url: settings.teamoffice_api_url || '',
      teamoffice_corp_id: settings.teamoffice_corp_id || '',
      teamoffice_username: settings.teamoffice_username || '',
      teamoffice_password: settings.teamoffice_password ? '********' : '',
    });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'settings_attendance')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const t = now();

    let password = body.teamoffice_password;
    if (password === '********') {
      const existing = await query<RowDataPacket[]>('SELECT setting_value FROM system_settings WHERE setting_key=?', ['teamoffice_password']);
      password = existing.length > 0 ? existing[0].setting_value : '';
    }

    const values: Record<string, string> = {
      teamoffice_api_url: body.teamoffice_api_url || '',
      teamoffice_corp_id: body.teamoffice_corp_id || '',
      teamoffice_username: body.teamoffice_username || '',
      teamoffice_password: password || '',
    };

    for (const key of KEYS) {
      const value = values[key];
      const existing = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key=?', [key]);
      if (existing.length > 0) {
        await execute('UPDATE system_settings SET setting_value=?, updated_on=? WHERE setting_key=?', [value, t, key]);
      } else {
        await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,?)', [key, value, t]);
      }
    }

    return jsonSuccess({ message: 'TeamOffice settings saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
