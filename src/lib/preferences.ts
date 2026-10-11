// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// Per-user settings: language, which notification groups to mute, which dashboard widgets to hide.
// Stored as one small JSON per user in user_preferences (key "<admin|employee>:<id>").

export const NOTIF_GROUPS: Record<string, { label: string; hint: string; categories: string[] }> = {
  leave:      { label: 'Leave', hint: 'Leave requests, approvals and rejections', categories: ['leave_apply', 'leave_approved', 'leave_rejected'] },
  wfh:        { label: 'Work From Home', hint: 'WFH requests, approvals and rejections', categories: ['wfh_apply', 'wfh_approved', 'wfh_rejected'] },
  attendance: { label: 'Attendance corrections', hint: 'Missed-punch requests and their decisions', categories: ['regularization', 'regularization_request'] },
  assets:     { label: 'Company assets', hint: 'When an asset is assigned to you', categories: ['asset'] },
  payroll:    { label: 'Payroll', hint: 'Payslip drafts waiting for review', categories: ['payroll_draft'] },
};

export interface Prefs { lang: 'en' | 'hi'; notif_muted: string[]; dashboard_hidden: string[] }
const DEFAULTS: Prefs = { lang: 'en', notif_muted: [], dashboard_hidden: [] };

export const userKey = (user: any) => `${user?.type === 'employee' ? 'employee' : 'admin'}:${user?.id}`;

export function cleanPrefs(input: any, base: Prefs = DEFAULTS): Prefs {
  const out: Prefs = { ...base };
  if (input && typeof input === 'object') {
    if (input.lang === 'en' || input.lang === 'hi') out.lang = input.lang;
    if (Array.isArray(input.notif_muted)) out.notif_muted = [...new Set(input.notif_muted.map(String))].filter(k => NOTIF_GROUPS[k]);
    if (Array.isArray(input.dashboard_hidden)) out.dashboard_hidden = [...new Set(input.dashboard_hidden.map(String))].filter(k => /^[a-z_]{1,30}$/.test(k)).slice(0, 40);
  }
  return out;
}

export async function getPrefs(user: any): Promise<Prefs> {
  if (!user?.id) return { ...DEFAULTS };
  const rows = await query<RowDataPacket[]>('SELECT prefs FROM user_preferences WHERE user_key = ?', [userKey(user)]);
  if (rows.length === 0 || !rows[0].prefs) return { ...DEFAULTS };
  try { return cleanPrefs(JSON.parse(rows[0].prefs)); } catch { return { ...DEFAULTS }; }
}

export async function savePrefs(user: any, patch: any): Promise<Prefs> {
  const next = cleanPrefs(patch, await getPrefs(user));
  await execute(
    'INSERT INTO user_preferences (user_key, prefs, updated_at) VALUES (?,?,NOW()) ON DUPLICATE KEY UPDATE prefs = VALUES(prefs), updated_at = NOW()',
    [userKey(user), JSON.stringify(next)]
  );
  return next;
}

// notification categories this user has switched off
export async function mutedCategories(user: any): Promise<string[]> {
  const p = await getPrefs(user);
  return p.notif_muted.flatMap(k => NOTIF_GROUPS[k]?.categories || []);
}
