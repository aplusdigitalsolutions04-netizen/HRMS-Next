// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { ensureHolidaySchema } from '@/lib/holidays';
import { auditFrom } from '@/lib/audit';

// Fixed-date holidays that fall on the same day every year.
const FIXED = [
  ['01-26', 'Republic Day'],
  ['08-15', 'Independence Day'],
  ['10-02', 'Gandhi Jayanti'],
  ['12-25', 'Christmas Day'],
];

// Central Government gazetted holidays for years whose festival dates are known.
// Festival dates move every year (and Islamic ones can shift by a day after moon
// sighting), so review and edit them in the calendar if your office differs.
const GAZETTED: Record<number, string[][]> = {
  2026: [
    ['01-26', 'Republic Day'], ['03-04', 'Holi'], ['03-21', 'Id-ul-Fitr'], ['03-26', 'Ram Navami'],
    ['03-31', 'Mahavir Jayanti'], ['04-03', 'Good Friday'], ['05-01', 'Buddha Purnima'],
    ['05-27', 'Id-ul-Zuha (Bakrid)'], ['06-26', 'Muharram'], ['08-15', 'Independence Day'],
    ['08-26', 'Milad-un-Nabi'], ['09-04', 'Janmashtami'], ['10-02', 'Gandhi Jayanti'],
    ['10-20', 'Dussehra'], ['11-08', 'Diwali (Deepavali)'], ['11-24', 'Guru Nanak Jayanti'],
    ['12-25', 'Christmas Day'],
  ],
};

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    await ensureHolidaySchema();
    const year = parseInt(new URL(req.url).searchParams.get('year') || '') || new Date().getFullYear();
    const rows = await query(
      "SELECT id, DATE_FORMAT(holiday_date, '%Y-%m-%d') AS holiday_date, name, holiday_type, in_sandwich FROM holidays WHERE YEAR(holiday_date) = ? ORDER BY holiday_date",
      [year]
    );
    return jsonSuccess({ year, holidays: rows });
  } catch (e: any) { return jsonError(e, 500); }
}

// Body: { date, name, holiday_type?, in_sandwich? (default true) }  -> add one holiday
//       { id, in_sandwich }                    -> (PATCH) change whether a holiday counts in sandwich leave
//       { preset: 'government', year }  -> add the government holiday list for that year
async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    await ensureHolidaySchema();
    const body = await req.json();

    if (body.preset === 'government') {
      const year = parseInt(body.year) || new Date().getFullYear();
      const full = GAZETTED[year];
      const list = full || FIXED;
      let added = 0;
      for (const [md, name] of list) {
        const r = await execute('INSERT IGNORE INTO holidays (holiday_date, name, holiday_type, created_by) VALUES (?,?,?,?)', [`${year}-${md}`, name, 'Government', user.email]);
        added += r.affectedRows;
      }
      const note = full ? '' : ' Festival dates for this year are not built in, so add Holi, Diwali, Eid etc. by hand.';
      return jsonSuccess({ message: `Added ${added} government holiday(s) for ${year}.${note}` });
    }

    const date = String(body.date || '').slice(0, 10);
    const name = String(body.name || '').trim().slice(0, 150);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) return jsonError('Date and holiday name are required', 422);
    const type = ['Government', 'Company'].includes(body.holiday_type) ? body.holiday_type : 'Government';
    const existing = await query('SELECT id FROM holidays WHERE holiday_date = ?', [date]);
    if (existing.length > 0) return jsonError('A holiday already exists on this date', 409);
    const inSandwich = body.in_sandwich === false || body.in_sandwich === 0 || body.in_sandwich === '0' ? 0 : 1;
    await execute('INSERT INTO holidays (holiday_date, name, holiday_type, in_sandwich, created_by) VALUES (?,?,?,?,?)', [date, name, type, inSandwich, user.email]);
    await auditFrom(user, 'holiday_added', 'holiday', date, { name, type, in_sandwich: !!inSandwich });
    return jsonSuccess({ message: 'Holiday added' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PATCH_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    await ensureHolidaySchema();
    const b = await req.json().catch(() => ({}));
    const id = parseInt(b.id);
    if (!id) return jsonError('id is required', 422);
    const v = b.in_sandwich === false || b.in_sandwich === 0 || b.in_sandwich === '0' ? 0 : 1;
    const r: any = await execute('UPDATE holidays SET in_sandwich = ? WHERE id = ?', [v, id]);
    if (!r.affectedRows && !r.changedRows) { const e = await query('SELECT id FROM holidays WHERE id = ?', [id]); if (!e.length) return jsonError('Holiday not found', 404); }
    await auditFrom(user, 'holiday_sandwich_changed', 'holiday', String(id), { in_sandwich: !!v });
    return jsonSuccess({ message: v ? 'Counts in sandwich leave' : 'Does not count in sandwich leave' });
  } catch (e: any) { return jsonError(e, 500); }
}

async function DELETE_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'upload_attendance')) return jsonError('Insufficient permissions', 403);
    await ensureHolidaySchema();
    const id = parseInt(new URL(req.url).searchParams.get('id') || '');
    if (!id) return jsonError('id is required', 422);
    const was = await query('SELECT name, DATE_FORMAT(holiday_date, \'%Y-%m-%d\') AS d FROM holidays WHERE id = ?', [id]);
    await execute('DELETE FROM holidays WHERE id = ?', [id]);
    await auditFrom(user, 'holiday_removed', 'holiday', String(id), was[0] || null);
    return jsonSuccess({ message: 'Holiday removed' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
export const PATCH = withApiLog(PATCH_handler);
export const DELETE = withApiLog(DELETE_handler);
