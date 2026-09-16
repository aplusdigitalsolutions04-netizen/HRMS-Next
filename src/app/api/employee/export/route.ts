// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { readFile } from 'fs/promises';
import path from 'path';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { downloadFileFromDrive, getDriveFileMeta } from '@/lib/googleDrive';

const DOC_FIELDS = [
  { label: 'Identity Proof', field: 'identity_proof' },
  { label: 'Address Proof', field: 'address_proof' },
  { label: 'Resume', field: 'resume_path' },
  { label: 'UG Degree', field: 'ug_document' },
  { label: '10th Marksheet', field: 'marksheet10' },
  { label: '12th Marksheet', field: 'marksheet12' },
  { label: 'Offer Letter', field: 'offer_letter' },
  { label: 'PG Degree', field: 'pg_document' },
  { label: 'Appointment Letter', field: 'appointment_letter' },
  { label: 'Internship Certificate', field: 'internship_certificate' },
  { label: 'Photograph', field: 'photograph' },
  { label: 'Bank Document', field: 'bank_document' },
];

const EXPORT_COLUMNS = [
  'emp_code', 'full_name', 'email_id', 'mobile_no', 'alternate_mobile_no', 'official_email', 'official_no',
  'designation', 'status', 'father_spouse_name', 'dob', 'present_address', 'permanent_address',
  'college_name', 'course_name', 'specialization', 'course_duration', 'cgpa', 'previous_company',
  'bank_name', 'account_number', 'pan', 'uan', 'pay_mode', 'location', 'date_of_joining', 'created_on',
];

function sanitize(name: string): string {
  return String(name || '').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

async function fetchDoc(storedPath: string): Promise<{ buf: Buffer; ext: string } | null> {
  if (storedPath.startsWith('drive:')) {
    const fileId = storedPath.slice('drive:'.length);
    const [buf, meta] = await Promise.all([downloadFileFromDrive(fileId), getDriveFileMeta(fileId)]);
    const ext = path.extname(meta.name || '') || '';
    return { buf, ext };
  }
  const buf = await readFile(path.join(process.cwd(), 'public', storedPath));
  return { buf, ext: path.extname(storedPath) || '' };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    // This export includes every employee's PAN, bank details, and identity
    // documents - the same sensitivity as viewing one employee's detail page
    // (which requires view_employee_details), not just the employee list.
    if (!checkPermission(user, 'view_employee_details')) return jsonError('Insufficient permissions', 403);

    const { searchParams } = new URL(req.url);
    const s = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const department = searchParams.get('department') || '';

    let where = 'WHERE is_deleted = 0';
    const params: any[] = [];
    if (s.trim()) { where += ' AND (full_name LIKE ? OR emp_code LIKE ? OR email_id LIKE ? OR mobile_no LIKE ?)'; const q = `%${s.trim()}%`; params.push(q, q, q, q); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (department) {
      where += ' AND designation IN (SELECT de.name FROM designations de JOIN departments d ON de.department_id = d.id WHERE d.name = ?)';
      params.push(department);
    }

    const employees = await query<RowDataPacket[]>(`SELECT * FROM employees ${where} ORDER BY emp_code`, params);

    // Sheet 1: employee details
    const sheetRows = [EXPORT_COLUMNS.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))];
    for (const emp of employees) {
      sheetRows.push(EXPORT_COLUMNS.map(c => {
        const v = emp[c];
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return v ?? '';
      }));
    }
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    const xlsxBuf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const zip = new JSZip();
    zip.file('employees.xlsx', xlsxBuf);
    const warnings: string[] = [];

    for (const emp of employees) {
      const folderName = sanitize(`${emp.emp_code} - ${emp.full_name}`);
      const empFolder = zip.folder(`documents/${folderName}`);

      let additionalDocs: string[] = [];
      try { additionalDocs = JSON.parse(emp.additional_documents || '[]'); } catch { additionalDocs = []; }

      // Independent per-document fetches for this employee - run them
      // concurrently instead of one at a time, since neither Drive calls
      // nor local reads depend on each other.
      const tasks = [
        ...DOC_FIELDS.filter(({ field }) => emp[field]).map(({ label, field }) => ({ label, storedPath: emp[field] })),
        ...additionalDocs.map((storedPath, i) => ({ label: `Additional Document ${i + 1}`, storedPath })),
      ];

      await Promise.all(tasks.map(async ({ label, storedPath }) => {
        try {
          const doc = await fetchDoc(storedPath);
          empFolder.file(`${sanitize(label)}${doc.ext}`, doc.buf);
        } catch (e: any) {
          console.error(`[employee_export] Failed to fetch "${label}" for ${folderName} (${storedPath}):`, e?.message || e);
          warnings.push(`${folderName} - ${label}: ${e?.message || 'failed to fetch'}`);
        }
      }));
    }

    if (warnings.length > 0) {
      zip.file('export_warnings.txt',
        `${warnings.length} document(s) could not be included in this export:\n\n${warnings.join('\n')}`);
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const filename = `employees_export_${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(zipBuf, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error('[employee_export] Error:', e);
    return jsonError(e, 500);
  }
}
