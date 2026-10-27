// @ts-nocheck
import { query } from './db';
import { RowDataPacket } from 'mysql2';

const ymd = (d: any) => {
  if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return String(d || '').slice(0, 10);
};
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00').getTime()) && ymd(new Date(s + 'T00:00:00')) === s;

// Checks the dates and reason of a WFH request. Returns the clean values, or an error message for the employee.
export async function checkWfhRequest(employeeId: string, input: any, ignoreId?: string): Promise<{ error?: string; start?: string; end?: string; reason?: string }> {
  const start = String(input.start_date || '').slice(0, 10), end = String(input.end_date || '').slice(0, 10), reason = String(input.reason || '').trim();
  if (!start || !end) return { error: 'Please select start and end dates' };
  if (!isDate(start) || !isDate(end)) return { error: 'Please enter valid dates' };
  if (end < start) return { error: 'End date must not be before the start date' };
  if (start < ymd(new Date())) return { error: 'WFH cannot be applied for a date that has already passed' };
  if (!reason) return { error: 'Please enter a reason' };
  if (reason.length > 500) return { error: 'The reason is too long (500 characters at most)' };
  const rows = await query<RowDataPacket[]>(
    "SELECT id, start_date, end_date, status FROM wfh_requests WHERE employee_id = ? AND LOWER(status) IN ('pending','approved')" + (ignoreId ? ' AND id <> ?' : ''),
    ignoreId ? [employeeId, ignoreId] : [employeeId]
  );
  const clash = rows.find(r => ymd(r.start_date) <= end && ymd(r.end_date) >= start);
  if (clash) return { error: `You already have a ${String(clash.status).toLowerCase()} WFH request for ${ymd(clash.start_date)} to ${ymd(clash.end_date)}` };
  return { start, end, reason };
}
