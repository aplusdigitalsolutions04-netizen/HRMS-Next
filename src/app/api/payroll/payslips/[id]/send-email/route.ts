// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { sendPayslipEmail } from '@/lib/payslip-mail';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);

    const { id } = await params;
    const r = await sendPayslipEmail(id, { id: user.id, type: user.type });
    if (!r.ok) return jsonError(r.message, r.status || 500);
    return jsonSuccess({ message: r.message });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
