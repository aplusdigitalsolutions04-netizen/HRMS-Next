// @ts-nocheck
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, execute } from './db';
import { employeeCodes, inList } from './status-master';
import { getConfig } from './app-config';
import { validatePassword } from './password-policy';
import { recordLogin, sessionRevoked } from './login-history';
import { RowDataPacket } from 'mysql2';

function randomIndex(max: number): number {
  return crypto.randomInt(0, max);
}

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error('JWT_SECRET environment variable is not set. Refusing to start with an insecure default secret.');
  }
  return s;
}
// a login lasts one working day, not longer
// How long a sign-in lasts is set in Settings > Rules & Limits; applySessionConfig() reads it before a token is made.
let sessionMinutes = 60 * 8;
export async function applySessionConfig() { sessionMinutes = Math.max(1, Math.round((await getConfig()).session_hours * 60)); }

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  type: 'admin' | 'employee';
  must_change_password?: boolean;
  // fingerprint of the password the token was made with: changing the password makes every older token useless
  pf?: string;
  // id of the login_history row of this sign-in; ending that session makes the token useless
  sid?: string;
  iat?: number;
  exp?: number;
}

export function passwordFingerprint(hashed: string): string {
  return crypto.createHmac('sha256', getSecret()).update(String(hashed || '')).digest('hex').slice(0, 16);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

// A password copied out of a mail often brings a space or an invisible character along at either end. When the exact text
// does not match, the text without those is tried too. Used for login only.
const EDGE_JUNK = /^[\s\u00a0\u200b-\u200d\u2060\ufeff]+|[\s\u00a0\u200b-\u200d\u2060\ufeff]+$/g;
export function verifyLoginPassword(plain: string, hashed: string): boolean {
  if (bcrypt.compareSync(plain, hashed)) return true;
  const cleaned = String(plain).replace(EDGE_JUNK, '');
  return cleaned.length > 0 && cleaned !== plain && bcrypt.compareSync(cleaned, hashed);
}

export function createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret(), { algorithm: 'HS256', expiresIn: sessionMinutes * 60 });
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return null;
  }
}

// Short-lived, purpose-scoped tokens for flows that need to prove "this
// request continues one a specific admin started" without a real session
// cookie - e.g. an OAuth `state` param, so the callback can't be replayed by
// an unrelated request carrying someone else's authorization `code`. Kept
// separate from createToken/decodeToken (which mint full, long-lived login
// sessions) so a leaked state value can't be mistaken for a session token.
export function signPurposeToken(purpose: string, subject: string, expiresInSeconds = 600): string {
  return jwt.sign({ purpose, sub: subject }, getSecret(), { algorithm: 'HS256', expiresIn: expiresInSeconds });
}

export function verifyPurposeToken(token: string, purpose: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as { purpose?: string; sub?: string };
    if (payload.purpose !== purpose || !payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export function generateTempPassword(length = 12): string {
  // no letters or digits that look alike (I l 1, O o 0): a password read off a mail or a screen is often typed wrong otherwise
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const chars: string[] = [];
  chars.push(upper[randomIndex(upper.length)]);
  chars.push(lower[randomIndex(lower.length)]);
  chars.push(digits[randomIndex(digits.length)]);
  chars.push(special[randomIndex(special.length)]);
  for (let i = 0; i < length - 4; i++) {
    chars.push(all[randomIndex(all.length)]);
  }
  // Fisher-Yates shuffle using a CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

interface HrAdminRow extends RowDataPacket {
  id: string;
  email: string;
  password: string;
  role: string;
  full_name?: string;
  mobile_no?: string;
  department?: string;
  designation?: string;
  profile_photo?: string;
  last_login?: Date;
  is_active?: number;
  permissions?: string;
  must_change_password?: number;
}

interface EmployeeRow extends RowDataPacket {
  id: string;
  emp_code: string;
  email_id: string;
  password: string;
  full_name?: string;
  status: string;
  hr_remarks?: string;
  profile_photo?: string;
  last_login?: Date;
  must_change_password?: number;
  designation?: string;
  mobile_no?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  role_id?: string;   // the id of the role made on the Roles page, when the person has one
  role_name?: string;
  type: 'admin' | 'employee';
  profile_photo?: string;
  last_login?: Date;
  must_change_password?: boolean;
  permissions?: Record<string, boolean>;
  emp_code?: string;
  mobile_no?: string;
  designation?: string;
  department?: string;
  status?: string;
  hr_remarks?: string;
}

// Permissions come as text (hr_admins.permissions) or already as an object (system_roles.permissions is a JSON column, which the
// database driver reads into an object), and some were once saved as a list of names.
function parsePermissions(raw: any): Record<string, boolean> {
  if (!raw) return {};
  let v = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return {}; } }
  if (Array.isArray(v)) { const o: Record<string, boolean> = {}; v.forEach(k => { if (typeof k === 'string') o[k] = true; }); return o; }
  return v && typeof v === 'object' ? v : {};
}

// What an administrator account may do. A role made on the Roles page gives its permissions, and the person is treated as HR staff
// everywhere a role is checked (the role id is kept in role_id and its name in role_name). Permissions saved for the person on
// their own are added on top of the role's.
async function adminAccess(a: HrAdminRow): Promise<{ role: string; role_id?: string; role_name?: string; permissions: Record<string, boolean> }> {
  let rolePerms: Record<string, boolean> = {};
  let role = a.role || 'HR_STAFF', roleId: string | undefined, roleName: string | undefined;
  if (a.role && !['ADMIN', 'HR', 'HR_STAFF'].includes(a.role)) {
    const roles = await query<RowDataPacket[]>('SELECT name, permissions FROM system_roles WHERE id = ?', [a.role]).catch(() => []);
    if (roles.length > 0) {
      rolePerms = parsePermissions(roles[0].permissions);
      role = 'HR_STAFF'; roleId = a.role; roleName = roles[0].name;
    }
  }
  return { role, role_id: roleId, role_name: roleName, permissions: { ...rolePerms, ...parsePermissions(a.permissions) } };
}

export async function authUserFromToken(token: string): Promise<AuthUser | null> {
  const payload = decodeToken(token);
  if (!payload) return null;
  if (payload.sid && await sessionRevoked(payload.sid)) return null;
  if (payload.type === 'admin') {
    const admins = await query<HrAdminRow[]>('SELECT * FROM hr_admins WHERE id = ?', [payload.sub]);
    if (admins.length === 0) return null;
    const a = admins[0];
    if (!a.is_active || payload.pf !== passwordFingerprint(a.password)) return null;
    
    const acc = await adminAccess(a);

    return {
      id: a.id,
      email: a.email,
      name: a.full_name || a.email,
      role: acc.role,
      role_id: acc.role_id,
      role_name: acc.role_name,
      type: 'admin',
      profile_photo: a.profile_photo,
      last_login: a.last_login,
      must_change_password: !!a.must_change_password,
      permissions: acc.permissions,
    };
  } else {
    const emps = await query<EmployeeRow[]>('SELECT * FROM employees WHERE id = ? AND is_deleted = 0', [payload.sub]);
    if (emps.length === 0) return null;
    const e = emps[0];
    if (payload.pf !== passwordFingerprint(e.password)) return null;
    // someone who has left (status Dropped, or any status that may not log in) loses an open session at once
    const loginOk = await employeeCodes('can_login');
    if (loginOk.length > 0 && !loginOk.includes(e.status)) return null;
    return {
      id: e.id,
      email: e.email_id,
      name: e.full_name || e.email_id,
      role: 'USER',
      type: 'employee',
      profile_photo: e.profile_photo,
      last_login: e.last_login,
      must_change_password: !!e.must_change_password,
      emp_code: e.emp_code,
      mobile_no: e.mobile_no,
      designation: e.designation,
    };
  }
}

export async function authenticateUser(email: string, password: string, type: 'admin' | 'employee', meta?: { ip?: string; ua?: string }): Promise<{ user: AuthUser; token: string } | null> {
  if (type === 'admin') {
    const admins = await query<HrAdminRow[]>('SELECT * FROM hr_admins WHERE LOWER(email) = LOWER(?)', [email]);
    if (admins.length === 0) return null;
    const a = admins[0];
    if (!verifyLoginPassword(password, a.password)) return null;
    if (!a.is_active) return null;
    // a password that breaks the password rules (such as 123456) has to be changed at this login
    const mustChange = !!a.must_change_password || (await validatePassword(password, a.email)) !== null;
    if (mustChange && !a.must_change_password) await execute('UPDATE hr_admins SET must_change_password = 1 WHERE id = ?', [a.id]);
    await applySessionConfig();
    const sid = crypto.randomUUID();
    const acc = await adminAccess(a);
    const token = createToken({ sub: a.id, email: a.email, role: acc.role, type: 'admin', must_change_password: mustChange, pf: passwordFingerprint(a.password), sid });
    await recordLogin({ sid, userType: 'admin', userId: a.id, email: a.email, ip: meta?.ip || '', ua: meta?.ua || '', expiresAt: new Date(Date.now() + sessionMinutes * 60000) });
    await execute('UPDATE hr_admins SET last_login = NOW() WHERE id = ?', [a.id]);
    return {
      user: {
        id: a.id, email: a.email, name: a.full_name || a.email,
        role: acc.role, role_id: acc.role_id, role_name: acc.role_name, type: 'admin',
        profile_photo: a.profile_photo, last_login: new Date(),
        must_change_password: mustChange,
        permissions: acc.permissions,
      },
      token,
    };
  } else {
    // 'invited'/'pending'/'needs_correction' can still log in - the frontend
    // gates what they see (complete-profile form / "under review" screen)
    // based on status, rather than blocking the login itself. 'dropped' and
    // anything else stays blocked.
    // Which statuses may log in is set in Settings > Status Master (Can log in).
    const loginable = inList(await employeeCodes('can_login'));
    const emps = await query<EmployeeRow[]>(
      `SELECT * FROM employees WHERE LOWER(email_id) = LOWER(?) AND is_deleted = 0 AND status IN ${loginable.sql}`,
      [email, ...loginable.params]
    );
    if (emps.length === 0) return null;
    // Two employee records can carry the same email (a re-invite, an old copy). The one whose password matches is the one logging
    // in, instead of always the first record found.
    const e = emps.find(x => verifyLoginPassword(password, x.password));
    if (!e) return null;
    const mustChange = !!e.must_change_password || (await validatePassword(password, e.email_id)) !== null;
    if (mustChange && !e.must_change_password) await execute('UPDATE employees SET must_change_password = 1 WHERE id = ?', [e.id]);
    e.must_change_password = mustChange ? 1 : 0;
    await applySessionConfig();
    const sid = crypto.randomUUID();
    const token = createToken({
      sub: e.id, email: e.email_id, role: 'USER', type: 'employee',
      must_change_password: mustChange, pf: passwordFingerprint(e.password), sid,
    });
    await recordLogin({ sid, userType: 'employee', userId: e.id, email: e.email_id, ip: meta?.ip || '', ua: meta?.ua || '', expiresAt: new Date(Date.now() + sessionMinutes * 60000) });
    await execute('UPDATE employees SET last_login = NOW() WHERE id = ?', [e.id]);
    return {
      user: {
        id: e.id, email: e.email_id, name: e.full_name || e.email_id,
        role: 'USER', type: 'employee',
        profile_photo: e.profile_photo, last_login: new Date(),
        must_change_password: !!e.must_change_password,
        emp_code: e.emp_code, mobile_no: e.mobile_no, designation: e.designation,
        status: e.status, hr_remarks: e.hr_remarks,
      },
      token,
    };
  }
}

