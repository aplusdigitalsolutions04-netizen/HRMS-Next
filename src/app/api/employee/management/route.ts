// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { employeeCodes, inList } from '@/lib/status-master';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    // The working workforce: statuses switched on for "Working employee" in Settings > Status Master.
    const working = inList(await employeeCodes('is_working'));
    const rows = await query<RowDataPacket[]>(`SELECT id, emp_code, full_name, email_id, mobile_no, designation, status, profile_photo, created_on FROM employees WHERE status IN ${working.sql} AND is_deleted = 0 ORDER BY created_on DESC`, working.params);
    return jsonSuccess(rows.map(r => ({ ...r, department: '' })));
  } catch (e: any) { return jsonError(e, 500); }
}
