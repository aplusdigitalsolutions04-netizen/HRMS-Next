// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated', 401);

    // Find all WFH requests where the current step is MANAGER, and the requester's manager is the current user.
    const rows = await query<RowDataPacket[]>(`
      SELECT lr.*, e.full_name, e.emp_code 
      FROM wfh_requests lr 
      JOIN employees e ON lr.employee_id = e.id
      JOIN approval_workflow_steps s ON lr.workflow_id = s.workflow_id AND lr.current_step = s.step_order
      WHERE s.approver_type = 'MANAGER' AND e.manager_id = ? AND lr.status = 'Pending'
      ORDER BY lr.applied_on DESC
    `, [user.id]);

    return jsonSuccess(rows);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
