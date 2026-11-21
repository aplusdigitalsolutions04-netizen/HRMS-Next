// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, now, hasAnyPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_drafts', 'manage_drafts', 'send_candidate_emails', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
    const body = await req.json();
    if (!body.candidate_id && !body.to_email) return jsonError('Candidate ID or recipient email required', 422);
    
    const id = uuidv4(); const t = now();
    // the candidate's name and the template's name are kept with the draft, so the Drafts list can show them
    let candidateName = String(body.candidate_name || '').trim();
    if (!candidateName && body.candidate_id) {
      candidateName = (await query<RowDataPacket[]>('SELECT candidate_name FROM interview_candidates WHERE id = ?', [body.candidate_id]).catch(() => []))[0]?.candidate_name || '';
    }
    let templateId = body.template_id || null;
    let templateName = String(body.template_name || '').trim();
    if (templateId && !templateName) {
      templateName = (await query<RowDataPacket[]>('SELECT name FROM email_templates WHERE id = ?', [templateId]).catch(() => []))[0]?.name || '';
    }
    // A candidate has one draft row (the table has a unique key on candidate_id), also after the earlier mail was sent. Saving again
    // writes into that row and makes it a draft again, instead of failing with a duplicate error.
    if (body.candidate_id) {
      const ex = (await query<RowDataPacket[]>('SELECT id FROM email_drafts WHERE candidate_id = ? LIMIT 1', [body.candidate_id]))[0];
      if (ex) {
        const sets = "to_email=?, subject=?, body=?, cc=?, bcc=?, attachments=?, status='draft', updated_at=?";
        const vals = [body.to_email || '', body.subject || '', body.body || '', body.cc || '', body.bcc || '', JSON.stringify(body.attachments || []), t];
        try {
          await execute(`UPDATE email_drafts SET ${sets}, candidate_name=?, template_id=?, template_name=? WHERE id=?`, [...vals, candidateName || null, templateId, templateName || null, ex.id]);
        } catch {
          await execute(`UPDATE email_drafts SET ${sets} WHERE id=?`, [...vals, ex.id]);
        }
        return jsonSuccess({ id: ex.id, message: 'Draft updated' }, 200);
      }
    }
    const args = [id, body.candidate_id || null, body.to_email || '', body.subject || '', body.body || '', body.cc || '', body.bcc || '', JSON.stringify(body.attachments || []), user.email, t, t];
    try {
      await execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at, candidate_name, template_id, template_name) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?,?,?,?)`,
        [...args, candidateName || null, templateId, templateName || null]
      );
    } catch {
      // a database set up without those columns still saves the draft
      await execute(
        `INSERT INTO email_drafts (id, candidate_id, to_email, subject, body, cc, bcc, attachments, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        args
      );
    }
    return jsonSuccess({ id, message: 'Draft saved' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

// Drafts saved before the candidate / template names were kept get them filled in from the candidate and the template (checked at most every ten minutes).
let namesRepairedAt = 0;
async function repairDraftNames() {
  if (Date.now() - namesRepairedAt < 10 * 60_000) return;   // at most every ten minutes
  namesRepairedAt = Date.now();
  try {
    await execute("UPDATE email_drafts d JOIN interview_candidates c ON c.id = d.candidate_id SET d.candidate_name = c.candidate_name WHERE (d.candidate_name IS NULL OR d.candidate_name = '')");
    await execute("UPDATE email_drafts d JOIN email_templates t ON t.id = d.template_id SET d.template_name = t.name WHERE (d.template_name IS NULL OR d.template_name = '')");
  } catch { /* a database without those columns */ }
}

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin') return new Response(JSON.stringify({ detail: 'Insufficient permissions' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    if (!hasAnyPermission(user, ['view_drafts', 'manage_drafts', 'send_candidate_emails', 'add_candidate'])) return jsonError('Insufficient permissions', 403);
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidate_id') || '';
    let where = 'WHERE 1=1'; const params = [];
    if (candidateId) { where += ' AND candidate_id=?'; params.push(candidateId); }
    await repairDraftNames();
    const rows = await query<RowDataPacket[]>(`SELECT * FROM email_drafts ${where} ORDER BY updated_at DESC`, params);
    return jsonSuccess(rows);
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
export const GET = withApiLog(GET_handler);
