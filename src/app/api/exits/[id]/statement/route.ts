// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, checkPermission } from '@/lib/utils';
import { loadExit, parseJson } from '@/lib/exits';
import { fnfNet } from '@/lib/fnf';
import { getConfig } from '@/lib/app-config';
import { renderStatementPdf, longDate } from '@/lib/letters';

// The full and final statement as a PDF (HR).
async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const { id } = await params;
    const x = await loadExit(id);
    if (!x) return jsonError('Exit not found', 404);
    const lines = parseJson(x.fnf_json, []);
    const today = new Date();
    const pdf = await renderStatementPdf({
      title: 'FULL AND FINAL SETTLEMENT', ref: `${(await getConfig()).fnf_prefix}-${String(x.id).padStart(4, '0')}`, date: longDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`),
      rows: [['Employee', `${x.full_name} (${x.emp_code})`], ['Designation', x.designation || '-'], ['Date of joining', longDate(x.joined) || '-'], ['Resignation date', longDate(x.resignation)], ['Last working day', longDate(x.lwd)], ['Reason', x.reason || '-']],
      lines, net: fnfNet(lines),
    });
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="FNF_${String(x.emp_code).replace(/[^\w.-]/g, '_')}.pdf"` } });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
