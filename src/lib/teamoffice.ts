import { query, execute } from './db';
import { calcHours, uuidv4 } from './utils';
import { isHoliday } from './holidays';
import { attendanceByBehavior, matchSourceCode, getStatuses } from './status-master';
import { RowDataPacket } from 'mysql2';

async function getTeamOfficeSettings(): Promise<Record<string, string>> {
  const rows = await query<RowDataPacket[]>(
    "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('teamoffice_api_url','teamoffice_corp_id','teamoffice_username','teamoffice_password')"
  );
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.setting_key] = r.setting_value;
  return settings;
}

export async function getTeamOfficeApiUrl(): Promise<string> {
  const settings = await getTeamOfficeSettings();
  let apiUrl = settings.teamoffice_api_url?.trim() || process.env.TEAMOFFICE_API_URL?.trim();
  if (!apiUrl) apiUrl = 'https://api.etimeoffice.com/api';
  if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
  return apiUrl;
}

export async function getTeamOfficeApiKey(): Promise<string | undefined> {
  const settings = await getTeamOfficeSettings();
  let apiKey = process.env.TEAMOFFICE_API_KEY?.trim();
  const corpId = settings.teamoffice_corp_id?.trim() || process.env.TEAMOFFICE_CORP_ID?.trim();
  const username = settings.teamoffice_username?.trim() || process.env.TEAMOFFICE_USERNAME?.trim();
  const password = settings.teamoffice_password?.trim() || process.env.TEAMOFFICE_PASSWORD?.trim();
  if (corpId && username && password) {
    apiKey = Buffer.from(`${corpId}:${username}:${password}:True`).toString('base64');
  }
  return apiKey;
}

const pad = (n: number) => String(n).padStart(2, '0');
const parsePunchTime = (raw: any) => {
  const s = String(raw || '').trim();
  return /^\d{1,2}:\d{2}/.test(s) ? s : '';
};

// Half-day threshold (hours) from Attendance Settings; default 4.
export async function getHalfDayThreshold(): Promise<number> {
  const rows = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'half_day_threshold'");
  const v = parseFloat(rows[0]?.setting_value);
  return v > 0 ? v : 4;
}

// The status code to save for a day, decided from the Status Master (Settings > Status
// Master) and the day's punches. Used by both the monthly import and the live sync so
// they always agree.
//
//   raw status from TeamOffice -> mapped through each status's "TeamOffice codes"
//   punched on a week off / holiday          -> the Extra Work status
//   holiday (Holiday Calendar) and nobody in -> the Holiday status, not an absence
//   Present with both punches under the Half Day threshold -> the Half Day status
//   no usable raw status                     -> Present if both punches exist, else Absent
//
// live = true is for a day still in progress: an IN punch alone is already Present
// (TeamOffice reports such a day as absent until the OUT punch arrives).
export async function resolveAttendanceStatus(o: {
  rawStatus?: string; inTime: string; outTime: string; hours: number; threshold: number;
  isHoliday: boolean; existingStatus?: string; live?: boolean;
}): Promise<{ status: string; recognized: boolean }> {
  const code = async (behavior: string, fallback: string) => (await attendanceByBehavior(behavior))?.code || fallback;
  const raw = (o.rawStatus || '').trim();
  const row = raw ? await matchSourceCode(raw) : undefined;
  const existing = o.existingStatus ? (await getStatuses('attendance', true)).find(r => r.code === o.existingStatus) : undefined;
  const punched = !!o.inTime;
  const complete = !!(o.inTime && o.outTime);

  let behavior = row?.behavior || '';
  let recognized = !raw || !!row;
  if (!raw || !row) behavior = (o.live ? punched : complete) ? 'present' : 'absent'; // nothing usable from TeamOffice
  if (o.live && behavior === 'absent' && punched) behavior = 'present';

  const offDay = o.isHoliday || behavior === 'week_off' || behavior === 'holiday'
    || existing?.behavior === 'week_off' || existing?.behavior === 'extra_work';
  if (offDay && punched) return { status: await code('extra_work', 'EW'), recognized };
  if (o.isHoliday && behavior === 'absent') return { status: await code('holiday', 'HOL'), recognized };
  if (behavior === 'present') {
    const half = complete && o.hours > 0 && o.hours < o.threshold;
    return { status: await code(half ? 'half_day' : 'present', half ? 'HD' : 'P'), recognized };
  }
  if (row && behavior === row.behavior) return { status: row.code, recognized };
  return { status: await code(behavior, behavior === 'absent' ? 'A' : 'P'), recognized };
}

// Pulls IN/OUT punches for one day (today by default) from TeamOffice ('ALL' or one
// emp code) and saves them: check-in time, check-out time, hours and status. Anyone
// with an IN punch is counted in right away, even before their OUT punch exists, and
// the OUT time is filled in the next time this runs. People with no punch are left
// alone (not marked absent mid-day). HR's manual entries are never overwritten.
export async function syncTodayPunches(empCode: string, createdBy: string, date: Date = new Date()): Promise<{ synced: boolean; count: number; reason?: string }> {
  const apiKey = await getTeamOfficeApiKey();
  if (!apiKey) return { synced: false, count: 0, reason: 'TeamOffice not configured' };
  const apiUrl = await getTeamOfficeApiUrl();

  const d = date;
  const dmy = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });

  const res = await fetch(`${apiUrl}/DownloadInOutPunchData?Empcode=${encodeURIComponent(empCode)}&FromDate=${dmy}&ToDate=${dmy}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { synced: false, count: 0, reason: `TeamOffice returned ${res.status}` };
  const data = await res.json();
  if (data.Error) return { synced: false, count: 0, reason: data.Msg || 'TeamOffice error' };

  const threshold = await getHalfDayThreshold();
  const todayIsHoliday = await isHoliday(dateStr);
  let count = 0;
  for (const rec of data.InOutPunchData || []) {
    const code = String(rec.Empcode || '');
    const inTime = parsePunchTime(rec.INTime);
    if (!code || !inTime) continue;
    const outTime = parsePunchTime(rec.OUTTime);
    const hours = parseFloat(calcHours(inTime, outTime)) || 0;

    const existing = await query<RowDataPacket[]>('SELECT id, status, remark FROM attendance WHERE emp_code = ? AND attendance_date = ?', [code, dateStr]);
    // Manual entries (e.g. Work From Home) are never overwritten by a sync.
    if (existing[0]?.remark?.startsWith('Manual entry')) continue;
    const { status } = await resolveAttendanceStatus({
      rawStatus: String(rec.Status || ''), inTime, outTime, hours, threshold,
      isHoliday: todayIsHoliday, existingStatus: existing[0]?.status, live: true,
    });
    if (existing.length > 0) {
      await execute(
        'UPDATE attendance SET in_time=?, out_time=?, working_hours=?, status=?, remark=?, is_status=1 WHERE id=?',
        [inTime, outTime || null, hours, status, 'Imported from TeamOffice', existing[0].id]
      );
    } else {
      await execute(
        'INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, in_time, out_time, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)',
        [uuidv4(), code, rec.Name || null, null, dateStr, day, inTime, outTime || null, hours, status, 'Imported from TeamOffice', createdBy]
      );
    }
    count++;
  }
  return { synced: count > 0, count, reason: count > 0 ? undefined : 'No punch yet' };
}
