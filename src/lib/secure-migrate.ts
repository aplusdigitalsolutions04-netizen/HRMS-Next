// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { encryptSecret } from './mailbox';

// Runs when the server starts. Turns the temporary passwords of Employee Credentials that were saved as plain text into encrypted ones. Rows that are already encrypted ('enc:v1:...') or have nothing to hide
// are left alone, so it is safe to run every time.
export async function encryptStoredSecrets() {
  try {
    const cred = await query<RowDataPacket[]>("SELECT id, password FROM employee_credentials WHERE password IS NOT NULL AND password <> '' AND password <> '(own password)' AND password NOT LIKE 'enc:v1:%'");
    for (const r of cred) await execute('UPDATE employee_credentials SET password = ? WHERE id = ?', [encryptSecret(r.password), r.id]);
    // Employee Credentials only ever holds the temporary password that was mailed: once the employee has set their own
    // password (no forced change pending), the stored one is no longer valid and is not kept
    const own = await query<RowDataPacket[]>("SELECT c.id FROM employee_credentials c JOIN employees e ON e.id = c.employee_id WHERE e.must_change_password = 0 AND c.password <> '' AND c.password <> '(own password)'");
    for (const r of own) await execute("UPDATE employee_credentials SET password = '' WHERE id = ?", [r.id]);
    if (cred.length || own.length) console.log(`[security] encrypted ${cred.length} credential password(s); cleared ${own.length} stale credential password(s)`);
  } catch (e: any) { console.error('[security] could not encrypt stored passwords:', e?.message || e); }
}
