// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { saveEmployeeDocument, deleteFileFromDrive, driveErrorMessage } from '@/lib/googleDrive';

// Same form fields as the profile form (key -> column of the employees table).
const DOC_COLUMNS = {
  IdentityProof: 'identity_proof', AddressProof: 'address_proof', Resume: 'resume_path',
  UGDegree: 'ug_document', Marksheet10: 'marksheet10', Marksheet12: 'marksheet12',
  OfferLetter: 'offer_letter', PGDegree: 'pg_document', AppointmentLetter: 'appointment_letter',
  InternshipCertificate: 'internship_certificate', Photograph: 'photograph', BankDocument: 'bank_document',
};
const EXTS = ['pdf', 'jpg', 'jpeg', 'png'];
const MAX = 10 * 1024 * 1024;

// One document of the employee's own profile, sent on its own. The profile form used to send every file in one request, which
// ran long (each file is saved on Google Drive one after the other) and the hosting proxy cut it off ("Failed to fetch").
// With one file per request each call is short, the form can show how far it is, and the files that already went are not sent
// again when the employee presses Submit a second time. The profile itself is still submitted with PUT /complete-profile.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'employee') return jsonError('Only an invited employee can upload profile documents', 403);

    const emp = (await query<RowDataPacket[]>('SELECT emp_code, full_name, status, additional_documents FROM employees WHERE id = ?', [user.id]))[0];
    if (!emp) return jsonError('Employee not found', 404);
    if (!['invited', 'needs_correction'].includes(emp.status)) return jsonError('Your profile has already been submitted', 400);

    const fd = await req.formData();
    const key = String(fd.get('key') || '');
    const file = fd.get('file');
    const isExtra = key === 'AdditionalDocuments';
    if (!isExtra && !DOC_COLUMNS[key]) return jsonError('Unknown document', 422);
    if (!file || typeof file === 'string' || !file.size) return jsonError('Choose a file', 422);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!EXTS.includes(ext)) return jsonError('Upload a PDF, JPG or PNG file', 422);
    if (file.size > MAX) return jsonError(`"${file.name}" is too big. Please upload a file smaller than 10 MB.`, 422);

    let path: string;
    try {
      path = await saveEmployeeDocument(emp.emp_code, emp.full_name, file);
    } catch (e: any) {
      console.error(`[complete-profile/document] could not save ${key} for ${emp.emp_code}:`, e?.message || e);
      return jsonError(driveErrorMessage(e) || `Could not upload "${file.name}": ${e?.message || 'storage error'}. Please try again, or contact HR if it keeps failing.`, 503);
    }

    if (isExtra) {
      let list: string[] = [];
      try { const v = JSON.parse(emp.additional_documents || '[]'); if (Array.isArray(v)) list = v; } catch { list = []; }
      list.push(path);
      await execute('UPDATE employees SET additional_documents = ? WHERE id = ?', [JSON.stringify(list), user.id]);
    } else {
      const col = DOC_COLUMNS[key];
      const old = (await query<RowDataPacket[]>(`SELECT \`${col}\` AS v FROM employees WHERE id = ?`, [user.id]))[0]?.v;
      await execute(`UPDATE employees SET \`${col}\` = ? WHERE id = ?`, [path, user.id]);
      // a file replaced by a new one is removed from Drive (one kept on the server's disk is left alone)
      if (String(old || '').startsWith('drive:')) await deleteFileFromDrive(String(old).slice(6));
    }
    return jsonSuccess({ key, message: 'Uploaded' });
  } catch (e: any) {
    console.error('[complete-profile/document] failed:', e?.message || e);
    return jsonError(e, 500);
  }
}
