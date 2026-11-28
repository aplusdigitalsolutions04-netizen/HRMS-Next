// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// WFH requests for HR. By default the ones that wait for HR (or have no manager step, or whose employee has no reporting manager);
// ?scope=all shows every request, each with the stage it is at (with_manager, manager_name).
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'approve_wfh') && !checkPermission(user, 'view_wfh')) {
      return jsonError('Insufficient permissions', 403);
    }

    const { searchParams } = new URL(req.url);
    const { page, perPage, offset } = parsePagination(searchParams);
    const all = searchParams.get('scope') === 'all';
    const where = all
      ? '1=1'
      : "(s.approver_type = 'HR' OR lr.workflow_id IS NULL OR lr.status != 'Pending' OR COALESCE(e.manager_id, '') = '')";

    const countRows = await query<RowDataPacket[]>(`
      SELECT COUNT(*) as cnt
      FROM wfh_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN approval_workflow_steps s ON lr.workflow_id = s.workflow_id AND lr.current_step = s.step_order
      WHERE ${where}
    `);
    const total = countRows[0].cnt;

    const rows = await query<RowDataPacket[]>(`
      SELECT lr.*, e.full_name, e.emp_code, s.approver_type AS step_type, m.full_name AS manager_name,
             (lr.status = 'Pending' AND s.approver_type = 'MANAGER' AND COALESCE(e.manager_id, '') <> '') AS with_manager
      FROM wfh_requests lr
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN employees m ON m.id = e.manager_id
      LEFT JOIN approval_workflow_steps s ON lr.workflow_id = s.workflow_id AND lr.current_step = s.step_order
      WHERE ${where}
      ORDER BY lr.applied_on DESC
      LIMIT ? OFFSET ?
    `, [perPage, offset]);

    return jsonSuccess({ data: rows.map(r => ({ ...r, with_manager: !!Number(r.with_manager) })), total, page, per_page: perPage });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const GET = withApiLog(GET_handler);
