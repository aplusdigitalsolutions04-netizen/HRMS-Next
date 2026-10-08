// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getStatuses } from '@/lib/status-master';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const counts = await query<RowDataPacket[]>('SELECT status, COUNT(*) as cnt FROM employees WHERE is_deleted = 0 GROUP BY status');
    const total = counts.reduce((s: number, r: any) => s + r.cnt, 0);
    // One count per status in Settings > Status Master (so new statuses show up by themselves).
    // active / pending / dropped are kept for pages that still read them.
    const by_status: Record<string, number> = {};
    for (const st of await getStatuses('employee', true)) by_status[st.code] = counts.find((r: any) => r.status === st.code)?.cnt || 0;
    const active = by_status['active'] || 0;
    const pending = by_status['pending'] || 0;
    const dropped = by_status['dropped'] || 0;
    const newThis = await query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM employees WHERE is_deleted = 0 AND created_on >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    const newThisMonth = newThis[0].cnt;
    const prev = await query<RowDataPacket[]>("SELECT COUNT(*) as cnt FROM employees WHERE is_deleted = 0 AND created_on >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND created_on < DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    const prevCount = prev[0].cnt || 1;
    const growthPct = ((newThisMonth - prevCount) / prevCount * 100).toFixed(1);
    return jsonSuccess({ total, by_status, active, pending, dropped, new_this_month: newThisMonth, growth_pct: growthPct });
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
