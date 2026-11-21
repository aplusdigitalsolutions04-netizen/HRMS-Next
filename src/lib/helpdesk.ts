// @ts-nocheck
import { query } from './db';
import { RowDataPacket } from 'mysql2';

import { getConfig } from './app-config';

// What a question can be about and how a ticket number begins are kept in Settings > Rules & Limits.
export const helpdeskCategories = async (): Promise<string[]> => (await getConfig()).helpdesk_categories;
export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

export const escapeHtml = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Whether a mail goes to HR for a new ticket and to the employee for an answer (Help Desk page, "Email alerts"). On unless switched off.
export async function helpdeskMailOn(): Promise<boolean> {
  const r = await query<RowDataPacket[]>("SELECT setting_value FROM system_settings WHERE setting_key = 'helpdesk_mail'");
  return r[0]?.setting_value !== '0';
}
