// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { getBreakup, saveBreakup, cleanBreakup, getBreakupColumns, saveBreakupColumns, cleanColumns } from '@/lib/letters';
import { auditFrom } from '@/lib/audit';

// The salary breakup of the offer, appointment and appraisal letters: the components (Basic, HRA ...) and the percent of the fixed salary each one takes.
// GET gives the list; PUT { rows: [{ name, percent }] } saves it (the percents must add up to 100).
async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    return jsonSuccess({ rows: await getBreakup(), columns: await getBreakupColumns() });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json().catch(() => ({}));
    const columns = cleanColumns(b.columns);
    const c = cleanBreakup(b.rows, columns);
    if (!c.rows) return jsonError(c.error, 422);
    await saveBreakupColumns(columns);
    await saveBreakup(c.rows);
    await auditFrom(user, 'letter_breakup_changed', 'settings', 'letter_breakup', { rows: c.rows, columns });
    return jsonSuccess({ message: 'Salary breakup saved', rows: c.rows, columns });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
