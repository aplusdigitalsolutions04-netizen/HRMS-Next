// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword, generateTempPassword } from '@/lib/auth';
import * as XLSX from 'xlsx';

// Column -> accepted header aliases (cleaned: lowercased, alphanumeric only).
// Documents, designation, and reporting manager are deliberately excluded -
// those need file uploads / dropdown-matched values respectively, which a
// flat spreadsheet import can't safely provide.
const MATCH_RULES: Record<string, string[]> = {
  full_name: ['fullname', 'name', 'employeename'],
  email_id: ['email', 'emailid', 'personalemail'],
  mobile_no: ['mobile', 'mobileno', 'mobilenumber', 'phone', 'contact', 'contactnumber'],
  father_spouse_name: ['fatherspousename', 'fatherspouse', 'fathername', 'spousename'],
  dob: ['dob', 'dateofbirth'],
  present_address: ['presentaddress', 'currentaddress', 'address'],
  permanent_address: ['permanentaddress'],
  college_name: ['collegename', 'college'],
  course_name: ['coursename', 'course'],
  specialization: ['specialization'],
  course_duration: ['courseduration', 'duration'],
  cgpa: ['cgpa', 'percentage', 'marks'],
  alternate_mobile_no: ['alternatemobile', 'alternatemobileno', 'alternatenumber', 'altmobile'],
  official_email: ['officialemail', 'workemail', 'companyemail'],
  official_no: ['officialno', 'officialnumber', 'workphone'],
  previous_company: ['previouscompany', 'lastcompany'],
  bank_name: ['bankname'],
  account_number: ['accountnumber', 'bankaccount', 'accountno'],
  pan: ['pan', 'pannumber'],
  location: ['location', 'city'],
  date_of_joining: ['dateofjoining', 'doj', 'joiningdate'],
  uan: ['uan', 'uannumber'],
  pay_mode: ['paymode'],
};

const clean = (s: any) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return jsonError('No file uploaded', 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rows.length < 2) {
      return jsonError('The uploaded Excel file has no data rows.', 400);
    }

    const headerRow = rows[0] || [];
    const colMap: Record<number, string> = {};
    for (let c = 0; c < headerRow.length; c++) {
      const cellVal = clean(headerRow[c]);
      if (!cellVal) continue;
      for (const [key, patterns] of Object.entries(MATCH_RULES)) {
        if (patterns.includes(cellVal)) { colMap[c] = key; break; }
      }
    }

    const mappedKeys = new Set(Object.values(colMap));
    if (!mappedKeys.has('full_name') || !mappedKeys.has('email_id') || !mappedKeys.has('mobile_no')) {
      return jsonError(`Could not find required columns (Name, Email, Mobile) in the Excel sheet. Found headers: [${headerRow.filter(Boolean).join(', ') || 'None'}]`, 400);
    }

    async function nextFreeEmpCodeNum(): Promise<number> {
      const rows = await query<RowDataPacket[]>(
        `SELECT MAX(CAST(emp_code AS UNSIGNED)) as maxCode FROM employees WHERE emp_code REGEXP '^[0-9]+$'`
      );
      return (rows[0].maxCode || 0) + 1;
    }
    let nextEmpCodeNum = await nextFreeEmpCodeNum();

    const seenInFile = new Set<string>();
    const errors: string[] = [];
    let importCount = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every(v => v === undefined || v === '')) continue;

      const record: Record<string, any> = {};
      for (let c = 0; c < row.length; c++) {
        const key = colMap[c];
        if (!key) continue;
        record[key] = row[c];
      }

      const fullName = String(record.full_name || '').trim();
      const emailId = String(record.email_id || '').trim();
      const mobileNo = String(record.mobile_no || '').trim();
      const rowLabel = fullName || emailId || `row ${r + 1}`;

      if (!fullName || !emailId || !mobileNo) {
        errors.push(`Skipped ${rowLabel}: Name, Email, and Mobile are required`);
        continue;
      }

      const dupKey = emailId.toLowerCase();
      if (seenInFile.has(dupKey)) {
        errors.push(`Skipped ${rowLabel}: duplicate email within the file`);
        continue;
      }

      const existing = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ? OR mobile_no = ?', [emailId, mobileNo]);
      if (existing.length > 0) {
        errors.push(`Skipped ${rowLabel}: email or mobile already registered`);
        continue;
      }
      seenInFile.add(dupKey);

      const tempPassword = hashPassword(generateTempPassword());
      const id = uuidv4();
      const t = now();

      // emp_code is derived from the current max, which can race under
      // concurrent inserts (or drift if it was stale) - retry with a fresh
      // max on a duplicate-key error instead of trusting the counter.
      let inserted = false;
      let lastError: any = null;
      for (let attempt = 1; attempt <= 5 && !inserted; attempt++) {
        const empCode = String(nextEmpCodeNum).padStart(4, '0');
        try {
          await execute(
            `INSERT INTO employees (id, emp_code, email_id, password, full_name, mobile_no, status, created_on,
              father_spouse_name, dob, present_address, permanent_address, college_name, course_name, specialization,
              course_duration, cgpa, alternate_mobile_no, official_email, official_no, previous_company,
              bank_name, account_number, pan, location, date_of_joining, uan, pay_mode,
              document_sources, additional_documents)
             VALUES (?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?)`,
            [id, empCode, emailId, tempPassword, fullName, mobileNo, 'pending', t,
              record.father_spouse_name || '', parseExcelDate(record.dob), record.present_address || '', record.permanent_address || '',
              record.college_name || '', record.course_name || '', record.specialization || '',
              record.course_duration || '', record.cgpa || '', record.alternate_mobile_no || '',
              record.official_email || '', record.official_no || '', record.previous_company || '',
              record.bank_name || '', record.account_number || '', record.pan || '', record.location || '',
              parseExcelDate(record.date_of_joining), record.uan || '', record.pay_mode || 'Online',
              '{}', '[]']
          );
          nextEmpCodeNum++;
          importCount++;
          inserted = true;
        } catch (e: any) {
          lastError = e;
          if (e?.code === 'ER_DUP_ENTRY' && String(e?.sqlMessage || '').includes('emp_code')) {
            nextEmpCodeNum = await nextFreeEmpCodeNum();
            continue;
          }
          break;
        }
      }
      if (!inserted) {
        errors.push(`Skipped ${rowLabel}: ${lastError?.message || 'insert failed'}`);
      }
    }

    const message = errors.length > 0
      ? `Imported ${importCount} of ${rows.length - 1} employees. ${errors.length} were skipped - first reason: ${errors[0]}`
      : `Successfully imported ${importCount} employees. They are pending approval.`;

    return jsonSuccess({ message, importCount, errors: errors.length > 0 ? errors : undefined });
  } catch (e: any) {
    console.error('[employee_import] Error:', e);
    return jsonError(e, 500);
  }
}
