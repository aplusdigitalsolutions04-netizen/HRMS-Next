import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, calcHours, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import * as XLSX from 'xlsx';

// Helper to convert Excel date serial number to YYYY-MM-DD string
function parseExcelDate(val: any): string | null {
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const selectedEmpCode = formData.get('empCode') as string;
    
    if (!file) return jsonError('No file uploaded', 400);
    if (!selectedEmpCode) return jsonError('No employee selected', 400);

    // Fetch employee details from DB
    const emps = await query<RowDataPacket[]>('SELECT full_name FROM employees WHERE emp_code = ?', [selectedEmpCode]);
    if (emps.length === 0) {
      return jsonError('Selected employee not found in database.', 404);
    }
    const defaultEmpName = emps[0].full_name;
    const defaultEmpDept = '';

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rows.length === 0) {
      return jsonError('The uploaded Excel file is empty.', 400);
    }

    // Get active template columns
    const templates = await query<RowDataPacket[]>('SELECT columns FROM attendance_templates WHERE is_active = 1 LIMIT 1');
    const activeColumns: any[] = templates.length > 0 ? (typeof templates[0].columns === 'string' ? JSON.parse(templates[0].columns) : templates[0].columns) : [];

    // Comprehensive fallback mappings (matching cleaned alphanumeric strings)
    const matchRules: Record<string, string[]> = {
      emp_code: ['empcode', 'employeecode', 'empid', 'employeeid', 'code', 'id', 'cardno', 'acno', 'acno', 'badgeno', 'enrollperiod', 'empno', 'employeeno', 'employeenumber'],
      name: ['name', 'fullname', 'empname', 'employeename', 'employeename', 'fname', 'lname', 'firstname', 'lastname'],
      department: ['department', 'dept', 'deptname', 'departmentname'],
      attendance_date: ['date', 'attendancedate', 'datetime', 'dateandtime', 'punchdate', 'logdate', 'workdate'],
      day: ['day', 'weekday', 'dayname'],
      shift: ['shift', 'shiftname'],
      in_time: ['in', 'intime', 'clockin', 'checkin', 'timein', 'startin', 'signin'],
      out_time: ['out', 'outtime', 'clockout', 'checkout', 'timeout', 'endout', 'signout'],
      work_plus_ot: ['workot', 'workplusot', 'workinghour', 'workinghours', 'workhour', 'workhours', 'totalhours'],
      ot: ['ot', 'overtime', 'overtimehours'],
      less_hrs: ['lesshrs', 'lesshour', 'lesshours', 'shortage', 'shortagehours'],
      status: ['status', 'attstatus', 'attendancestatus', 'attendance'],
      remark: ['remark', 'remarks', 'note', 'notes'],
    };

    let headerRowIndex = -1;
    let colMap: Record<number, string> = {}; // maps columnIndex to database key
    let detectedHeadersList: string[] = [];

    // Search for the daily records header row (the one containing the Date column)
    for (let r = 0; r < Math.min(rows.length, 25); r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      let matches = 0;
      const tempMap: Record<number, string> = {};
      const currentHeaders: string[] = [];

      for (let c = 0; c < row.length; c++) {
        const rawVal = String(row[c] || '').trim();
        currentHeaders.push(rawVal);
        
        const cellVal = rawVal.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!cellVal) continue;

        let matchedKey: string | null = null;
        if (activeColumns.length > 0) {
          const matchedCol = activeColumns.find(col =>
            String(col.label || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') === cellVal
          );
          if (matchedCol) matchedKey = matchedCol.key;
        }

        if (!matchedKey) {
          for (const [key, patterns] of Object.entries(matchRules)) {
            if (patterns.includes(cellVal)) {
              matchedKey = key;
              break;
            }
          }
        }

        if (matchedKey) {
          tempMap[c] = matchedKey;
          if (['attendance_date', 'status', 'in_time', 'out_time'].includes(matchedKey)) {
            matches++;
          }
        }
      }

      if (tempMap && Object.values(tempMap).includes('attendance_date')) {
        headerRowIndex = r;
        colMap = tempMap;
        detectedHeadersList = currentHeaders;
        break;
      }
    }

    // Fallback if no header row found
    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      const firstRow = rows[0] || [];
      detectedHeadersList = firstRow.map(h => String(h || '').trim());
      for (let c = 0; c < firstRow.length; c++) {
        const cellVal = String(firstRow[c] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [key, patterns] of Object.entries(matchRules)) {
          if (patterns.includes(cellVal)) {
            colMap[c] = key;
            break;
          }
        }
      }
    }

    // Verify if we have at least date mapped
    const mappedKeys = Object.values(colMap);
    if (!mappedKeys.includes('attendance_date')) {
      const displayHeaders = detectedHeadersList.filter(Boolean).join(', ');
      return jsonError(`Could not identify the Date column in the Excel sheet. Found headers: [${displayHeaders || 'None'}]. Please verify that your Excel file has a column named 'Date' (or 'Attendance Date', 'DateTime').`, 400);
    }

    const t = now();
    const affectedSummaries = new Set<string>(); // "emp_code:month:year"
    let importCount = 0;

    // Process data rows
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      // Extract values based on column mapping
      let rowEmpCode = '';
      let name = '';
      let department = '';
      let rawDate: any = null;
      let day = '';
      let shift = '';
      let in_time = '';
      let out_time = '';
      let work_plus_ot = '';
      let ot = '';
      let less_hrs = '';
      let status = '';
      let remark = '';
      let working_hours = 0;

      for (let c = 0; c < row.length; c++) {
        const key = colMap[c];
        if (!key) continue;
        const val = row[c];
        
        switch (key) {
          case 'emp_code': rowEmpCode = String(val || '').trim(); break;
          case 'name': name = String(val || '').trim(); break;
          case 'department': department = String(val || '').trim(); break;
          case 'attendance_date': rawDate = val; break;
          case 'day': day = String(val || '').trim(); break;
          case 'shift': shift = String(val || '').trim(); break;
          case 'in_time': in_time = String(val || '').trim(); break;
          case 'out_time': out_time = String(val || '').trim(); break;
          case 'work_plus_ot': work_plus_ot = String(val || '').trim(); break;
          case 'ot': ot = String(val || '').trim(); break;
          case 'less_hrs': less_hrs = String(val || '').trim(); break;
          case 'status': status = String(val || '').trim(); break;
          case 'remark': remark = String(val || '').trim(); break;
        }
      }

      // If the row contains an employee code and it doesn't match the selected one, skip it
      if (rowEmpCode && rowEmpCode !== selectedEmpCode) {
        continue;
      }
      
      const attendance_date_str = parseExcelDate(rawDate);
      if (!attendance_date_str) continue;

      const dateObj = new Date(attendance_date_str);
      
      // Compute day name if missing
      if (!day) {
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        day = daysOfWeek[dateObj.getDay()];
      }

      // Calculate working hours if missing
      working_hours = parseFloat(calcHours(in_time, out_time)) || 0;

      // Sanitize status
      let cleanStatus = status.trim().toUpperCase();
      if (cleanStatus.startsWith('P') || cleanStatus === 'PRESENT') {
        cleanStatus = 'P';
      } else if (cleanStatus.startsWith('A') || cleanStatus === 'ABSENT') {
        cleanStatus = 'A';
      } else if (cleanStatus.startsWith('W') || cleanStatus === 'WO' || cleanStatus === 'WEEKEND') {
        cleanStatus = 'WO';
      } else if (!cleanStatus) {
        cleanStatus = in_time && out_time ? 'P' : 'A';
      }

      // Upsert into attendance table
      const existing = await query<RowDataPacket[]>('SELECT id FROM attendance WHERE emp_code = ? AND attendance_date = ?', [selectedEmpCode, attendance_date_str]);
      if (existing.length > 0) {
        await execute(
          'UPDATE attendance SET name=?, department=?, day=?, shift=?, in_time=?, out_time=?, work_plus_ot=?, ot=?, less_hrs=?, working_hours=?, status=?, remark=?, created_by=?, is_status=? WHERE id=?',
          [name || defaultEmpName, department || defaultEmpDept, day, shift || null, in_time || null, out_time || null, work_plus_ot || null, ot || null, less_hrs || null, working_hours, cleanStatus, remark || null, user.email, 1, existing[0].id]
        );
      } else {
        const newId = uuidv4();
        await execute(
          'INSERT INTO attendance (id, emp_code, name, department, attendance_date, day, shift, in_time, out_time, work_plus_ot, ot, less_hrs, working_hours, status, remark, created_by, is_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [newId, selectedEmpCode, name || defaultEmpName, department || defaultEmpDept, attendance_date_str, day, shift || null, in_time || null, out_time || null, work_plus_ot || null, ot || null, less_hrs || null, working_hours, cleanStatus, remark || null, user.email, 1]
        );
      }

      affectedSummaries.add(`${selectedEmpCode}:${dateObj.getMonth() + 1}:${dateObj.getFullYear()}`);
      importCount++;
    }

    // Recalculate monthly summaries for all affected months
    for (const item of affectedSummaries) {
      const [empCode, mStr, yStr] = item.split(':');
      const month = parseInt(mStr);
      const year = parseInt(yStr);

      const metrics = await query<RowDataPacket[]>(
        `SELECT 
          COALESCE(SUM(CASE WHEN status='P' THEN 1 ELSE 0 END), 0) as present,
          COALESCE(SUM(CASE WHEN status='A' THEN 1 ELSE 0 END), 0) as absent,
          COALESCE(SUM(working_hours), 0) as total_hours
         FROM attendance 
         WHERE emp_code = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`,
        [empCode, month, year]
      );

      const presentDays = metrics[0].present;
      const absentDays = metrics[0].absent;
      const totalHours = metrics[0].total_hours;

      const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const existingSummary = await query<RowDataPacket[]>(
        'SELECT id FROM attendance_summary WHERE employee_code = ? AND MONTH(attendance_from_date) = ? AND YEAR(attendance_from_date) = ?',
        [empCode, month, year]
      );

      if (existingSummary.length > 0) {
        await execute(
          'UPDATE attendance_summary SET employee_name=?, department=?, attendance_from_date=?, attendance_to_date=?, total_present_days=?, total_absent_days=?, total_working_hours=? WHERE id=?',
          [defaultEmpName, defaultEmpDept, fromDate, toDate, presentDays, absentDays, totalHours, existingSummary[0].id]
        );
      } else {
        const newSummaryId = uuidv4();
        await execute(
          'INSERT INTO attendance_summary (id, employee_code, employee_name, department, attendance_from_date, attendance_to_date, total_present_days, total_absent_days, total_working_hours, performance, is_verified) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [newSummaryId, empCode, defaultEmpName, defaultEmpDept, fromDate, toDate, presentDays, absentDays, totalHours, 'Good', 0]
        );
      }
    }

    return jsonSuccess({ message: `Successfully imported ${importCount} attendance records for ${defaultEmpName}.` });
  } catch (e: any) {
    console.error('[attendance_employee_upload] Error:', e);
    return jsonError(e, 500);
  }
}
