// @ts-nocheck
import { NextRequest } from 'next/server';
import { withApiLog } from '@/lib/api-log';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getApiLogSettings, clearApiLogSettingsCache, purgeOldApiLogs } from '@/lib/api-log';
import { auditFrom } from '@/lib/audit';

// When the API log is cleared and what it keeps (ADMIN only).
//   retention_days  - entries older than this many days are deleted automatically (0 = keep for ever)
//   log_get_success - 1 = also keep reads that worked (a lot of rows), 0 = keep only changes and errors
const adminOnly = (user: any) => user && user.type === 'admin' && user.role === 'ADMIN';

async function save(key: string, value: string) {
  const ex = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  if (ex.length > 0) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, key]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [key, value]);
}

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!adminOnly(user)) return jsonError('Only the administrator can see the API log settings.', 403);
    clearApiLogSettingsCache();
    const s = await getApiLogSettings();
    const n = await query<RowDataPacket[]>('SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM api_logs');
    return jsonSuccess({ retention_days: s.retentionDays, log_get_success: s.logGets ? 1 : 0, entries: Number(n[0].n) || 0, oldest: n[0].oldest || null });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!adminOnly(user)) return jsonError('Only the administrator can change the API log settings.', 403);
    const b = await req.json();
    const days = parseInt(b.retention_days);
    if (!(days >= 0 && days <= 3650)) return jsonError('Days must be a number from 0 to 3650 (0 keeps the logs for ever)', 422);
    await save('api_log_retention_days', String(days));
    await save('api_log_get_success', b.log_get_success ? '1' : '0');
    clearApiLogSettingsCache();
    const removed = await purgeOldApiLogs();
    await auditFrom(user, 'api_log_settings_changed', 'settings', 'api_logs', { retention_days: days, log_get_success: b.log_get_success ? 1 : 0 });
    return jsonSuccess({ message: removed ? `Saved. ${removed} older entries were deleted.` : 'Saved.', removed });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
