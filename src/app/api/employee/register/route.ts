// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword, generateTempPassword } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { isDriveConfigured, getEmployeeFolderId, uploadFileToDrive } from '@/lib/googleDrive';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);

    const fd = await req.formData();
    const body = {};
    const fileMap = {};
    for (const [key, val] of fd.entries()) {
      if (val instanceof File) {
        fileMap[key] = val;
      } else {
        body[key] = val;
      }
    }

    if (!body.full_name || !body.email_id || !body.mobile_no) {
      return jsonError('Name, email, and mobile are required', 422);
    }

    const existing = await query<RowDataPacket[]>('SELECT id FROM employees WHERE email_id = ?', [body.email_id]);
    if (existing.length > 0) return jsonError('Email already registered', 409);

    const mobileCheck = await query<RowDataPacket[]>('SELECT id FROM employees WHERE mobile_no = ?', [body.mobile_no]);
    if (mobileCheck.length > 0) return jsonError('Mobile number already registered', 409);

    const tempPassword = hashPassword(generateTempPassword());
    const id = uuidv4();
    const t = now();

    const documentsRoot = path.join(process.cwd(), 'public', 'uploads', 'documents');

    // emp_code is needed up front to name the employee's Drive/local folder,
    // before the actual insert (which re-derives/retries it below on a race).
    let prelimEmpCode = body.emp_code;
    if (!prelimEmpCode) {
      const maxCodeRow = await query<RowDataPacket[]>(
        `SELECT MAX(CAST(emp_code AS UNSIGNED)) as maxCode FROM employees WHERE emp_code REGEXP '^[0-9]+$'`
      );
      prelimEmpCode = String((maxCodeRow[0].maxCode || 0) + 1).padStart(4, '0');
    }

    let driveFolderId: string | null = null;
    if (await isDriveConfigured()) {
      driveFolderId = await getEmployeeFolderId(prelimEmpCode, body.full_name);
    }

    const employeeFolderName = `${prelimEmpCode} - ${body.full_name}`.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    const uploadDir = path.join(documentsRoot, employeeFolderName);
    await mkdir(uploadDir, { recursive: true });

    async function saveDoc(file: File): Promise<string> {
      const buf = Buffer.from(await file.arrayBuffer());
      if (driveFolderId) {
        const driveFileId = await uploadFileToDrive(driveFolderId, file.name, buf, file.type);
        return `drive:${driveFileId}`;
      }
      const ext = path.extname(file.name) || '';
      const fileName = `${uuidv4()}${ext}`;
      await writeFile(path.join(uploadDir, fileName), buf);
      return `uploads/documents/${employeeFolderName}/${fileName}`;
    }

    const docColumns = {
      IdentityProof: 'identity_proof', AddressProof: 'address_proof', Resume: 'resume_path',
      UGDegree: 'ug_document', Marksheet10: 'marksheet10', Marksheet12: 'marksheet12',
      OfferLetter: 'offer_letter', PGDegree: 'pg_document', AppointmentLetter: 'appointment_letter',
      InternshipCertificate: 'internship_certificate', Photograph: 'photograph',
    };

    const docPaths: Record<string, string> = {};
    for (const [formKey, colName] of Object.entries(docColumns)) {
      const file = fileMap[formKey];
      if (file instanceof File) {
        docPaths[colName] = await saveDoc(file);
      }
    }

    const additionalDocs = [];
    const addDocsFiles = [];
    for (const [key, val] of fd.entries()) {
      if (key === 'AdditionalDocuments' && val instanceof File) {
        addDocsFiles.push(val);
      }
    }
    for (const file of addDocsFiles) {
      additionalDocs.push(await saveDoc(file));
    }

    if (fileMap['BankDocument'] instanceof File) {
      docPaths['bank_document'] = await saveDoc(fileMap['BankDocument']);
    }

    const insertFields = ['id', 'emp_code', 'email_id', 'password', 'full_name', 'mobile_no', 'status', 'created_on',
      'father_spouse_name', 'dob', 'present_address', 'permanent_address', 'college_name', 'course_name', 'specialization',
      'course_duration', 'cgpa', 'alternate_mobile_no', 'previous_company', 'designation', 'profile_photo', 'document_sources',
      'bank_name', 'account_number', 'pan', 'location', 'date_of_joining', 'additional_documents',
      ...Object.keys(docPaths)];
    const placeholders = insertFields.map(() => '?').join(',');

    // emp_code is derived from a row count, which races under concurrent
    // registrations - retry with a fresh count on a duplicate-key error
    // instead of trusting the count to still be accurate at insert time.
    let empCode = body.emp_code || '';
    const maxAttempts = body.emp_code ? 1 : 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!body.emp_code) {
          // Plain zero-padded number, no "EMP" prefix - matches the emp_code
          // format TeamOffice/E-Timeoffice sends, so attendance sync can
          // match new employees against this code directly. Based on the
          // current max (not a row count), which can be sparse/non-sequential
          // when employees were created out of order (e.g. via TeamOffice
          // sync) - a row count would keep colliding with an existing code.
          const maxCodeRow = await query<RowDataPacket[]>(
            `SELECT MAX(CAST(emp_code AS UNSIGNED)) as maxCode FROM employees WHERE emp_code REGEXP '^[0-9]+$'`
          );
          empCode = String((maxCodeRow[0].maxCode || 0) + 1).padStart(4, '0');
      }

      const insertValues = [id, empCode, body.email_id, tempPassword, body.full_name, body.mobile_no, 'pending', t,
        body.father_spouse_name || '', body.dob || null, body.present_address || '', body.permanent_address || '',
        body.college_name || '', body.course_name || '', body.specialization || '', body.course_duration || '',
        body.cgpa || '', body.alternate_mobile_no || '', body.previous_company || '', body.designation || '',
        '', '{}', body.bank_name || '', body.account_number || '', body.pan || '', body.location || '',
        body.date_of_joining || null, JSON.stringify(additionalDocs), ...Object.values(docPaths)];

      try {
        await execute(
          `INSERT INTO employees (${insertFields.join(',')}) VALUES (${placeholders})`,
          insertValues
        );
        break;
      } catch (e: any) {
        const isDupEmpCode = e?.code === 'ER_DUP_ENTRY' && String(e?.sqlMessage || '').includes('emp_code');
        if (isDupEmpCode && !body.emp_code && attempt < maxAttempts) continue;
        if (isDupEmpCode && body.emp_code) return jsonError('Employee ID already exists', 409);
        throw e;
      }
    }

    return jsonSuccess({ id, emp_code: empCode, message: 'Employee registered successfully' }, 201);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
