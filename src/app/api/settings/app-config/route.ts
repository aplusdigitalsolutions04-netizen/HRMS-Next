// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { FIELDS, GROUPS, getConfig, saveConfig } from '@/lib/app-config';
import { auditFrom } from '@/lib/audit';

// Settings > Rules & Limits: the values the program reads instead of having them written into it (ADMIN only).
// GET gives the fields (with their help text) and the current values; PUT { key: value, ... } saves the ones sent.
const adminOnly = (u: any) => u && u.type === 'admin' && u.role === 'ADMIN';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!adminOnly(user)) return jsonError('Only the administrator can see these settings.', 403);
    return jsonSuccess({ groups: GROUPS, fields: FIELDS.map(({ default: d, ...f }) => ({ ...f, default: d })), values: await getConfig() });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (!adminOnly(user)) return jsonError('Only the administrator can change these settings.', 403);
    const changed = await saveConfig(await req.json());
    await auditFrom(user, 'app_config_changed', 'settings', 'rules_limits', { keys: changed });
    return jsonSuccess({ message: changed.length ? 'Saved' : 'Nothing to save', changed });
  } catch (e: any) { return jsonError(e?.message || e, 422); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
