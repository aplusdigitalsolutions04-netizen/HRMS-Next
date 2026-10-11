// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { generatePayslipsForMonth } from '@/lib/payslip-draft';
import { auditFrom } from '@/lib/audit';

// "Generate Payroll": makes a DRAFT payslip for every active employee with a salary structure who
// does not have one for the month. Nothing is visible to employees or emailed until HR approves.
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);

    const body = await req.json().catch(() => ({}));
    const month = Number(body.month) || new Date().getMonth() + 1;
    const year = Number(body.year) || new Date().getFullYear();

    const { generated, skipped, results } = await generatePayslipsForMonth(month, year, user.email, 'DRAFT');
    await auditFrom(user, 'payslips_generated', 'payslip', `${month}/${year}`, { month, year, generated, skipped, status: 'DRAFT' });
    return jsonSuccess({
      message: `Created ${generated} draft payslip(s) for ${month}/${year}` + (skipped ? `, skipped ${skipped} that already existed` : '') + '. Open Payslip History to check them, then approve.',
      count: generated, skipped, results,
    });
  } catch (e: any) { return jsonError(e, 500); }
}
