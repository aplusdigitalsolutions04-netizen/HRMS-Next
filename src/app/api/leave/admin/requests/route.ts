// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_leave')) return jsonError('Insufficient permissions', 403);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || '';
    const { page, perPage, offset } = parsePagination(searchParams, 20);
    
    // Hide requests still pending at the reporting-manager step - HR should
    // only see them once the manager has approved (or if there's no
    // workflow/manager step involved at all).
    let where = `WHERE NOT EXISTS (
      SELECT 1 FROM approval_workflow_steps s
      WHERE s.workflow_id = lr.workflow_id AND s.step_order = lr.current_step
        AND s.approver_type = 'MANAGER' AND lr.status = 'Pending'
    )`;
    const params = [];
    if (status) { where += ' AND lr.status=?'; params.push(status); }

    const cnt = await query<RowDataPacket[]>(`SELECT COUNT(*) as cnt FROM leave_requests lr ${where}`, params);
    const rows = await query<RowDataPacket[]>(`SELECT lr.*, e.full_name as emp_name, e.emp_code, e.profile_photo FROM leave_requests lr LEFT JOIN employees e ON lr.employee_id=e.id ${where} ORDER BY lr.applied_on DESC LIMIT ${perPage} OFFSET ${offset}`, params);
    return jsonSuccess({ requests: rows, total: cnt[0].cnt, page, per_page: perPage });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
