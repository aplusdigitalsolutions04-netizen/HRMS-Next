// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { allPlaceholders, DEFAULT_TEMPLATES, ensureLetterTemplates } from '@/lib/letters';
import { auditFrom } from '@/lib/audit';

// The text of each letter. GET lists them with the placeholders that can be used; PUT { letter_type, body } saves one (reset: true
// brings back the standard text).
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    await ensureLetterTemplates();
    const rows = await query<RowDataPacket[]>('SELECT letter_type, name, body, updated_by, updated_at FROM letter_templates ORDER BY name');
    return jsonSuccess({ templates: rows.map(r => ({ ...r, has_standard: !!DEFAULT_TEMPLATES[r.letter_type] })), placeholders: await allPlaceholders() });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    await ensureLetterTemplates();
    const ex = (await query<RowDataPacket[]>('SELECT letter_type FROM letter_templates WHERE letter_type = ?', [b.letter_type]))[0];
    if (!ex) return jsonError('Unknown letter', 422);
    if (b.reset && !DEFAULT_TEMPLATES[b.letter_type]) return jsonError('This letter has no standard text', 422);
    const body = b.reset ? DEFAULT_TEMPLATES[b.letter_type] : String(b.body || '').trim();
    if (body.length < 20) return jsonError('The text is too short', 422);
    if (body.length > 20000) return jsonError('The text is too long', 422);
    await execute('UPDATE letter_templates SET body = ?, updated_by = ?, updated_at = NOW() WHERE letter_type = ?', [body, user.email || String(user.id), b.letter_type]);
    await auditFrom(user, 'letter_template_changed', 'settings', b.letter_type, { reset: !!b.reset });
    return jsonSuccess({ message: b.reset ? 'Standard text restored' : 'Saved', body });
  } catch (e: any) { return jsonError(e, 500); }
}

export const PUT = withApiLog(PUT_handler);

// POST { name, body? } adds a letter type.
async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const name = String(b.name || '').trim().slice(0, 80);
    if (name.length < 2) return jsonError('Give the letter a name', 422);
    await ensureLetterTemplates();
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
    if (!key) return jsonError('Give the letter a name with letters or numbers', 422);
    const dup = (await query<RowDataPacket[]>('SELECT 1 FROM letter_templates WHERE letter_type = ? OR LOWER(name) = LOWER(?)', [key, name]))[0];
    if (dup) return jsonError('A letter with this name already exists', 409);
    const body = String(b.body || '').trim() || 'Date: {{today}}\n\nTo whom it may concern,\n\nThis letter is for {{name}} ({{emp_code}}), {{designation}}.\n\nFor {{company_name}}\n{{signatory_name}}';
    await execute('INSERT INTO letter_templates (letter_type, name, body, updated_by, updated_at) VALUES (?,?,?,?,NOW())', [key, name, body, user.email || String(user.id)]);
    await auditFrom(user, 'letter_type_added', 'settings', key, { name });
    return jsonSuccess({ letter_type: key, name, body, message: 'Letter added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}

// DELETE ?letter_type=key removes a letter type. Letters already made stay as they are.
async function DELETE_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const key = new URL(req.url).searchParams.get('letter_type') || '';
    const r = await execute('DELETE FROM letter_templates WHERE letter_type = ?', [key]);
    if (!r.affectedRows) return jsonError('Unknown letter', 404);
    await auditFrom(user, 'letter_type_removed', 'settings', key, {});
    return jsonSuccess({ message: 'Letter removed' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
export const DELETE = withApiLog(DELETE_handler);
