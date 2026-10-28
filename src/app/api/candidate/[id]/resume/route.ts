// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { saveToDriveFolder, deleteFileFromDrive, driveErrorMessage } from '@/lib/googleDrive';
import { auditFrom } from '@/lib/audit';

const EXTS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
const MIME: Record<string, string> = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const MAX = 10 * 1024 * 1024;

// Puts a resume file on a candidate that already exists (the old file is gone from the server, or a newer resume came in).
// The details of the candidate are not touched, the file is not read again; it is only saved on Google Drive and linked.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_candidates')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const c = (await query<RowDataPacket[]>('SELECT id, candidate_name, contact_number, resume_pdf_path FROM interview_candidates WHERE id = ?', [id]))[0];
    if (!c) return jsonError('Candidate not found', 404);

    const file = (await req.formData()).get('resume') as File | null;
    if (!file || typeof file === 'string' || !file.size) return jsonError('Choose a resume file', 422);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!EXTS.includes(ext)) return jsonError('Upload a PDF, Word (doc/docx) or image (jpg/png) file', 422);
    if (file.size > MAX) return jsonError('The resume must be smaller than 10 MB', 422);

    let path: string;
    try {
      path = await saveToDriveFolder('Candidate Resumes', `resume_${String(c.contact_number || 'candidate').replace(/[^0-9A-Za-z]/g, '')}_${Date.now()}.${ext}`, Buffer.from(await file.arrayBuffer()), MIME[ext]);
    } catch (e: any) {
      return jsonError(driveErrorMessage(e) || e?.message || 'The resume could not be saved on Google Drive', 503);
    }
    await execute('UPDATE interview_candidates SET resume_pdf_path = ? WHERE id = ?', [path, id]);
    // an older resume kept on Drive is replaced; one on the server's disk is left alone
    if (String(c.resume_pdf_path || '').startsWith('drive:')) await deleteFileFromDrive(String(c.resume_pdf_path).slice(6));
    await auditFrom(user, 'candidate_resume_uploaded', 'candidate', id, { name: c.candidate_name, file: file.name });
    return jsonSuccess({ message: 'Resume uploaded', resume_pdf_path: path });
  } catch (e: any) { return jsonError(e, 500); }
}
