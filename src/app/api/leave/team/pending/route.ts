// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Leave requests from this manager's direct reports that are waiting on
// their approval right now.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'employee') return jsonSuccess({ requests: [] }); // only employees can be managers in this model

    const rows = await query<RowDataPacket[]>(
      `SELECT lr.*, e.full_name as emp_name, e.emp_code, e.profile_photo
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       JOIN approval_workflow_steps s ON s.workflow_id = lr.workflow_id AND s.step_order = lr.current_step
       WHERE e.manager_id = ? AND s.approver_type = 'MANAGER' AND lr.status = 'Pending'
       ORDER BY lr.applied_on DESC`,
      [user.id]
    );
    return jsonSuccess({ requests: rows });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
