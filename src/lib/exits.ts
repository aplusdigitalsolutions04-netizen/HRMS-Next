// @ts-nocheck
import { query } from './db';
import { RowDataPacket } from 'mysql2';

import { getConfig } from './app-config';

// The reasons and the checklist are kept in Settings > Rules & Limits.
export const exitReasons = async (): Promise<string[]> => (await getConfig()).exit_reasons;
export const exitChecklist = async (): Promise<string[]> => (await getConfig()).exit_checklist;
export const EXIT_STATUSES = ['In Progress', 'Settled', 'Completed'];

export const parseJson = (t: any, fallback: any) => { try { const v = t ? JSON.parse(t) : null; return v ?? fallback; } catch { return fallback; } };

export async function loadExit(id: any) {
  return (await query<RowDataPacket[]>(
    `SELECT x.*, DATE_FORMAT(x.resignation_date, '%Y-%m-%d') AS resignation, DATE_FORMAT(x.last_working_day, '%Y-%m-%d') AS lwd,
            e.full_name, e.designation, e.email_id, e.status AS employee_status, DATE_FORMAT(e.date_of_joining, '%Y-%m-%d') AS joined
     FROM employee_exits x JOIN employees e ON e.id = x.employee_id WHERE x.id = ?`, [id]))[0];
}

// lines sent by the browser: only the known shape, sane amounts
export function cleanLines(input: any): { key: string; label: string; amount: number; type: string; auto: boolean }[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 40).map((l: any, i: number) => ({
    key: String(l.key || 'line_' + i).slice(0, 40), label: String(l.label || '').trim().slice(0, 120),
    amount: Math.round(Math.max(0, Number(l.amount) || 0) * 100) / 100, type: l.type === 'deduction' ? 'deduction' : 'earning', auto: !!l.auto,
  })).filter(l => l.label);
}
