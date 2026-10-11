// @ts-nocheck
import { query, execute, getPool } from './db';
import { RowDataPacket } from 'mysql2';

const mysql = require('mysql2');

// One value as SQL text. JSON columns come back as objects/arrays - mysql.escape would turn those into
// "a = 1, b = 2" lists, so they are written as JSON strings instead.
function sqlValue(v: any): string {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date || Buffer.isBuffer(v)) return mysql.escape(v);
  if (typeof v === 'object') return mysql.escape(JSON.stringify(v));
  return mysql.escape(v);
}

// Everything here is READ-ONLY on the database: it only reads rows to build a file.

export async function listTables(): Promise<string[]> {
  const rows = await query<RowDataPacket[]>('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\'');
  return rows.map(r => String(Object.values(r)[0])).sort();
}

export async function rowCounts(): Promise<{ table: string; rows: number }[]> {
  const out = [];
  for (const t of await listTables()) {
    const r = await query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${t}\``);
    out.push({ table: t, rows: Number(r[0].n) || 0 });
  }
  return out;
}

async function setSetting(key: string, value: string) {
  const rows = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
  if (rows.length > 0) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, key]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [key, value]);
}
export async function markBackup(kind: string, by: string) {
  await setSetting('last_backup_at', new Date().toISOString());
  await setSetting('last_backup_kind', `${kind} by ${by}`);
}
export async function lastBackup(): Promise<{ at: string; kind: string }> {
  const rows = await query<RowDataPacket[]>("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('last_backup_at','last_backup_kind')");
  const m: Record<string, string> = {};
  rows.forEach(r => { m[r.setting_key] = r.setting_value; });
  return { at: m.last_backup_at || '', kind: m.last_backup_kind || '' };
}

// A restorable .sql file, streamed table by table so a large database never has to sit in memory.
export function sqlDumpStream(): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(enc.encode(s));
      try {
        send(`-- HRMS full backup\n-- Created: ${new Date().toISOString()}\n-- Restore with: mysql -u <user> -p <database> < this-file.sql\n-- WARNING: restoring replaces the tables below with the data in this file.\n\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n`);
        for (const t of await listTables()) {
          const create = await query<RowDataPacket[]>(`SHOW CREATE TABLE \`${t}\``);
          send(`-- ----------------------------\n-- Table: ${t}\n-- ----------------------------\nDROP TABLE IF EXISTS \`${t}\`;\n${create[0]['Create Table']};\n\n`);
          const BATCH = 300;
          for (let offset = 0; ; offset += BATCH) {
            const rows = await query<RowDataPacket[]>(`SELECT * FROM \`${t}\` LIMIT ${BATCH} OFFSET ${offset}`);
            if (rows.length === 0) break;
            const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
            send(`INSERT INTO \`${t}\` (${cols}) VALUES\n${rows.map(r => '(' + Object.values(r).map(v => sqlValue(v)).join(', ') + ')').join(',\n')};\n`);
            if (rows.length < BATCH) break;
          }
          send('\n');
        }
        send('SET FOREIGN_KEY_CHECKS=1;\n-- End of backup\n');
        controller.close();
      } catch (e: any) {
        send(`\n-- BACKUP FAILED: ${String(e?.message || e).replace(/\n/g, ' ')}\n`);
        controller.close();
      }
    },
  });
}

// Excel workbook with the day-to-day data (one sheet per table). Passwords, profile photos and other
// bulky / secret columns are left out - this is for reading and reporting, not for restoring.
const EXCEL_TABLES: { table: string; sheet: string; skip?: string[] }[] = [
  { table: 'employees', sheet: 'Employees', skip: ['password', 'profile_photo', 'document_sources', 'additional_documents'] },
  { table: 'attendance', sheet: 'Attendance' },
  { table: 'attendance_summary', sheet: 'Attendance Summary' },
  { table: 'leave_requests', sheet: 'Leave Requests' },
  { table: 'wfh_requests', sheet: 'WFH Requests' },
  { table: 'payslips', sheet: 'Payslips', skip: ['pdf_path'] },
  { table: 'salary_structures', sheet: 'Salary Structures' },
  { table: 'holidays', sheet: 'Holidays' },
  { table: 'departments', sheet: 'Departments' },
  { table: 'designations', sheet: 'Designations' },
  { table: 'assets', sheet: 'Assets' },
  { table: 'asset_assignments', sheet: 'Asset Assignments' },
  { table: 'attendance_regularizations', sheet: 'Attendance Corrections' },
  { table: 'interview_candidates', sheet: 'Candidates' },
  { table: 'audit_logs', sheet: 'Audit Log' },
];

export async function excelExport(): Promise<Buffer> {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  const have = new Set(await listTables());
  for (const e of EXCEL_TABLES) {
    if (!have.has(e.table)) continue;
    const rows = await query<RowDataPacket[]>(`SELECT * FROM \`${e.table}\` LIMIT 200000`);
    const clean = rows.map(r => {
      const o: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) {
        if (e.skip && e.skip.includes(k)) continue;
        o[k] = v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : (typeof v === 'string' && v.length > 32000 ? v.slice(0, 32000) : v);
      }
      return o;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean.length ? clean : [{}]), e.sheet.slice(0, 31));
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
