// @ts-nocheck
import { query } from './db';
import { RowDataPacket } from 'mysql2';
import { getConfig } from './app-config';

// What a password has to be is set in Settings > Rules & Limits (length, a letter and a number, the common passwords, extra words).
// Only a short list of the passwords everybody tries first is built in; the company's own name is taken from Company Settings.
const COMMON = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000', '121212', '654321', 'password', 'password1', 'password123',
  'qwerty', 'qwerty123', 'qwertyuiop', 'abc123', 'abcd1234', 'admin', 'admin123', 'admin@123', 'welcome', 'welcome1', 'welcome123',
  'letmein', 'iloveyou', 'test1234', 'changeme', 'p@ssw0rd', 'passw0rd',
]);

// null when the password is fine, otherwise what is wrong with it
export async function validatePassword(pw: string, email?: string): Promise<string | null> {
  const cfg = await getConfig();
  const p = String(pw || '');
  if (p.length < cfg.password_min_length) return `Password must be at least ${cfg.password_min_length} characters`;
  if (p.length > 100) return 'Password is too long';
  if (cfg.password_need_mix && (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p))) return 'Password must contain at least one letter and one number';
  const low = p.toLowerCase();
  if (cfg.password_block_common) {
    if (COMMON.has(low)) return 'This password is too common. Choose a different one';
    const co = (await query<RowDataPacket[]>('SELECT company_name FROM company_settings LIMIT 1').catch(() => []))[0]?.company_name || '';
    const words = String(co).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 4);
    if (words.some(w => low.includes(w))) return 'Password must not contain the company name';
  }
  if ((cfg.password_blocked_words || []).some((w: string) => w && low.includes(String(w).toLowerCase()))) return 'This password contains a word that is not allowed';
  const local = String(email || '').split('@')[0].toLowerCase();
  if (cfg.password_block_common && local.length >= 4 && low.includes(local)) return 'Password must not contain your email name';
  return null;
}
