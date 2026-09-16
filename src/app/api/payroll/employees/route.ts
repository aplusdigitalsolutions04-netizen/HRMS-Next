// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const rows = await query<RowDataPacket[]>(
      `SELECT e.id, e.emp_code, e.full_name, e.designation, ss.id as salary_structure_id FROM employees e LEFT JOIN salary_structures ss ON e.emp_code=ss.emp_code WHERE e.is_deleted = 0 ORDER BY e.full_name`
    );
    return jsonSuccess(rows.map(r => ({ ...r, department: '' })));
  } catch (e: any) { return jsonError(e, 500); }
}
