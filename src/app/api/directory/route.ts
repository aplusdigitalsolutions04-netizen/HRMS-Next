// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { employeeCodes, inList } from '@/lib/status-master';

// Employee directory: who works here, their job, where and how to reach them at work. Open to every signed-in person.
// Only work details are given: no personal mobile number, personal email, address, date of birth, bank or salary.
// GET ?search= &designation= &page= &per_page=
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    const sp = new URL(req.url).searchParams;
    const { page, perPage, offset } = parsePagination(sp, 12, 100);
    const working = inList(await employeeCodes('is_working'));
    let where = `WHERE e.is_deleted = 0 AND e.status IN ${working.sql}`; const params: any[] = [...working.params];
    const search = (sp.get('search') || '').trim(), designation = (sp.get('designation') || '').trim();
    if (search) { where += ' AND (e.full_name LIKE ? OR e.designation LIKE ? OR e.official_email LIKE ? OR e.location LIKE ?)'; const q = `%${search}%`; params.push(q, q, q, q); }
    if (designation) { where += ' AND e.designation = ?'; params.push(designation); }

    const total = (await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM employees e ${where}`, params))[0].n;
    const rows = await query<RowDataPacket[]>(
      `SELECT e.id, e.full_name, e.emp_code, e.designation, e.location, e.official_email, e.official_no, e.date_of_joining, m.full_name AS manager_name
       FROM employees e LEFT JOIN employees m ON m.id = e.manager_id ${where} ORDER BY e.full_name ASC LIMIT ${perPage} OFFSET ${offset}`, params);
    const desig = await query<RowDataPacket[]>(
      `SELECT DISTINCT e.designation FROM employees e WHERE e.is_deleted = 0 AND e.status IN ${working.sql} AND e.designation IS NOT NULL AND e.designation <> '' ORDER BY e.designation`, working.params);
    return jsonSuccess({ people: rows, total, page, per_page: perPage, designations: desig.map(d => d.designation) });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
