// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, uuidv4, parsePagination } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { auditFrom } from '@/lib/audit';

export const ASSET_STATUSES = ['Available', 'Assigned', 'In repair', 'Lost', 'Retired'];

// List company assets with who holds each one now.
//   ?status= &type= &search=(tag / name / serial / holder) &page= &per_page=
//   ?employee_id=<id>  -> that employee's assignments (current and past) instead
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !(checkPermission(user, 'view_assets') || checkPermission(user, 'manage_assets'))) return jsonError('Insufficient permissions', 403);
    const sp = new URL(req.url).searchParams;

    const empId = sp.get('employee_id');
    if (empId) {
      const rows = await query<RowDataPacket[]>(
        `SELECT s.id AS assignment_id, a.id AS asset_id, a.asset_tag, a.asset_type, a.name, a.serial_no,
                DATE_FORMAT(s.assigned_on, '%Y-%m-%d') AS assigned_on, DATE_FORMAT(s.returned_on, '%Y-%m-%d') AS returned_on, s.condition_out, s.condition_in, s.notes
         FROM asset_assignments s JOIN assets a ON a.id = s.asset_id WHERE s.employee_id = ? ORDER BY (s.returned_on IS NULL) DESC, s.assigned_on DESC`, [empId]);
      return jsonSuccess({ assignments: rows });
    }

    const { page, perPage, offset } = parsePagination(sp, 20);
    let where = 'WHERE 1=1'; const params: any[] = [];
    const status = sp.get('status') || '', type = sp.get('type') || '', search = (sp.get('search') || '').trim();
    if (status) { where += ' AND a.status = ?'; params.push(status); }
    if (type) { where += ' AND a.asset_type = ?'; params.push(type); }
    if (search) { where += ' AND (a.asset_tag LIKE ? OR a.name LIKE ? OR a.serial_no LIKE ? OR e.full_name LIKE ? OR e.emp_code LIKE ?)'; const q = `%${search}%`; params.push(q, q, q, q, q); }
    const from = `FROM assets a
      LEFT JOIN asset_assignments s ON s.asset_id = a.id AND s.returned_on IS NULL
      LEFT JOIN employees e ON e.id = s.employee_id`;
    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${from} ${where}`, params);
    const rows = await query<RowDataPacket[]>(
      `SELECT a.id, a.asset_tag, a.asset_type, a.name, a.serial_no, a.notes, a.status, DATE_FORMAT(s.assigned_on, '%Y-%m-%d') AS assigned_on,
              e.id AS holder_id, e.full_name AS holder_name, e.emp_code AS holder_code
       ${from} ${where} ORDER BY a.asset_tag LIMIT ${perPage} OFFSET ${offset}`, params);
    const counts = await query<RowDataPacket[]>('SELECT status, COUNT(*) AS n FROM assets GROUP BY status');
    // the type list comes from the Asset Types master (types already used by older assets are copied in first)
    await execute("INSERT IGNORE INTO asset_types (name, is_active) SELECT DISTINCT asset_type, 1 FROM assets WHERE asset_type IS NOT NULL AND asset_type <> ''");
    const types = await query<RowDataPacket[]>('SELECT name, is_active FROM asset_types ORDER BY name');
    const nameRows = await query<RowDataPacket[]>('SELECT DISTINCT name FROM assets ORDER BY name LIMIT 300');
    const by: Record<string, number> = {};
    counts.forEach(c => { by[c.status] = Number(c.n); });
    return jsonSuccess({ assets: rows, total: cnt[0].n, page, per_page: perPage, counts: by, types: types.filter(t => Number(t.is_active) === 1).map(t => t.name), all_types: types.map(t => t.name), names: nameRows.map(n => n.name) });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'manage_assets')) return jsonError('Insufficient permissions', 403);
    const b = await req.json();
    const tag = String(b.asset_tag || '').trim().slice(0, 60), name = String(b.name || '').trim().slice(0, 150);
    if (!tag || !name) return jsonError('Asset tag and name are required', 422);
    const typeRow = (await query<RowDataPacket[]>('SELECT name FROM asset_types WHERE LOWER(name) = LOWER(?) AND is_active = 1', [String(b.asset_type || '').trim()]))[0];
    if (!typeRow) return jsonError('Pick an asset type from the list (add new ones in System Masters > Asset Types)', 422);
    const type = typeRow.name;
    const dup = await query<RowDataPacket[]>('SELECT id FROM assets WHERE asset_tag = ?', [tag]);
    if (dup.length > 0) return jsonError('An asset with this tag already exists', 409);
    const id = uuidv4();
    await execute('INSERT INTO assets (id, asset_tag, asset_type, name, serial_no, notes, status, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [id, tag, type, name, String(b.serial_no || '').trim().slice(0, 120) || null, String(b.notes || '').trim() || null, 'Available', user.email]);
    await auditFrom(user, 'asset_created', 'asset', id, { asset_tag: tag, name });
    return jsonSuccess({ id, message: 'Asset added' }, 201);
  } catch (e: any) { return jsonError(e, 500); }
}
