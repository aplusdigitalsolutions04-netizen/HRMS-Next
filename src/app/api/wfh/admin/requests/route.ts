// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission, parsePagination } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// WFH requests for HR. By default the ones that wait for HR (or have no manager step, or whose employee has no reporting manager);
// ?scope=all shows every request, each with the stage it is at (with_manager, manager_name).
// The tables are read one by one and put together here (not with JOINs), so a difference in the text rules (collation) between
// the tables of an older and a newer database can never make this page fail or show nothing.
const clean = (v: any) => String(v ?? '').trim();

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

    const reqs = await query<RowDataPacket[]>('SELECT * FROM wfh_requests ORDER BY applied_on DESC LIMIT 3000');
    const ids = [...new Set(reqs.map(r => clean(r.employee_id)).filter(Boolean))];
    const emps = ids.length
      ? await query<RowDataPacket[]>(`SELECT id, full_name, emp_code, manager_id FROM employees WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
      : [];
    const byId = new Map(emps.map(e => [clean(e.id), e]));
    const mgrIds = [...new Set(emps.map(e => clean(e.manager_id)).filter(Boolean))];
    const mgrs = mgrIds.length
      ? await query<RowDataPacket[]>(`SELECT id, full_name FROM employees WHERE id IN (${mgrIds.map(() => '?').join(',')})`, mgrIds)
      : [];
    const mgrName = new Map(mgrs.map(m => [clean(m.id), m.full_name]));
    const steps = await query<RowDataPacket[]>('SELECT workflow_id, step_order, approver_type FROM approval_workflow_steps');
    const stepType = new Map(steps.map(s => [`${clean(s.workflow_id)}:${Number(s.step_order)}`, s.approver_type]));

    const rows = [];
    for (const r of reqs) {
      const e = byId.get(clean(r.employee_id));
      if (!e) continue; // the employee was deleted
      const type = r.workflow_id ? stepType.get(`${clean(r.workflow_id)}:${Number(r.current_step)}`) || null : null;
      const hasManager = !!clean(e.manager_id);
      const pending = clean(r.status).toLowerCase() === 'pending';
      const withManager = pending && type === 'MANAGER' && hasManager;
      // the same rule as before: HR sees what waits for HR, what has no workflow, what is decided, and what has nobody at the manager step
      const forHr = type === 'HR' || !r.workflow_id || !pending || !hasManager;
      if (!all && !forHr) continue;
      rows.push({ ...r, full_name: e.full_name, emp_code: e.emp_code, step_type: type, manager_name: mgrName.get(clean(e.manager_id)) || null, with_manager: withManager });
    }
    return jsonSuccess({ data: rows.slice(offset, offset + perPage), total: rows.length, page, per_page: perPage });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const GET = withApiLog(GET_handler);
