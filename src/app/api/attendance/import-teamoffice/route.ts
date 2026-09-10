import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, checkPermission, calcHours } from '@/lib/utils';
import { getTeamOfficeApiUrl, getTeamOfficeApiKey } from '@/lib/teamoffice';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

function lastDayOf(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseTime(raw: any): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) return s;
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);

    const apiUrl = await getTeamOfficeApiUrl();
    const apiKey = await getTeamOfficeApiKey();
    if (!apiKey) return jsonError('E-Timeoffice API key or login details not configured in .env.local', 400);

    const body = await req.json().catch(() => ({}));
    const month = body.month || new Date().getMonth() + 1;
    const year = body.year || new Date().getFullYear();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers['Authorization'] = `Basic ${apiKey}`;

    const fromDateStr = `01/${String(month).padStart(2, '0')}/${year}`;
    const toDateStr = `${String(lastDayOf(year, month)).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

    // Fetch attendance from E-Timeoffice (API 3 - Download IN/OUT Punch Data)
    let rawRecords: any[];
    try {
      const attUrl = `${apiUrl}/DownloadInOutPunchData?Empcode=ALL&FromDate=${fromDateStr}&ToDate=${toDateStr}`;
      const attRes = await fetch(attUrl, { headers, signal: AbortSignal.timeout(30000) });
      if (!attRes.ok) return jsonError(`E-Timeoffice API returned ${attRes.status}`, 502);

      const responseData = await attRes.json();
      if (responseData.Error) {
        return jsonError(`E-Timeoffice API Error: ${responseData.Msg}`, 502);
      }

      rawRecords = responseData.InOutPunchData || [];
      if (!Array.isArray(rawRecords)) return jsonError('E-Timeoffice API did not return an InOutPunchData array', 502);
      console.log(`[import-teamoffice] Fetched ${rawRecords.length} raw records. Sample:`, JSON.stringify(rawRecords[0]));
    } catch (e: any) {
      return jsonError(`Failed to fetch attendance from E-Timeoffice: ${e?.message || e}`, 502);
    }

    if (rawRecords.length === 0) {
      return jsonSuccess({ message: 'No attendance records found in E-Timeoffice for the selected period.', importCount: 0, errors: [] });
    }

    const errors: string[] = [];
    let importCount = 0;
    const affectedSummaries = new Set<string>();
    const KNOWN_STATUS_CODES = new Set(['P', 'PRESENT', 'A', 'ABSENT', 'WO', 'WEEKEND', 'WEEK OFF']);

    for (const rec of rawRecords) {
      const empCode = rec.Empcode || '';
      if (!empCode) { errors.push('Skipped record with no employee code'); continue; }

      const attendanceDate = rec.DateString || '';
      if (!attendanceDate) { errors.push(`Skipped record for ${empCode}: no date`); continue; }

      const parts = attendanceDate.split('/');
      if (parts.length !== 3) { errors.push(`Skipped record for ${empCode}: invalid date format "${attendanceDate}"`); continue; }

      const dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) { errors.push(`Skipped record for ${empCode}: invalid date "${attendanceDate}"`); continue; }

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const day = daysOfWeek[dateObj.getDay()];
      const name = rec.Name || '';
      const inTime = parseTime(rec.INTime);
      const outTime = parseTime(rec.OUTTime);

      const rawStatus = (rec.Status || '').toString().trim().toUpperCase();
      let status: string;
      let recognized = true;
      if (!rawStatus) {
        status = inTime && outTime ? 'P' : 'A';
      } else if (rawStatus.startsWith('P') || rawStatus === 'PRESENT') {
        status = rawStatus.includes('/2') ? 'HD' : 'P';
      } else if (rawStatus.startsWith('A') || rawStatus === 'ABSENT') {
        status = 'A';
      } else if (rawStatus.startsWith('W') || rawStatus === 'WO' || rawStatus === 'WEEKEND' || rawStatus === 'WEEK OFF') {
        status = 'WO';
      } else {
        // Unrecognized code from TeamOffice (e.g. OD/HL/CL) - infer from punch
        // presence so present/absent aggregations stay correct, and keep the
        // original code visible in the remark for HR to review.
        recognized = false;
        status = inTime && outTime ? 'P' : 'A';
      }
      const remark = recognized || KNOWN_STATUS_CODES.has(rawStatus)
        ? 'Imported from TeamOffice'
        : `Imported from TeamOffice (raw status: ${rawStatus})`;

      const workingHours = parseFloat(calcHours(inTime, outTime)) || 0;

      try {
        const existing = await query<RowDataPacket[]>(
          'SELECT id FROM attendance WHERE emp_code = ? AND attendance_date = ?',
          [empCode, dateStr]
        );

        if (existing.length > 0) {
          // Department is not provided by this API - leave the existing
          // value untouched rather than blanking it out on every re-sync.
          await execute(
            `UPDATE attendance SET name=?, day=?, in_time=?, out_time=?, working_hours=?, status=?, remark=?, created_by=?, is_status=? WHERE id=?`,
            [name || null, day, inTime || null, outTime || null, workingHours, status, remark, user.email, 1, existing[0].id]
          );
        } else {
          await execute(
            `INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, in_time, out_time, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [uuidv4(), empCode, name || null, null, dateStr, day, inTime || null, outTime || null, workingHours, status, remark, user.email, 1]
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
        `SELECT
          COALESCE(SUM(CASE WHEN status='P' THEN 1 ELSE 0 END), 0) as present,
          COALESCE(SUM(CASE WHEN status='A' THEN 1 ELSE 0 END), 0) as absent,
          COALESCE(SUM(working_hours), 0) as total_hours
         FROM attendance
         WHERE emp_code = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`,
        [empCode, m, y]
      );

      const presentDays = metrics[0].present;
      const absentDays = metrics[0].absent;
      const totalHours = metrics[0].total_hours;

      const from = `${y}-${String(m).padStart(2, '0')}-01`;
      const last = String(lastDayOf(y, m)).padStart(2, '0');
      const to = `${y}-${String(m).padStart(2, '0')}-${last}`;

      const existingSummary = await query<RowDataPacket[]>(
        'SELECT id FROM attendance_summary WHERE employee_code = ? AND MONTH(attendance_from_date) = ? AND YEAR(attendance_from_date) = ?',
        [empCode, m, y]
      );

      if (existingSummary.length > 0) {
        // Department is not provided by this API - leave the existing value untouched.
        await execute(
          'UPDATE attendance_summary SET employee_name=?, attendance_from_date=?, attendance_to_date=?, total_present_days=?, total_absent_days=?, total_working_hours=? WHERE id=?',
          [empName, from, to, presentDays, absentDays, totalHours, existingSummary[0].id]
        );
      } else {
        await execute(
          'INSERT INTO attendance_summary (id, employee_code, employee_name, department, attendance_from_date, attendance_to_date, total_present_days, total_absent_days, total_working_hours, performance, is_verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [uuidv4(), empCode, empName, '', from, to, presentDays, absentDays, totalHours, 'Good', 0]
        );
      }
    }

    const message = errors.length > 0
      ? `Imported ${importCount} of ${rawRecords.length} records from TeamOffice. ${errors.length} were skipped - first reason: ${errors[0]}`
      : `Successfully imported ${importCount} attendance records from TeamOffice.`;

    return jsonSuccess({
      message,
      importCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error('[import-teamoffice] Error:', e);
    return jsonError(e, 500);
  }
}
