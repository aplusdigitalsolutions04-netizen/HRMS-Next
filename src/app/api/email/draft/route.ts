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
    if (!body.candidate_id && !body.to_email) return jsonError('Candidate ID or recipient email required', 422);
    
    const id = uuidv4(); const t = now();
    await execute(
      `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
      [id, body.candidate_id || null, body.to_email || '', body.subject || '', body.body || '', body.cc || '', body.bcc || '', JSON.stringify(body.attachments || []), user.email, t, t]
    );
    return jsonSuccess({ id, message: 'Draft saved' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidate_id') || '';
    let where = 'WHERE 1=1'; const params = [];
    if (candidateId) { where += ' AND candidate_id=?'; params.push(candidateId); }
    const rows = await query<RowDataPacket[]>(`SELECT * FROM email_drafts ${where} ORDER BY updated_at DESC`, params);
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}
