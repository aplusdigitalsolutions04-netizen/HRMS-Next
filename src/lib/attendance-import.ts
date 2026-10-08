import { query, execute } from './db';
import { uuidv4, calcHours } from './utils';
import { getTeamOfficeApiUrl, getTeamOfficeApiKey, getHalfDayThreshold, resolveAttendanceStatus } from './teamoffice';
import { attendanceWeightSql, attendanceCountSql } from './status-master';
import { getHolidayDates } from './holidays';
import { RowDataPacket } from 'mysql2';

// Pulls a whole month of IN/OUT punches from TeamOffice and saves them: check-in, check-out,
// hours and status for every employee and day up to today (future days are never saved).
// HR's manual entries (e.g. Work From Home) are never overwritten. Used by the "Sync from
// TeamOffice" buttons, by the background job, and by pages that load the month by themselves.

export class ImportError extends Error {
  status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

const pad = (n: number) => String(n).padStart(2, '0');
const lastDayOf = (year: number, month: number) => new Date(year, month, 0).getDate();
const parseTime = (raw: any): string => {
  const s = String(raw || '').trim();
  return /^\d{1,2}:\d{2}/.test(s) ? s : '';
};

export async function importTeamOfficeMonth(month: number, year: number, byEmail: string): Promise<{ message: string; importCount: number; errors: string[]; total: number }> {
  const apiUrl = await getTeamOfficeApiUrl();
  const apiKey = await getTeamOfficeApiKey();
  if (!apiKey) throw new ImportError('E-Timeoffice API key or login details are not configured', 400);

  const fromDateStr = `01/${pad(month)}/${year}`;
  const toDateStr = `${pad(lastDayOf(year, month))}/${pad(month)}/${year}`;

  let rawRecords: any[];
  try {
    const attRes = await fetch(`${apiUrl}/DownloadInOutPunchData?Empcode=ALL&FromDate=${fromDateStr}&ToDate=${toDateStr}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!attRes.ok) throw new ImportError(`E-Timeoffice API returned ${attRes.status}`, 502);
    const responseData = await attRes.json();
    if (responseData.Error) throw new ImportError(`E-Timeoffice API Error: ${responseData.Msg}`, 502);
    rawRecords = responseData.InOutPunchData || [];
    if (!Array.isArray(rawRecords)) throw new ImportError('E-Timeoffice API did not return an InOutPunchData array', 502);
  } catch (e: any) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(`Failed to fetch attendance from E-Timeoffice: ${e?.message || e}`, 502);
  }

  if (rawRecords.length === 0) {
    return { message: 'No attendance records found in E-Timeoffice for the selected period.', importCount: 0, errors: [], total: 0 };
  }

  const errors: string[] = [];
  let importCount = 0;
  const affectedSummaries = new Set<string>();
  const nowD = new Date();
  const todayStr = `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1)}-${pad(nowD.getDate())}`;
  const halfDayThreshold = await getHalfDayThreshold();
  // How TeamOffice codes map to statuses is set in Settings > Status Master (TeamOffice codes).
  const presentWeightSql = await attendanceWeightSql('status', 'present');
  const absentCountSql = await attendanceCountSql('status', 'absent');
  const holidays = await getHolidayDates(`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(lastDayOf(year, month))}`);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const rec of rawRecords) {
    const empCode = rec.Empcode || '';
    if (!empCode) { errors.push('Skipped record with no employee code'); continue; }
    const attendanceDate = rec.DateString || '';
    if (!attendanceDate) { errors.push(`Skipped record for ${empCode}: no date`); continue; }
    const parts = attendanceDate.split('/');
    if (parts.length !== 3) { errors.push(`Skipped record for ${empCode}: invalid date format "${attendanceDate}"`); continue; }

    const dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
    // TeamOffice returns the whole month, with future days as absent. Skip them so they
    // don't count against anyone's salary before they have happened.
    if (dateStr > todayStr) continue;
    const dateObj = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(dateObj.getTime())) { errors.push(`Skipped record for ${empCode}: invalid date "${attendanceDate}"`); continue; }

    const day = daysOfWeek[dateObj.getUTCDay()];
    const name = rec.Name || '';
    const inTime = parseTime(rec.INTime);
    const outTime = parseTime(rec.OUTTime);
    const rawStatus = (rec.Status || '').toString().trim().toUpperCase();
    const workingHours = parseFloat(calcHours(inTime, outTime)) || 0;
    // The status comes from the Status Master: the TeamOffice code is mapped through each
    // status's "TeamOffice codes"; punches on a week off / holiday are Extra Work; a holiday
    // nobody came in on is a Holiday (not an absence); a short Present day is a Half Day.
    const { status, recognized } = await resolveAttendanceStatus({
      rawStatus, inTime, outTime, hours: workingHours, threshold: halfDayThreshold, isHoliday: holidays.has(dateStr),
    });
    // An unrecognised TeamOffice code is inferred from the punches; keep it visible for HR.
    const remark = recognized ? 'Imported from TeamOffice' : `Imported from TeamOffice (raw status: ${rawStatus})`;

    try {
      const existing = await query<RowDataPacket[]>('SELECT id, remark FROM attendance WHERE emp_code = ? AND attendance_date = ?', [empCode, dateStr]);
      if (existing.length > 0 && String(existing[0].remark || '').startsWith('Manual entry')) {
        // HR's manual entry (e.g. Work From Home) wins over the sync.
      } else if (existing.length > 0) {
        // Department is not provided by this API - leave the existing value untouched.
        await execute(
          'UPDATE attendance SET name=?, day=?, in_time=?, out_time=?, working_hours=?, status=?, remark=?, created_by=?, is_status=? WHERE id=?',
          [name || null, day, inTime || null, outTime || null, workingHours, status, remark, byEmail, 1, existing[0].id]
        );
      } else {
        await execute(
          'INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, in_time, out_time, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [uuidv4(), empCode, name || null, null, dateStr, day, inTime || null, outTime || null, workingHours, status, remark, byEmail, 1]
        );
      }
      affectedSummaries.add(`${empCode}:${month}:${year}`);
      importCount++;
    } catch (e: any) {
      errors.push(`Failed to import record for ${empCode} on ${dateStr}: ${e?.message || e}`);
    }
  }

  // Recalculate monthly summaries
  for (const item of affectedSummaries) {
    const [empCode, mStr, yStr] = item.split(':');
    const m = parseInt(mStr);
    const y = parseInt(yStr);
    const emps = await query<RowDataPacket[]>('SELECT full_name FROM employees WHERE emp_code = ?', [empCode]);
    const empName = emps.length > 0 ? emps[0].full_name : '';
    const metrics = await query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(${presentWeightSql}), 0) as present, COALESCE(SUM(${absentCountSql}), 0) as absent, COALESCE(SUM(working_hours), 0) as total_hours
       FROM attendance WHERE emp_code = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`,
      [empCode, m, y]
    );
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(lastDayOf(y, m))}`;
    const existingSummary = await query<RowDataPacket[]>(
      'SELECT id FROM attendance_summary WHERE employee_code = ? AND MONTH(attendance_from_date) = ? AND YEAR(attendance_from_date) = ?',
      [empCode, m, y]
    );
    if (existingSummary.length > 0) {
      await execute(
        'UPDATE attendance_summary SET employee_name=?, attendance_from_date=?, attendance_to_date=?, total_present_days=?, total_absent_days=?, total_working_hours=? WHERE id=?',
        [empName, from, to, metrics[0].present, metrics[0].absent, metrics[0].total_hours, existingSummary[0].id]
      );
    } else {
      await execute(
        'INSERT INTO attendance_summary (id, employee_code, employee_name, department, attendance_from_date, attendance_to_date, total_present_days, total_absent_days, total_working_hours, performance, is_verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [uuidv4(), empCode, empName, '', from, to, metrics[0].present, metrics[0].absent, metrics[0].total_hours, 'Good', 0]
      );
    }
  }

  const message = errors.length > 0
    ? `Imported ${importCount} of ${rawRecords.length} records from TeamOffice. ${errors.length} were skipped - first reason: ${errors[0]}`
    : `Successfully imported ${importCount} attendance records from TeamOffice.`;
  return { message, importCount, errors, total: rawRecords.length };
}

// ---- Automatic month sync -----------------------------------------------------------------
// Several people / pages can ask for the same month at once, and a full month is a lot of work.
// So: one run at a time per month, and a month is not pulled again within `maxAgeMinutes`.
const g = globalThis as any;
const lastRun: Map<string, number> = (g.__attMonthLastRun ||= new Map());
const running: Map<string, Promise<any>> = (g.__attMonthRunning ||= new Map());

export async function autoImportMonth(month: number, year: number, byEmail: string, maxAgeMinutes = 10): Promise<{ ran: boolean; message: string; at: number }> {
  const key = `${year}-${month}`;
  const last = lastRun.get(key) || 0;
  if (Date.now() - last < maxAgeMinutes * 60_000) return { ran: false, message: 'Already up to date', at: last };
  if (running.has(key)) { await running.get(key); return { ran: false, message: 'Sync already in progress', at: lastRun.get(key) || Date.now() }; }

  const job = (async () => {
    const r = await importTeamOfficeMonth(month, year, byEmail);
    lastRun.set(key, Date.now());
    return r;
  })();
  running.set(key, job.catch(() => {}));
  try {
    const r = await job;
    return { ran: true, message: r.message, at: lastRun.get(key) || Date.now() };
  } finally { running.delete(key); }
}
