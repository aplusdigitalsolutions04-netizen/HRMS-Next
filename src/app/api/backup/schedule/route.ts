// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { getSchedule, saveSchedule } from '@/lib/backup-auto';
import { auditFrom } from '@/lib/audit';

// Automatic backup schedule - ADMIN only.
const adminOnly = async (req: NextRequest) => { const u = await getAuthUser(req); return u && u.type === 'admin' && u.role === 'ADMIN' ? u : null; };

async function GET_handler(req: NextRequest) {
  try {
    if (!(await adminOnly(req))) return jsonError('Only the administrator can see backup settings', 403);
    return jsonSuccess(await getSchedule());
  } catch (e: any) { return jsonError(e, 500); }
}
async function PUT_handler(req: NextRequest) {
  try {
    const user = await adminOnly(req);
    if (!user) return jsonError('Only the administrator can change backup settings', 403);
    const b = await req.json().catch(() => ({}));
    const s = await saveSchedule(b);
    await auditFrom(user, 'backup_schedule_changed', 'backup', 'schedule', { on: s.on, frequency: s.frequency, hour: s.hour, keep: s.keep });
    return jsonSuccess(s);
  } catch (e: any) { return jsonError(e, 500); }
}
export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
