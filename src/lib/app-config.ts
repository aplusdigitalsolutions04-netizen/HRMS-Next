// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// Rules and limits that used to be written into the program. They are kept in the database (system_settings, keys "cfg_<name>") and
// edited in Settings > Rules & Limits. The values below are only what is used until HR enters their own, so a new install works.
// Each field says where it is used, so nothing here is a secret rule of the program.

export type FieldType = 'number' | 'bool' | 'list' | 'text';
export interface Field { key: string; label: string; type: FieldType; group: string; help?: string; min?: number; max?: number; default: any }

export const GROUPS = ['Login security', 'Passwords', 'Files', 'Lists', 'Reminders', 'Numbers & limits', 'References', 'Money & format', 'Names & reading'];

export const FIELDS: Field[] = [
  { key: 'login_max_per_email', label: 'Wrong passwords allowed for one email', type: 'number', group: 'Login security', min: 1, max: 100, default: 5, help: 'After this many wrong tries the login of that email is locked for a while.' },
  { key: 'login_max_per_ip', label: 'Wrong passwords allowed from one computer', type: 'number', group: 'Login security', min: 1, max: 1000, default: 30, help: 'Stops one computer from trying many emails.' },
  { key: 'login_lock_minutes', label: 'Lock time (minutes)', type: 'number', group: 'Login security', min: 1, max: 1440, default: 15, help: 'How long a locked login has to wait. It also opens by itself after a right password or an HR password reset.' },
  { key: 'login_window_minutes', label: 'Count wrong tries within (minutes)', type: 'number', group: 'Login security', min: 1, max: 1440, default: 30, help: 'Wrong tries older than this are forgotten.' },
  { key: 'session_hours', label: 'Stay signed in for (hours)', type: 'number', group: 'Login security', min: 1, max: 720, default: 8, help: 'Applies to the next sign-in of each person.' },

  { key: 'password_min_length', label: 'Shortest password (characters)', type: 'number', group: 'Passwords', min: 4, max: 64, default: 8 },
  { key: 'password_need_mix', label: 'A password needs a letter and a number', type: 'bool', group: 'Passwords', default: true },
  { key: 'password_block_common', label: 'Refuse passwords that everybody tries first', type: 'bool', group: 'Passwords', default: true, help: 'A short list of very common passwords, the company name and the person\'s email name.' },
  { key: 'password_blocked_words', label: 'More words a password may not contain', type: 'list', group: 'Passwords', default: [], help: 'One word per line.' },

  { key: 'upload_max_mb', label: 'Largest file for documents and resumes (MB)', type: 'number', group: 'Files', min: 1, max: 100, default: 10 },
  { key: 'leave_doc_max_mb', label: 'Largest file for a leave document (MB)', type: 'number', group: 'Files', min: 1, max: 100, default: 5 },
  { key: 'mail_file_max_mb', label: 'Largest attachment of one mail (MB)', type: 'number', group: 'Files', min: 1, max: 100, default: 10 },
  { key: 'mail_total_max_mb', label: 'Largest total of the attachments of one mail (MB)', type: 'number', group: 'Files', min: 1, max: 200, default: 20 },

  { key: 'helpdesk_categories', label: 'Help Desk: what a question can be about', type: 'list', group: 'Lists', default: ['Payslip / Salary', 'Leave', 'Attendance', 'Documents', 'Assets / IT', 'Policy / HR query', 'Other'], help: 'One per line. The last one is used when nothing fits.' },
  { key: 'exit_reasons', label: 'Exit: reasons for leaving', type: 'list', group: 'Lists', default: ['Resignation', 'Better opportunity', 'Higher studies', 'Personal reasons', 'Relocation', 'Termination', 'End of contract', 'Other'], help: 'One per line.' },
  { key: 'exit_checklist', label: 'Exit: checklist of an employee who is leaving', type: 'list', group: 'Lists', default: ['Resignation accepted by the manager and HR', 'Handover of work and knowledge transfer done', 'Company assets returned (laptop, ID card, accessories)', 'Email, system and building access removed', 'Exit interview done', 'Pending dues and recoveries checked', 'Relieving and experience letters given'], help: 'One per line. Used for each new exit; exits already started keep their own list.' },
  { key: 'salary_revision_reasons', label: 'Salary revision: reasons', type: 'list', group: 'Lists', default: ['Appraisal', 'Promotion', 'Correction', 'Other'], help: 'One per line. "Joining" is added by the program for a first structure.' },

  { key: 'doc_expiry_notice_days', label: 'Document expiry: remind this many days before', type: 'list', group: 'Reminders', default: ['30', '7', '0'], help: 'One number per line (0 = on the day it expires). Each reminder is sent once.' },

  { key: 'mail_max_recipients', label: 'Most recipients of one mail', type: 'number', group: 'Numbers & limits', min: 1, max: 500, default: 50 },
  { key: 'dashboard_upcoming_days', label: 'Dashboard: how many days ahead birthdays and anniversaries are shown', type: 'number', group: 'Numbers & limits', min: 1, max: 365, default: 30 },
  { key: 'api_slow_ms', label: 'API Logs: a call is "slow" from (milliseconds)', type: 'number', group: 'Numbers & limits', min: 100, max: 60000, default: 1000 },
  { key: 'client_log_per_minute', label: 'Browser error reports taken from one person in a minute', type: 'number', group: 'Numbers & limits', min: 1, max: 1000, default: 30 },

  { key: 'helpdesk_prefix', label: 'Help Desk ticket number starts with', type: 'text', group: 'References', default: 'HD' },
  { key: 'fnf_prefix', label: 'Full and final statement reference starts with', type: 'text', group: 'References', default: 'FNF' },

  { key: 'currency_label', label: 'Money is written as (letters, PDFs)', type: 'text', group: 'Money & format', default: 'Rs.', help: 'Shown before an amount in letters and the settlement statement.' },
  { key: 'currency_symbol', label: 'Money symbol on the screens', type: 'text', group: 'Money & format', default: '\u20B9', help: 'Shown before an amount on the pages.' },
  { key: 'locale', label: 'Dates and numbers are written as (language code)', type: 'text', group: 'Money & format', default: 'en-IN', help: 'For example en-IN, en-GB, en-US.' },

  { key: 'app_short_name', label: 'Name of the program in the browser tab', type: 'text', group: 'Names & reading', default: 'HRMS', help: 'The company name from Company Settings is added after it.' },
  { key: 'app_tab_title', label: 'Whole title of the browser tab (optional)', type: 'text', group: 'Names & reading', default: '', help: 'If filled in, this is the tab title exactly as written (for example HRMS-APDS). Left empty, the program name above and the company name are used.' },
  { key: 'drive_folder_resumes', label: 'Google Drive folder for candidate resumes', type: 'text', group: 'Names & reading', default: 'Candidate Resumes' },
  { key: 'drive_folder_leave_docs', label: 'Google Drive folder for leave documents', type: 'text', group: 'Names & reading', default: 'Leave Documents' },
  { key: 'resume_model', label: 'Model that reads resumes', type: 'text', group: 'Names & reading', default: 'gpt-4o-mini', help: 'The name of the model of the reading service.' },
  { key: 'resume_text_chars', label: 'How many characters of a resume are read', type: 'number', group: 'Names & reading', min: 1000, max: 100000, default: 8000 },

  { key: 'upload_shrink_above_mb', label: 'A photo bigger than this (MB) is made smaller before sending', type: 'number', group: 'Files', min: 0.1, max: 50, default: 1.2 },
  { key: 'upload_one_file_mb', label: 'Largest single file the browser sends (MB)', type: 'number', group: 'Files', min: 1, max: 100, default: 8 },
  { key: 'upload_total_mb', label: 'Largest total of all files in one submit (MB)', type: 'number', group: 'Files', min: 1, max: 200, default: 20 },
  { key: 'register_photo_kb', label: 'Registration form: largest passport photo (KB)', type: 'number', group: 'Files', min: 10, max: 5000, default: 100 },
  { key: 'register_pdf_mb', label: 'Registration form: largest document file (MB)', type: 'number', group: 'Files', min: 1, max: 50, default: 2 },
  { key: 'register_doc_mb', label: 'Registration form: largest bank document (MB)', type: 'number', group: 'Files', min: 1, max: 50, default: 5 },
];

const KEY = (k: string) => 'cfg_' + k;

const asNumber = (f: Field, v: any) => { const n = Number(v); return Number.isFinite(n) ? Math.min(f.max ?? Infinity, Math.max(f.min ?? -Infinity, n)) : f.default; };
function parse(f: Field, raw: any) {
  if (raw === undefined || raw === null) return f.default;
  if (f.type === 'number') return asNumber(f, raw);
  if (f.type === 'bool') return raw === '1' || raw === 'true' || raw === true;
  if (f.type === 'list') { try { const a = JSON.parse(raw); return Array.isArray(a) ? a.map(String).map(s => s.trim()).filter(Boolean) : f.default; } catch { return f.default; } }
  return String(raw).slice(0, 40) || f.default;
}

// All values (entered by HR, or the starting value). Read from the database each time: the table is small and a change applies at once.
export async function getConfig(): Promise<Record<string, any>> {
  const rows = await query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'cfg\\_%'").catch(() => []);
  const by: Record<string, string> = {};
  for (const r of rows) by[r.setting_key] = r.setting_value;
  const out: Record<string, any> = {};
  for (const f of FIELDS) out[f.key] = parse(f, by[KEY(f.key)]);
  return out;
}

export async function saveConfig(patch: Record<string, any>): Promise<string[]> {
  const changed: string[] = [];
  for (const f of FIELDS) {
    if (patch[f.key] === undefined) continue;
    let v = patch[f.key];
    if (f.type === 'number') { const n = Number(v); if (!Number.isFinite(n) || n < (f.min ?? -Infinity) || n > (f.max ?? Infinity)) throw new Error(`${f.label}: a number from ${f.min} to ${f.max}, please`); v = String(n); }
    else if (f.type === 'bool') v = v ? '1' : '0';
    else if (f.type === 'list') {
      const list = (Array.isArray(v) ? v : String(v).split('\n')).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 60);
      if (f.key === 'doc_expiry_notice_days' && list.some(x => !/^\d{1,3}$/.test(x))) throw new Error('Reminder days: whole numbers only, one per line');
      if (['helpdesk_categories', 'exit_reasons', 'salary_revision_reasons'].includes(f.key) && list.length === 0) throw new Error(`${f.label}: at least one is needed`);
      v = JSON.stringify([...new Set(list)]);
    } else v = String(v).trim().slice(0, 40);
    const ex = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [KEY(f.key)]);
    if (ex.length) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [v, KEY(f.key)]);
    else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [KEY(f.key), v]);
    changed.push(f.key);
  }
  return changed;
}

export const mb = (n: number) => Math.round(n * 1024 * 1024);
