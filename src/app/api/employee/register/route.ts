// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { hashPassword, generateTempPassword } from '@/lib/auth';
import { saveEmployeeDocument } from '@/lib/googleDrive';

const DOC_COLUMNS = {
  IdentityProof: 'identity_proof', AddressProof: 'address_proof', Resume: 'resume_path',
  UGDegree: 'ug_document', Marksheet10: 'marksheet10', Marksheet12: 'marksheet12',
  OfferLetter: 'offer_letter', PGDegree: 'pg_document', AppointmentLetter: 'appointment_letter',
  InternshipCertificate: 'internship_certificate', Photograph: 'photograph', BankDocument: 'bank_document',
};

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);

    const fd = await req.formData();
    const body = {};
    const fileMap = {};
    const addDocsFiles = [];
    for (const [key, val] of fd.entries()) {
      if (val instanceof File) {
        if (key === 'AdditionalDocuments') addDocsFiles.push(val);
        else fileMap[key] = val;
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

    const insertFields = ['id', 'emp_code', 'email_id', 'password', 'full_name', 'mobile_no', 'status', 'created_on',
      'father_spouse_name', 'dob', 'present_address', 'permanent_address', 'college_name', 'course_name', 'specialization',
      'course_duration', 'cgpa', 'alternate_mobile_no', 'previous_company', 'designation', 'profile_photo', 'document_sources',
      'bank_name', 'account_number', 'pan', 'location', 'date_of_joining', 'additional_documents'];
    const placeholders = insertFields.map(() => '?').join(',');

    // emp_code is reserved by successfully inserting the core record FIRST,
    // before any document is saved - documents are named after (and only
    // saved once we have) a *confirmed* emp_code, so a concurrent
    // registration racing for the same code can never leave a mismatch
    // between the DB row's emp_code and the folder its documents live in
    // (as happened when the folder name was picked from an unconfirmed
    // "preliminary" code computed before the insert).
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
        body.date_of_joining || null, '[]'];

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

    // Now that emp_code is confirmed (the row exists), save any uploaded
    // documents under a folder named with that same confirmed code.
    const docPaths: Record<string, string> = {};
    for (const [formKey, colName] of Object.entries(DOC_COLUMNS)) {
      const file = fileMap[formKey];
      if (file instanceof File) {
        docPaths[colName] = await saveEmployeeDocument(empCode, body.full_name, file);
      }
    }
    const additionalDocs: string[] = [];
    for (const file of addDocsFiles) {
      additionalDocs.push(await saveEmployeeDocument(empCode, body.full_name, file));
    }

    if (Object.keys(docPaths).length > 0 || additionalDocs.length > 0) {
      const sets = [...Object.keys(docPaths).map(c => `\`${c}\` = ?`), '`additional_documents` = ?'];
      const vals = [...Object.values(docPaths), JSON.stringify(additionalDocs)];
      await execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
    }

    return jsonSuccess({ id, emp_code: empCode, message: 'Employee registered successfully' }, 201);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
