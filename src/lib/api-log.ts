// @ts-nocheck
import { NextResponse } from 'next/server';
import { query, execute } from './db';
import { decodeToken } from './auth';
import { friendlyError, cleanAnswer } from './friendly-error';

// API log: every call to /api is written to the api_logs table (who, what, status, how long, the error if any), so an
// administrator can look at it in the API Logs page. Calls that never reach a route (refused because the login token is missing
// or expired) and failures seen by the browser before the call is made are saved too.
// Secrets (passwords, tokens ...) are never stored, and a technical error (database or code message) is never shown to the user:
// the user gets a plain sentence with a reference number, and the real error is kept only in this log.

export interface ApiLogEntry {
  source: 'server' | 'proxy' | 'browser';
  method?: string; path?: string; query_string?: string; status?: number; duration_ms?: number;
  user_type?: string; user_email?: string; user_id?: string; ip?: string; user_agent?: string;
  request_body?: string; error_message?: string; error_detail?: string; ref?: string;
}

const g = globalThis as any;

export function shortRef(): string {
  return Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-4);
}

// ---- settings (Settings of the API Logs page), read at most every 30 seconds ----
let settingsCache: { at: number; retentionDays: number; logGets: boolean } | null = null;
export async function getApiLogSettings(): Promise<{ retentionDays: number; logGets: boolean }> {
  if (settingsCache && Date.now() - settingsCache.at < 30_000) return settingsCache;
  let retentionDays = 30, logGets = true;
  try {
    const rows = await query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('api_log_retention_days', 'api_log_get_success')");
    for (const r of rows) {
      if (r.setting_key === 'api_log_retention_days') { const n = parseInt(r.setting_value); if (n >= 0 && n <= 3650) retentionDays = n; }
      if (r.setting_key === 'api_log_get_success') logGets = r.setting_value !== '0';
    }
  } catch { /* defaults */ }
  settingsCache = { at: Date.now(), retentionDays, logGets };
  return settingsCache;
}
export function clearApiLogSettingsCache() { settingsCache = null; }

// ---- keeping secrets out of the log ----
const SECRET_KEY = /pass|pwd|token|secret|otp|authorization|api[_-]?key|refresh|credential|cvv/i;
const clip = (s: string) => (s.length > 200 ? `[${s.length} characters]` : s);
function scrub(v: any, depth = 0): any {
  if (v == null) return v;
  if (typeof v === 'string') return clip(v);
  if (typeof v !== 'object') return v;
  if (depth > 4) return '[...]';
  if (Array.isArray(v)) return v.slice(0, 20).map(x => scrub(x, depth + 1));
  const out: any = {};
  for (const [k, val] of Object.entries(v)) out[k] = SECRET_KEY.test(k) ? '[hidden]' : scrub(val, depth + 1);
  return out;
}
function bodyPreview(text: string, contentType: string): string {
  if (!text) return '';
  try {
    if (contentType.includes('application/json')) return JSON.stringify(scrub(JSON.parse(text))).slice(0, 3000);
    if (contentType.includes('application/x-www-form-urlencoded')) return JSON.stringify(scrub(Object.fromEntries(new URLSearchParams(text)))).slice(0, 3000);
  } catch { /* not readable as that type */ }
  return `[${text.length} characters]`;
}

// ---- turning a technical error into a plain sentence: see friendly-error.js ----

// ---- writing the log (collected and saved in groups, so a request never waits for the database) ----
const COLS = ['ref', 'source', 'method', 'path', 'query_string', 'status', 'duration_ms', 'user_type', 'user_email', 'user_id', 'ip', 'user_agent', 'request_body', 'error_message', 'error_detail'];
const cut = (v: any, n: number) => (v == null ? null : String(v).slice(0, n));

export function logApi(e: ApiLogEntry) {
  const queue: ApiLogEntry[] = (g.__apiLogQueue ||= []);
  if (queue.length >= 2000) queue.shift();
  queue.push(e);
  if (!g.__apiLogTimer) g.__apiLogTimer = setTimeout(flush, 1500);
}

async function flush() {
  g.__apiLogTimer = null;
  const queue: ApiLogEntry[] = g.__apiLogQueue || [];
  g.__apiLogQueue = [];
  for (let i = 0; i < queue.length; i += 100) {
    const part = queue.slice(i, i + 100);
    try {
      await execute(
        `INSERT INTO api_logs (${COLS.join(', ')}) VALUES ${part.map(() => `(${COLS.map(() => '?').join(',')})`).join(',')}`,
        part.flatMap(e => [cut(e.ref, 12), e.source, cut(e.method, 8), cut(e.path, 300), cut(e.query_string, 500), e.status ?? null, e.duration_ms ?? null,
          cut(e.user_type, 20), cut(e.user_email, 150), cut(e.user_id, 40), cut(e.ip, 64), cut(e.user_agent, 250), cut(e.request_body, 3000), cut(e.error_message, 3000), cut(e.error_detail, 3000)])
      );
    } catch (err: any) {
      if (!g.__apiLogWarned) { g.__apiLogWarned = true; console.error('[api-log] could not save the log:', err?.message); }
    }
  }
}

export function who(req: Request): { user_type?: string; user_email?: string; user_id?: string } {
  const a = req.headers.get('authorization') || '';
  if (!a.startsWith('Bearer ')) return {};
  const p: any = decodeToken(a.slice(7));
  return p ? { user_type: p.type, user_email: p.email, user_id: p.sub != null ? String(p.sub) : undefined } : {};
}
export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';

// ---- the wrapper every route handler goes through ----
const SKIP = /^\/api\/(api-logs|client-log)(\/|$)/;

export function withApiLog<T extends (...args: any[]) => any>(handler: T): T {
  return (async (req: Request, ...rest: any[]) => {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS' || req.method === 'HEAD') return handler(req, ...rest);
    const noLog = SKIP.test(url.pathname);   // the log page's own calls are answered the same way, but not written down

    const started = Date.now();
    const ref = shortRef();
    let body = '';
    try {
      if (!noLog && req.method !== 'GET') {
        const ct = req.headers.get('content-type') || '';
        const len = Number(req.headers.get('content-length') || 0);
        if (ct.includes('multipart/form-data')) body = `[file upload, ${len} bytes]`;
        else if (len <= 200_000) body = bodyPreview(await req.clone().text(), ct);
        else body = `[large body, ${len} bytes]`;
      }
    } catch { /* the body is only for the log */ }

    let res: Response | undefined, thrown: any;
    try { res = await handler(req, ...rest); } catch (e) { thrown = e; }

    const status = res ? res.status : 500;
    let errorMessage: string | undefined, errorDetail: string | undefined;

    if (thrown) {
      errorMessage = thrown?.sqlMessage || thrown?.message || String(thrown);
      errorDetail = thrown?.stack;
      res = NextResponse.json({ detail: friendlyError(errorMessage, ref).text, ref }, { status: 500 });
    } else if (res) {
      // No technical message leaves the server: every error answer is checked, and so is the answer of anything that changes data
      // (it can carry a failure text, such as a mail that could not be sent). Reads that worked are left alone (they can be large).
      const ct = res.headers.get('content-type') || '';
      const isJson = ct.includes('json'), isText = ct.startsWith('text/');
      if ((status >= 400 && (isJson || isText)) || (isJson && req.method !== 'GET')) {
        try {
          const text = await res.clone().text();
          if (text.length <= 500_000) {
            if (isJson) {
              const parsed = JSON.parse(text);
              const found = { raw: '' };
              const cleaned = cleanAnswer(parsed, ref, '', found);
              const msg = parsed?.detail ?? parsed?.error ?? parsed?.message;
              if (status >= 400) errorMessage = typeof msg === 'string' ? msg : JSON.stringify(parsed).slice(0, 500);
              else if (found.raw) errorMessage = found.raw;
              if (found.raw) {
                if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)) cleaned.ref = ref;
                const headers = new Headers(res.headers); headers.delete('content-length');
                res = new NextResponse(JSON.stringify(cleaned), { status, headers });
              }
            } else {
              errorMessage = text.slice(0, 500);
              const f = friendlyError(text, ref);
              if (f.technical) res = new NextResponse(f.text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }
          }
        } catch { /* the answer could not be read; the status is still logged */ }
      }
    }

    if (!noLog) {
      try {
        const s = await getApiLogSettings();
        const failed = status >= 400 || !!errorMessage;
        if (failed || req.method !== 'GET' || s.logGets) {
          logApi({
            source: 'server', ref: failed ? ref : undefined, method: req.method, path: url.pathname, query_string: url.search.slice(1), status,
            duration_ms: Date.now() - started, ...who(req), ip: clientIp(req), user_agent: req.headers.get('user-agent') || '',
            request_body: body, error_message: errorMessage, error_detail: errorDetail,
          });
        }
      } catch { /* logging never breaks a request */ }
    }
    return res;
  }) as unknown as T;
}

// ---- deleting old entries (the days are set on the API Logs page) ----
export async function purgeOldApiLogs(): Promise<number> {
  const { retentionDays } = await getApiLogSettings();
  if (!retentionDays) return 0;
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const r = await execute('DELETE FROM api_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 5000', [retentionDays]);
    total += r.affectedRows;
    if (r.affectedRows < 5000) break;
  }
  return total;
}

export function startApiLogPurge() {
  if (g.__apiLogPurgeStarted) return;
  g.__apiLogPurgeStarted = true;
  const run = () => { purgeOldApiLogs().catch(() => {}); };
  setTimeout(run, 60_000);
  setInterval(run, 60 * 60 * 1000);
}
