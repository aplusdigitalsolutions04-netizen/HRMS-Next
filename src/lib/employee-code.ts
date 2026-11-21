import { query, getConnection } from './db';
import { RowDataPacket } from 'mysql2';

// Employee ID (emp_code) is stored as plain text in many tables (attendance, payslips, salary structure, credentials, ...) and one table
// has a database rule (foreign key) tied to it, so changing it only on the employee row is refused by the database and, if it were
// allowed, would leave all of that employee's history behind under the old ID. This changes it everywhere together.
// The tables are looked up in the database itself, so a table added later is covered too.
export async function renameEmployeeCode(oldCode: string, newCode: string): Promise<{ ok: boolean; error?: string; tables: string[] }> {
  const next = String(newCode || '').trim();
  if (!next) return { ok: false, error: 'Employee ID cannot be empty', tables: [] };
  if (next.length > 50) return { ok: false, error: 'Employee ID is too long', tables: [] };
  if (next === oldCode) return { ok: true, tables: [] };

  const taken = await query<RowDataPacket[]>('SELECT id FROM employees WHERE emp_code = ? AND emp_code <> ?', [next, oldCode]);
  if (taken.length > 0) return { ok: false, error: 'Employee ID already exists', tables: [] };

  const cols = await query<RowDataPacket[]>(
    `SELECT c.TABLE_NAME AS t, c.COLUMN_NAME AS col FROM information_schema.COLUMNS c
     JOIN information_schema.TABLES tb ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME AND tb.TABLE_TYPE = 'BASE TABLE'
     WHERE c.TABLE_SCHEMA = DATABASE() AND c.COLUMN_NAME IN ('emp_code', 'employee_code') AND c.TABLE_NAME <> 'employees'`
  );

  const conn = await getConnection();
  const done: string[] = [];
  try {
    // The foreign key would refuse the change in either order (parent first or child first), so its check is paused for this one
    // connection while every table is updated inside one transaction, and switched on again at the end.
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.beginTransaction();
    for (const c of cols) {
      await conn.query(`UPDATE \`${c.t}\` SET \`${c.col}\` = ? WHERE \`${c.col}\` = ?`, [next, oldCode]);
      done.push(c.t);
    }
    await conn.query('UPDATE employees SET emp_code = ? WHERE emp_code = ?', [next, oldCode]);
    await conn.commit();
    return { ok: true, tables: done };
  } catch (e: any) {
    await conn.rollback().catch(() => {});
    if (e?.code === 'ER_DUP_ENTRY') return { ok: false, error: 'Employee ID already exists', tables: [] };
    throw e;
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    conn.release();
  }
}
