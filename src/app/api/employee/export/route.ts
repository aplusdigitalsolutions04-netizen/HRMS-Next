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
  try {
    if (storedPath.startsWith('drive:')) {
      const fileId = storedPath.slice('drive:'.length);
      const [buf, meta] = await Promise.all([downloadFileFromDrive(fileId), getDriveFileMeta(fileId)]);
      const ext = path.extname(meta.name || '') || '';
      return { buf, ext };
    }
    const buf = await readFile(path.join(process.cwd(), 'public', storedPath));
    return { buf, ext: path.extname(storedPath) || '' };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);

    const { searchParams } = new URL(req.url);
    const s = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const department = searchParams.get('department') || '';

    let where = 'WHERE 1=1';
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

    for (const emp of employees) {
      const folderName = sanitize(`${emp.emp_code} - ${emp.full_name}`);
      const empFolder = zip.folder(`documents/${folderName}`);

      for (const { label, field } of DOC_FIELDS) {
        const storedPath = emp[field];
        if (!storedPath) continue;
        const doc = await fetchDoc(storedPath);
        if (doc) empFolder.file(`${sanitize(label)}${doc.ext}`, doc.buf);
      }

      let additionalDocs: string[] = [];
      try { additionalDocs = JSON.parse(emp.additional_documents || '[]'); } catch { additionalDocs = []; }
      for (let i = 0; i < additionalDocs.length; i++) {
        const doc = await fetchDoc(additionalDocs[i]);
        if (doc) empFolder.file(`Additional Document ${i + 1}${doc.ext}`, doc.buf);
      }
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
