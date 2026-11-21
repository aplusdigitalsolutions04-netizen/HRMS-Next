// @ts-nocheck
import { NextRequest } from 'next/server';
import { withApiLog } from '@/lib/api-log';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { logApi, who, clientIp } from '@/lib/api-log';
import { getConfig } from '@/lib/app-config';

// Problems seen by the browser itself, before or without an answer from the server: a call that could not be sent (network down,
// server not reachable) or a script error. The page reports them here so they appear in the API Logs too.
const recent = new Map<string, number[]>();

async function POST_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);

    // a limited number of reports a minute from one person (Settings > Rules & Limits)
    const key = String(user.id);
    const now = Date.now();
    const list = (recent.get(key) || []).filter(t => now - t < 60_000);
    if (list.length >= (await getConfig()).client_log_per_minute) return jsonSuccess({ ok: true });
    list.push(now); recent.set(key, list);

    const b = await req.json().catch(() => ({}));
    const items = Array.isArray(b.items) ? b.items.slice(0, 20) : [b];
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      logApi({
        source: 'browser', method: String(it.method || '').toUpperCase().slice(0, 8) || undefined, path: String(it.url || it.page || '').split('?')[0].slice(0, 300),
        query_string: String(it.url || '').split('?')[1] || undefined, status: 0, ...who(req), ip: clientIp(req), user_agent: req.headers.get('user-agent') || '',
        error_message: String(it.message || 'Browser error').slice(0, 1000), error_detail: it.detail ? String(it.detail).slice(0, 3000) : undefined,
        request_body: it.page ? `Page: ${String(it.page).slice(0, 200)}` : undefined,
      });
    }
    return jsonSuccess({ ok: true });
  } catch (e: any) { return jsonError(e, 500); }
}

export const POST = withApiLog(POST_handler);
