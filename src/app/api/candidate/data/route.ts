// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, parsePagination } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const { page, perPage, offset } = parsePagination(searchParams, 20);
    const search = searchParams.get('search') || '';
    
    let where = 'WHERE 1=1'; const params = [];
    if (search.trim()) { where += ' AND (candidate_name LIKE ? OR email_id LIKE ? OR contact_number LIKE ?)'; const q = `%${search.trim()}%`; params.push(q, q, q); }
    
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM interview_candidates ${where}`, params);
    const rows = await query<RowDataPacket[]>(
      `SELECT ic.*,
        (SELECT id.id FROM interview_details id WHERE id.candidate_id = ic.id ORDER BY id.created_on DESC LIMIT 1) as latest_interview_id,
        (SELECT id.apply_post FROM interview_details id WHERE id.candidate_id = ic.id ORDER BY id.created_on DESC LIMIT 1) as apply_post,
        (SELECT id.interview_round FROM interview_details id WHERE id.candidate_id = ic.id ORDER BY id.created_on DESC LIMIT 1) as interview_round,
        (SELECT id.interview_date FROM interview_details id WHERE id.candidate_id = ic.id ORDER BY id.created_on DESC LIMIT 1) as interview_date,
        (SELECT id.interview_mode FROM interview_details id WHERE id.candidate_id = ic.id ORDER BY id.created_on DESC LIMIT 1) as interview_mode,
        (SELECT id.status FROM interview_details id WHERE id.candidate_id = ic.id ORDER BY id.created_on DESC LIMIT 1) as status
       FROM interview_candidates ic ${where} ORDER BY ic.uploaded_on DESC LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    return jsonSuccess({ data: rows, total: cnt[0].cnt, page, per_page: perPage });
  } catch (e: any) { return jsonError(e, 500); }
}

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
