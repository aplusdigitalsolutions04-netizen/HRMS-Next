// @ts-nocheck
// Generic, reusable multi-step approval engine.
// Any request type (leave, wfh, expense, ...) can drive its workflow through
// this module instead of hardcoding "who approves this" per module.
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { uuidv4, checkPermission } from './utils';
import type { AuthUser } from './auth';

export interface WorkflowStep extends RowDataPacket {
  id: string;
  workflow_id: string;
  step_order: number;
  approver_type: 'MANAGER' | 'HR' | 'SPECIFIC_USER';
  specific_user_id: string | null;
  label: string | null;
}

export async function getWorkflowSteps(moduleKey: string): Promise<{ workflowId: string; steps: WorkflowStep[] } | null> {
  const wf = await query<RowDataPacket[]>('SELECT * FROM approval_workflows WHERE module_key=? AND is_active=1', [moduleKey]);
  if (wf.length === 0) return null;
  const steps = await query<WorkflowStep[]>('SELECT * FROM approval_workflow_steps WHERE workflow_id=? ORDER BY step_order ASC', [wf[0].id]);
  if (steps.length === 0) return null;
  return { workflowId: wf[0].id, steps };
}

/**
 * Resolve the first actionable step for a brand-new request, skipping steps
 * that can't apply (e.g. a MANAGER step when the employee has no manager).
 */
export async function initApproval(moduleKey: string, employeeId: string): Promise<{ workflowId: string | null; startStep: number }> {
  const wfData = await getWorkflowSteps(moduleKey);
  if (!wfData) return { workflowId: null, startStep: 1 };

  const emp = await query<RowDataPacket[]>('SELECT manager_id FROM employees WHERE id=?', [employeeId]);
  const managerId = emp[0]?.manager_id || null;

  let startStep = wfData.steps[0].step_order;
  for (const step of wfData.steps) {
    if (step.approver_type === 'MANAGER' && !managerId) {
      startStep = step.step_order + 1; // no manager assigned - skip straight to the next step
      continue;
    }
    startStep = step.step_order;
    break;
  }
  const maxStep = wfData.steps[wfData.steps.length - 1].step_order;
  if (startStep > maxStep) startStep = maxStep;
  return { workflowId: wfData.workflowId, startStep };
}

export async function getStep(workflowId: string, stepOrder: number): Promise<WorkflowStep | null> {
  const rows = await query<WorkflowStep[]>('SELECT * FROM approval_workflow_steps WHERE workflow_id=? AND step_order=?', [workflowId, stepOrder]);
  return rows[0] || null;
}

export async function getMaxStep(workflowId: string): Promise<number> {
  const rows = await query<RowDataPacket[]>('SELECT MAX(step_order) as m FROM approval_workflow_steps WHERE workflow_id=?', [workflowId]);
  return rows[0]?.m || 1;
}

/**
 * Can this authenticated user act (approve/reject) on the given step for the
 * given employee's request?
 */
export async function canActOnStep(step: WorkflowStep | null, user: AuthUser, employeeId: string, hrPermissionKey: string = 'approve_leave'): Promise<boolean> {
  if (!step) return false;
  if (step.approver_type === 'MANAGER') {
    if (user.type !== 'employee') return false;
    const emp = await query<RowDataPacket[]>('SELECT manager_id FROM employees WHERE id=?', [employeeId]);
    return !!emp[0]?.manager_id && emp[0].manager_id === user.id;
  }
  if (step.approver_type === 'HR') {
    return user.type === 'admin' && checkPermission(user, hrPermissionKey);
  }
  if (step.approver_type === 'SPECIFIC_USER') {
    return user.id === step.specific_user_id;
  }
  return false;
}

export async function recordAction(
  requestType: string,
  requestId: string | number,
  stepOrder: number,
  user: AuthUser,
  action: 'APPROVED' | 'REJECTED',
  remarks?: string
): Promise<void> {
  await execute(
    'INSERT INTO approval_actions (id, request_type, request_id, step_order, actor_type, actor_id, actor_name, action, remarks, acted_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())',
    [uuidv4(), requestType, String(requestId), stepOrder, user.type, user.id, user.name || user.email, action, remarks || null]
  );
}

export async function getActionHistory(requestType: string, requestId: string | number) {
  return query<RowDataPacket[]>(
    'SELECT * FROM approval_actions WHERE request_type=? AND request_id=? ORDER BY acted_at ASC',
    [requestType, String(requestId)]
  );
}
