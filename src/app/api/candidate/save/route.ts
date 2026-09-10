// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    if (!body.candidate_name || !body.contact_number) return jsonError('Name and contact required', 422);

    const mobileCheck = await query<RowDataPacket[]>('SELECT id FROM employees WHERE mobile_no = ?', [body.contact_number]);
    if (mobileCheck.length > 0) return jsonError('Mobile number already exists as employee', 409);

    const id = uuidv4(); const t = now();
    await execute(
      `INSERT INTO interview_candidates (id, candidate_name, contact_number, email_id, date_of_birth, qualification, work_experience, skills, location, career_objective, certificates, resume_pdf_path, raw_json, uploaded_by, uploaded_on) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, body.candidate_name, body.contact_number, body.email_id || '', body.date_of_birth || null, body.qualification || '', body.work_experience || '', body.skills || '', body.location || '', body.career_objective || '', body.certificates || '', body.resume_pdf_path || '', body.raw_json || '', user.email, t]
    );
    return jsonSuccess({ success: true, id, message: 'Candidate saved' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}
