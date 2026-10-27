// A password has to be at least 8 characters, with a letter and a number, and not one of the passwords everybody tries first.
const COMMON = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '111111', '000000', '121212', '654321', 'password', 'password1', 'password123',
  'qwerty', 'qwerty123', 'qwertyuiop', 'abc123', 'abcd1234', 'admin', 'admin123', 'admin@123', 'welcome', 'welcome1', 'welcome123',
  'letmein', 'iloveyou', 'india123', 'india@123', 'hr@123', 'hrms123', 'test1234', 'changeme', 'p@ssw0rd', 'passw0rd', 'aplus123', 'aplus@123',
]);

// null when the password is fine, otherwise what is wrong with it
export function validatePassword(pw: string, email?: string): string | null {
  const p = String(pw || '');
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (p.length > 100) return 'Password is too long';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Password must contain at least one letter and one number';
  if (COMMON.has(p.toLowerCase())) return 'This password is too common. Choose a different one';
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && p.toLowerCase().includes(local)) return 'Password must not contain your email name';
  return null;
}
