// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { letterTypes, ensureLetterTemplates, letterVars, fillLetter } from '@/lib/letters';

// The text of a letter before it is made, so HR can read and change it. POST { employee_id, letter_type, fields? }
async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    if (!(await letterTypes()).some(t => t.key === b.letter_type)) return jsonError('Pick a letter type', 422);
    await ensureLetterTemplates();
    const built = await letterVars(String(b.employee_id || ''), b.fields || {});
    if (!built) return jsonError('Employee not found', 404);
    const t = (await query<RowDataPacket[]>('SELECT body FROM letter_templates WHERE letter_type = ?', [b.letter_type]))[0];
    const text = fillLetter(t?.body || '', built.vars);
    // placeholders that could not be filled (a date that was not given, no salary structure) are listed, so HR can fill them
    const missing = [...new Set([...String(t?.body || '').matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map(m => m[1].toLowerCase()).filter(k => !built.vars[k]))];
    return jsonSuccess({ text, missing });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
