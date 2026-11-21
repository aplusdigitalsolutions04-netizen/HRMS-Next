// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { sendPayslipEmail, previewPayslipEmail } from '@/lib/payslip-mail';

// The mail as it will go out (subject, text, attached file name), so HR can read and edit it before sending.
async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const r = await previewPayslipEmail(id);
    if (!r.ok) return jsonError(r.message || 'Not found', r.status || 500);
    return jsonSuccess(r);
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'generate_payslips')) return jsonError('Insufficient permissions', 403);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const r = await sendPayslipEmail(id, { id: user.id, type: user.type }, { subject: String(body.subject || '').slice(0, 300), html: String(body.html || '').slice(0, 200000), ...(body.cc !== undefined ? { cc: String(body.cc).slice(0, 1000) } : {}), ...(body.bcc !== undefined ? { bcc: String(body.bcc).slice(0, 1000) } : {}) });
    if (!r.ok) return jsonError(r.message, r.status || 500);
    return jsonSuccess({ message: r.message });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
