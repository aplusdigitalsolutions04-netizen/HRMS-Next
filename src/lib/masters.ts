// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// Starting lists for the two masters. They are written once, the first time the master is used; after that
// HR owns them (add, rename, switch off), nothing here is forced back.
const DEFAULT_LEAVE_TYPES = ['Annual Leave', 'Sick Leave', 'Casual Leave'];

// [name, request_kind, is_system]. "General" and "Interview" are used by other screens, so they stay.
const DEFAULT_CATEGORIES: [string, string | null, number][] = [
  ['General', null, 1],
  ['Interview', null, 1],
  ['Leave', 'leave', 0],
  ['Work From Home', 'wfh', 0],
  ['Missed Punch', 'missed_punch', 0],
  ['Late Coming', 'late_coming', 0],
];

async function seeded(key: string): Promise<boolean> {
  const r = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  return r.length > 0;
}
async function markSeeded(key: string) {
  await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [key, '1']);
}

export async function ensureLeaveTypes() {
  if (await seeded('leave_types_seeded')) return;
  // types already used by earlier requests / balances come first, then the usual three
  const used = await query<RowDataPacket[]>('SELECT leave_type AS t FROM leave_requests UNION SELECT leave_type FROM leave_balances');
  const names = [...new Set([...used.map(r => r.t), ...DEFAULT_LEAVE_TYPES].filter(Boolean))];
  for (const n of names) await execute('INSERT IGNORE INTO leave_types (name, is_active) VALUES (?, 1)', [n]);
  await markSeeded('leave_types_seeded');
}

export async function ensureTemplateCategories() {
  if (await seeded('template_categories_seeded')) return;
  for (const [name, kind, sys] of DEFAULT_CATEGORIES) {
    await execute('INSERT IGNORE INTO template_categories (name, request_kind, is_system) VALUES (?,?,?)', [name, kind, sys]);
  }
  // categories typed into templates before this master existed (e.g. "Employee Invite")
  const used = await query<RowDataPacket[]>("SELECT DISTINCT template_type AS t FROM email_templates WHERE template_type IS NOT NULL AND template_type <> ''");
  for (const r of used) await execute('INSERT IGNORE INTO template_categories (name, request_kind, is_system) VALUES (?, NULL, 0)', [r.t]);
  await markSeeded('template_categories_seeded');
}

// The active leave type names, used to check a request.
export async function activeLeaveTypes(): Promise<string[]> {
  await ensureLeaveTypes();
  const r = await query<RowDataPacket[]>('SELECT name FROM leave_types WHERE is_active = 1 ORDER BY name');
  return r.map(x => x.name);
}
