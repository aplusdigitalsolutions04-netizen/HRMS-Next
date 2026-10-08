import { query, execute } from './db';
import { syncTodayPunches } from './teamoffice';
import { autoImportMonth } from './attendance-import';
import { RowDataPacket } from 'mysql2';

// Background sync: every few minutes the server pulls today's check-in / check-out
// punches from TeamOffice and saves them, so attendance fills in by itself - nobody
// has to open a page or press a button. It is switched on/off and timed in
// Settings > Attendance Settings (Auto-sync). It runs inside the app's own server
// process (started from instrumentation.ts), so it works wherever the app runs as a
// normal long-lived Node server.

const g = globalThis as any;
const SYSTEM_USER = 'auto-sync';

async function getSetting(key: string): Promise<string | null> {
  const rows = await query<RowDataPacket[]>('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
  return rows[0]?.setting_value ?? null;
}

async function saveSetting(key: string, value: string) {
  const existing = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  if (existing.length > 0) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, key]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [key, value]);
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function runAttendanceSyncOnce(): Promise<{ ok: boolean; message: string }> {
  const today = new Date();
  const today1 = await syncTodayPunches('ALL', SYSTEM_USER, today);

  // Once per day also re-pull yesterday, so a late check-out (or a shift that ended after
  // midnight) is filled in even though the day has rolled over.
  const key = ymd(today);
  if (g.__attYesterdayDone !== key) {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    try { await syncTodayPunches('ALL', SYSTEM_USER, y); g.__attYesterdayDone = key; } catch { /* retried next cycle */ }
  }

  // The whole month too (every 30 minutes at most): this is what keeps absent / half day / holiday
  // statuses and the salary sheet right without anyone pressing Sync. In the first days of a month
  // the previous month is refreshed as well, because its last days are still being corrected.
  let monthNote = '';
  try {
    await autoImportMonth(today.getMonth() + 1, today.getFullYear(), SYSTEM_USER, 30);
    if (today.getDate() <= 5) {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      await autoImportMonth(prev.getMonth() + 1, prev.getFullYear(), SYSTEM_USER, 30);
    }
  } catch (e: any) { monthNote = ` (month sync: ${String(e?.message || e).slice(0, 80)})`; }

  const message = (today1.synced ? `${today1.count} punch record(s) updated` : (today1.reason || 'Nothing new')) + monthNote;
  await saveSetting('attendance_last_sync_at', new Date().toISOString());
  await saveSetting('attendance_last_sync_result', message);
  return { ok: today1.synced || today1.reason === 'No punch yet', message };
}

export function startAttendanceAutoSync() {
  if (g.__attAutoSyncStarted) return; // dev reloads and repeated register() calls must not stack timers
  g.__attAutoSyncStarted = true;
  let running = false;
  let lastRun = 0;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const enabled = (await getSetting('attendance_auto_sync')) !== '0';              // on unless switched off
      if (!enabled) return;
      const minutes = Math.min(60, Math.max(1, parseInt((await getSetting('attendance_sync_interval_minutes')) || '5') || 5));
      if (Date.now() - lastRun < minutes * 60_000) return;
      lastRun = Date.now();
      await runAttendanceSyncOnce();
    } catch (e: any) {
      console.error('[attendance-auto-sync] failed:', e?.message || e);
      try { await saveSetting('attendance_last_sync_result', `Failed: ${String(e?.message || e).slice(0, 180)}`); } catch { /* ignore */ }
    } finally { running = false; }
  };

  // First run shortly after start, then check every minute whether the interval has passed.
  setTimeout(tick, 15_000);
  setInterval(tick, 60_000);
  console.log('[attendance-auto-sync] started');
}
