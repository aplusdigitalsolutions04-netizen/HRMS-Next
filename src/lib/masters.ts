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

// The mail HR sends as a reminder to an employee whose invite is still pending. It is a normal row in email_templates,
// put there once so the feature works from the start; after that HR owns it (edit or replace it in Template Management).
export const INVITE_REMINDER_TEMPLATE = 'Invite Reminder';
export async function ensureInviteReminderTemplate() {
  if (await seeded('invite_reminder_template_seeded')) return;
  const has = await query<RowDataPacket[]>('SELECT id FROM email_templates WHERE name = ? LIMIT 1', [INVITE_REMINDER_TEMPLATE]);
  if (has.length === 0) {
    const body = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
{{company_logo}}
<p>Dear {{name}},</p>
<p>This is a reminder that your account at {{company_name}} is ready, but your profile is not complete yet. Please log in and complete it.</p>
<p><b>Login:</b> {{login_url}}<br/><b>Email:</b> {{email}}</p>
<p>Please use the login details we sent you earlier. If you cannot find them, reply to this mail.</p>
<p>Regards,<br/>HR Team</p></div>`;
    await execute('INSERT INTO email_templates (id, name, subject, body, variables, template_type, created_on) VALUES (UUID(),?,?,?,?,?,NOW())',
      [INVITE_REMINDER_TEMPLATE, 'Reminder: complete your profile at {{company_name}}', body, JSON.stringify(['name', 'email', 'emp_code', 'login_url', 'company_name', 'company_logo']), 'Employee Invite']);
  }
  await markSeeded('invite_reminder_template_seeded');
}

// The mail HR sends from an employee's Documents tab, asking for the papers they have to upload. Like the invite reminder
// it is a normal template row (put there once), edited by HR in Template Management. {{documents}} becomes the list.
export const DOCUMENT_REQUEST_TEMPLATE = 'Document Request';
export async function ensureDocumentRequestTemplate() {
  if (await seeded('document_request_template_seeded')) return;
  const has = await query<RowDataPacket[]>('SELECT id FROM email_templates WHERE name = ? LIMIT 1', [DOCUMENT_REQUEST_TEMPLATE]);
  if (has.length === 0) {
    const body = `Dear {{name}},

HR needs you to upload the following document(s) in your profile:

{{documents}}

Please log in at {{login_url}}, open My Documents and upload them.

Regards,
HR Team
{{company_name}}`;
    await execute('INSERT INTO email_templates (id, name, subject, body, variables, template_type, created_on) VALUES (UUID(),?,?,?,?,?,NOW())',
      [DOCUMENT_REQUEST_TEMPLATE, 'Documents needed - {{company_name}}', body, JSON.stringify(['name', 'documents', 'login_url', 'company_name', 'email', 'emp_code']), 'Employee Invite']);
  }
  await markSeeded('document_request_template_seeded');
}

// ── Request Types master ──
// [key, name]. The four have their approval flow in the app (is_system). The names here are only the starting values; after the
// first use the table owns them (rename, add more).
const DEFAULT_REQUEST_TYPES: [string, string][] = [['leave', 'Leave'], ['wfh', 'Work From Home'], ['missed_punch', 'Missed punch'], ['late_coming', 'Late coming']];
export async function ensureRequestTypes() {
  if (await seeded('request_types_seeded')) return;
  for (const [k, n] of DEFAULT_REQUEST_TYPES) await execute('INSERT IGNORE INTO request_types (type_key, name, is_system, is_active) VALUES (?,?,1,1)', [k, n]);
  await markSeeded('request_types_seeded');
}
// key -> name of the request types (the active ones, or all of them).
export async function getMailKinds(onlyActive = true): Promise<Record<string, string>> {
  await ensureRequestTypes();
  const r = await query<RowDataPacket[]>('SELECT type_key, name FROM request_types' + (onlyActive ? ' WHERE is_active = 1' : '') + ' ORDER BY is_system DESC, name');
  return Object.fromEntries(r.map(x => [x.type_key, x.name]));
}
