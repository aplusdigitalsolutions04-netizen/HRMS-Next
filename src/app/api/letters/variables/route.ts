// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { SOURCES, isSource, letterWords, restoreStandardWords } from '@/lib/letters';
import { auditFrom } from '@/lib/audit';

// The words of the letters ({{name}}, {{hr_phone}}). All of them can be added, changed and removed.
//   GET                                   -> { words, sources }
//   POST { label, key?, kind, value? }    adds one      (kind: 'field' = filled from data (value = the data), 'text' = fixed text (value), 'ask' = typed each time)
//   POST { action: 'restore_standard' }   puts back the standard words that were removed
//   PUT  { key, label?, kind?, value? }   changes one
//   DELETE ?key=                          removes one
const MAX = 120;
// a missing login answers 401 (thrown as a ready response); a login without the permission answers 403
const need = async (req: NextRequest, perm: string) => { const u = await getAuthUser(req); if (!u) throw jsonError('Not authenticated', 401); return u.type === 'admin' && checkPermission(u, perm) ? u : null; };
const readUser = (req: NextRequest) => need(req, 'view_employees');
const writeUser = (req: NextRequest) => need(req, 'edit_employee');
const keyOf = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
const clean = (b: any, cur?: any) => {
  const kind = b.kind !== undefined ? (b.kind === 'ask' ? 'ask' : b.kind === 'field' ? 'field' : 'text') : (cur ? cur.kind : 'text');
  const raw = b.value !== undefined ? String(b.value) : (cur ? cur.value || '' : '');
  if (kind === 'ask') return { kind, value: '' };
  if (kind === 'field') return isSource(raw) ? { kind, value: raw } : { error: 'Pick what this word is filled from' };
  if (!raw.trim()) return { error: 'Type the text this word is replaced with' };
  return { kind, value: raw.slice(0, 1000) };
};

async function GET_handler(req: NextRequest) {
  try {
    if (!(await readUser(req))) return jsonError('Insufficient permissions', 403);
    return jsonSuccess({ words: await letterWords(), sources: SOURCES });
  } catch (e: any) { return e instanceof Response ? e : jsonError(e, 500); }
}

async function POST_handler(req: NextRequest) {
  try {
    const user = await writeUser(req);
    if (!user) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    if (b.action === 'restore_standard') {
      const n = await restoreStandardWords();
      await auditFrom(user, 'letter_words_restored', 'settings', 'letters', { added: n });
      return jsonSuccess({ message: n ? `${n} standard word${n > 1 ? 's' : ''} put back` : 'All standard words are already there', added: n });
    }
    const label = String(b.label || '').trim().slice(0, 80);
    if (label.length < 2) return jsonError('Give the word a name', 422);
    let key = keyOf(b.key || label);
    if (!/^[a-z]/.test(key)) key = 'w_' + key;
    if (key.length < 2) return jsonError('The word needs letters or numbers in its name', 422);
    const c = clean(b);
    if (c.error) return jsonError(c.error, 422);
    await letterWords();
    if (Number((await query<RowDataPacket[]>('SELECT COUNT(*) n FROM letter_variables'))[0].n) >= MAX) return jsonError(`At most ${MAX} words can be added`, 422);
    if ((await query<RowDataPacket[]>('SELECT 1 FROM letter_variables WHERE var_key = ?', [key]))[0]) return jsonError('A word with this name already exists', 409);
    await execute('INSERT INTO letter_variables (var_key, label, kind, value, updated_by, updated_at) VALUES (?,?,?,?,?,NOW())', [key, label, c.kind, c.value, user.email || String(user.id)]);
    await auditFrom(user, 'letter_word_added', 'settings', key, { label, kind: c.kind });
    return jsonSuccess({ key, label, kind: c.kind, value: c.value, message: 'Word added' }, 201);
  } catch (e: any) { return e instanceof Response ? e : jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await writeUser(req);
    if (!user) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const ex = (await query<RowDataPacket[]>('SELECT * FROM letter_variables WHERE var_key = ?', [b.key]))[0];
    if (!ex) return jsonError('Unknown word', 404);
    const label = b.label !== undefined ? String(b.label).trim().slice(0, 80) : ex.label;
    if (label.length < 2) return jsonError('Give the word a name', 422);
    const c = clean(b, ex);
    if (c.error) return jsonError(c.error, 422);
    await execute('UPDATE letter_variables SET label = ?, kind = ?, value = ?, updated_by = ?, updated_at = NOW() WHERE var_key = ?', [label, c.kind, c.value, user.email || String(user.id), b.key]);
    await auditFrom(user, 'letter_word_changed', 'settings', b.key, { label, kind: c.kind });
    return jsonSuccess({ message: 'Saved' });
  } catch (e: any) { return e instanceof Response ? e : jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest) {
  try {
    const user = await writeUser(req);
    if (!user) return jsonError('Insufficient permissions', 403);
    const key = new URL(req.url).searchParams.get('key') || '';
    const r = await execute('DELETE FROM letter_variables WHERE var_key = ?', [key]);
    if (!r.affectedRows) return jsonError('Unknown word', 404);
    await auditFrom(user, 'letter_word_removed', 'settings', key, {});
    // letter texts that still use it will show a gap; say so
    const used = await query<RowDataPacket[]>('SELECT name FROM letter_templates WHERE body LIKE ?', [`%{{${key}}}%`]);
    return jsonSuccess({ message: 'Word removed', still_used_in: used.map(u => u.name) });
  } catch (e: any) { return e instanceof Response ? e : jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
export const PUT = withApiLog(PUT_handler);
export const DELETE = withApiLog(DELETE_handler);
