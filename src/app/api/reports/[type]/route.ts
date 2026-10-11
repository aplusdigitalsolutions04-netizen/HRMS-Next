// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { REPORT_TYPES, buildReport, validRange, reportToXlsx, reportToPdf } from '@/lib/reports';
import { auditFrom } from '@/lib/audit';

// GET /api/reports/<attendance|leave|headcount|attrition>?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|xlsx|pdf
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_reports')) return jsonError('Insufficient permissions', 403);

    const { type } = await params;
    if (!REPORT_TYPES[type]) return jsonError('Unknown report', 404);
    const sp = new URL(req.url).searchParams;
    const from = sp.get('from') || '', to = sp.get('to') || '';
    const bad = validRange(from, to);
    if (bad) return jsonError(bad, 422);
    const format = (sp.get('format') || 'json').toLowerCase();

    const report = await buildReport(type, from, to);
    if (format === 'xlsx' || format === 'pdf') await auditFrom(user, 'report_exported', 'report', type, { from, to, format, rows: report.rows.length });

    const name = `${type}-report_${from}_to_${to}`;
    if (format === 'xlsx') {
      return new Response(new Uint8Array(reportToXlsx(report)), { headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}.xlsx"`,
      } });
    }
    if (format === 'pdf') {
      const co = await query<RowDataPacket[]>('SELECT company_name FROM company_settings LIMIT 1');
      return new Response(new Uint8Array(await reportToPdf(report, co[0]?.company_name || '')), { headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}.pdf"`,
      } });
    }
    return jsonSuccess(report);
  } catch (e: any) {
    console.error('[reports] failed:', e?.message || e);
    return jsonError(e, 500);
  }
}
