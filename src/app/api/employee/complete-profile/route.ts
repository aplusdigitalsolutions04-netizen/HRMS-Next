// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { saveEmployeeDocument } from '@/lib/googleDrive';

const DOC_COLUMNS = {
  IdentityProof: 'identity_proof', AddressProof: 'address_proof', Resume: 'resume_path',
  UGDegree: 'ug_document', Marksheet10: 'marksheet10', Marksheet12: 'marksheet12',
  OfferLetter: 'offer_letter', PGDegree: 'pg_document', AppointmentLetter: 'appointment_letter',
  InternshipCertificate: 'internship_certificate', Photograph: 'photograph', BankDocument: 'bank_document',
};

// Fields the invited employee is allowed to fill in themselves. Deliberately
// excludes email_id (their login identity, set at invite time) and anything
// HR-only (designation, emp_code, status). mobile_no is set by the employee
// here rather than by HR at invite time.
const EDITABLE_FIELDS = [
  'full_name', 'father_spouse_name', 'dob', 'present_address', 'permanent_address',
  'mobile_no', 'college_name', 'course_name', 'specialization', 'course_duration', 'cgpa',
  'alternate_mobile_no', 'previous_company', 'bank_name', 'account_number', 'pan',
  'location', 'date_of_joining',
];

// The employee's own self-service submission - only touches their own row
// (identified from their auth token, not a URL param), and only while their
// account is still in the invited/needs_correction onboarding state. Once
// submitted it moves to 'pending' for HR review, same queue as public
// self-registration already uses.
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'employee') return jsonError('Only an invited employee can complete a profile', 403);

    const existing = await query<RowDataPacket[]>('SELECT status, emp_code, full_name FROM employees WHERE id = ?', [user.id]);
    if (existing.length === 0) return jsonError('Employee not found', 404);
    if (!['invited', 'needs_correction'].includes(existing[0].status)) {
      return jsonError('Your profile has already been submitted', 400);
    }

    const fd = await req.formData();
    const body: Record<string, any> = {};
    const fileMap: Record<string, File> = {};
    const addDocsFiles: File[] = [];
    for (const [key, val] of fd.entries()) {
      if (val instanceof File) {
        if (key === 'AdditionalDocuments') addDocsFiles.push(val);
        else fileMap[key] = val;
      } else {
        body[key] = val;
      }
    }

    if (!(body.mobile_no || '').trim()) {
      return jsonError('Mobile number is required', 422);
    }
    const mobileConflict = await query<RowDataPacket[]>(
      'SELECT id FROM employees WHERE mobile_no = ? AND id != ? AND COALESCE(is_deleted, 0) = 0', [body.mobile_no.trim(), user.id]
    );
    if (mobileConflict.length > 0) {
      return jsonError('This mobile number is already registered with another employee', 409);
    }

    const sets: string[] = [];
    const vals: any[] = [];
    for (const f of EDITABLE_FIELDS) {
      if (body[f] !== undefined) {
        let v = body[f];
        if (f === 'dob' || f === 'date_of_joining') v = v === '' ? null : v;
        sets.push(`\`${f}\` = ?`); vals.push(v);
      }
    }

    const empCode = existing[0].emp_code;
    const fullName = body.full_name || existing[0].full_name;

    // A failed upload (Drive / disk) must say which file and why, not just "500".
    const saveDoc = async (label: string, file: File) => {
      try {
        return await saveEmployeeDocument(empCode, fullName, file);
      } catch (err: any) {
        console.error(`[complete-profile] could not save ${label} for ${empCode}:`, err?.message || err);
        throw new Error(`Could not upload "${file.name}" (${label}): ${err?.message || 'storage error'}. Please try again, or contact HR if it keeps failing.`);
      }
    };

    const docPaths: Record<string, string> = {};
    for (const [formKey, colName] of Object.entries(DOC_COLUMNS)) {
      const file = fileMap[formKey];
      if (file instanceof File) {
        docPaths[colName] = await saveDoc(formKey, file);
      }
    }
    for (const [col, path] of Object.entries(docPaths)) {
      sets.push(`\`${col}\` = ?`); vals.push(path);
    }

    if (addDocsFiles.length > 0) {
      const newPaths: string[] = [];
      for (const file of addDocsFiles) {
        newPaths.push(await saveDoc('AdditionalDocuments', file));
      }
      sets.push('`additional_documents` = ?'); vals.push(JSON.stringify(newPaths));
    }

    sets.push('`status` = ?', '`hr_remarks` = NULL');
    vals.push('pending');
    vals.push(user.id);

    await execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, vals);

    return jsonSuccess({ message: 'Profile submitted. HR will review and activate your account.' });
  } catch (e: any) {
    console.error('[complete-profile] failed:', e?.message || e);
    return jsonError(e, 500);
  }
}
