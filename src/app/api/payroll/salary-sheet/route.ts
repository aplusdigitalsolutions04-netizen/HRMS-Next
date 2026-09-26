// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { computeSalarySheet, saveAdjustment, getMonthDaysMode } from '@/lib/salary-sheet';

function period(searchParams: URLSearchParams) {
  const now = new Date();
  const month = parseInt(searchParams.get('month') || '') || now.getMonth() + 1;
  const year = parseInt(searchParams.get('year') || '') || now.getFullYear();
  return { month, year };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_payroll')) return jsonError('Insufficient permissions', 403);
    const { month, year } = period(new URL(req.url).searchParams);
    if (month < 1 || month > 12) return jsonError('Invalid month', 422);
    const rows = await computeSalarySheet(month, year);
    return jsonSuccess({ month, year, month_days_mode: await getMonthDaysMode(), rows });
  } catch (e: any) { return jsonError(e, 500); }
}

// Body: { emp_code, month, year, incentive?, el_days?, variable_pay?, ew_days? } (each number, or null to clear)
// null clears the override for that month.
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);

    const body = await req.json();
    const empCode = String(body.emp_code || '').trim();
    const month = parseInt(body.month);
    const year = parseInt(body.year);
    if (!empCode || !(month >= 1 && month <= 12) || !year) return jsonError('emp_code, month and year are required', 422);

    const patch: Record<string, number | null> = {};
    for (const key of ['incentive', 'el_days', 'variable_pay', 'ew_days']) {
      if (!(key in body)) continue;
      if (body[key] === null || body[key] === '') { patch[key] = null; continue; }
      const v = Number(body[key]);
      if (isNaN(v) || v < 0) return jsonError(`${key} must be a non-negative number`, 422);
      patch[key] = v;
    }
    await saveAdjustment(empCode, month, year, patch, user.email);
    const [row] = await computeSalarySheet(month, year, empCode);
    return jsonSuccess({ message: 'Saved', row });
  } catch (e: any) { return jsonError(e, 500); }
}
