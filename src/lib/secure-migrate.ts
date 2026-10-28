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
    if (cred.length) console.log(`[security] encrypted ${cred.length} credential password(s)`);
  } catch (e: any) { console.error('[security] could not encrypt stored passwords:', e?.message || e); }
}
