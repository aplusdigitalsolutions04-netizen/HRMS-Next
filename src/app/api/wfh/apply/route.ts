// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, uuidv4, createNotification } from '@/lib/utils';
import { execute } from '@/lib/db';
import { initApproval } from '@/lib/approvalEngine';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.type !== 'employee') return jsonError('Not authenticated as employee', 401);

    const body = await req.json();
    const { start_date, end_date, reason } = body;
    if (!start_date || !end_date || !reason) {
      return jsonError('Missing required fields (start_date, end_date, reason)', 400);
    }

    // Initialize workflow (wfh)
    const { workflowId, startStep } = await initApproval('wfh', String(user.id));
    const requestId = uuidv4();

    await execute(
      'INSERT INTO wfh_requests (id, employee_id, start_date, end_date, reason, status, workflow_id, current_step, applied_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [requestId, user.id, start_date, end_date, reason, 'Pending', workflowId, startStep]
    );

    // Notify manager if any
    if (workflowId && startStep === 1) {
      // Find the manager
      const { query } = await import('@/lib/db');
      const managerRow = await query('SELECT manager_id FROM employees WHERE id=?', [user.id]);
      const managerId = managerRow[0]?.manager_id;
      if (managerId) {
        createNotification(
          `New WFH Request: ${user.name}`,
          `${user.name} has applied for WFH from ${start_date} to ${end_date}.`,
          'wfh_apply',
          String(requestId),
          false,
          String(managerId)
        );
      }
    } else if (workflowId && startStep > 1) {
       // Direct to HR if no manager
       createNotification(
        `New WFH Request (No Manager): ${user.name}`,
        `${user.name} applied for WFH. It needs HR approval.`,
        'wfh_apply',
        String(requestId),
        true,
        null
      );
    }

    return jsonSuccess({ message: 'WFH applied successfully', id: requestId });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
