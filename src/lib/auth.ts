// @ts-nocheck
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, execute } from './db';
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
const EXPIRE_MINUTES = 60 * 24;

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  type: 'admin' | 'employee';
  must_change_password?: boolean;
  iat?: number;
  exp?: number;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

export function createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret(), { algorithm: 'HS256', expiresIn: EXPIRE_MINUTES * 60 });
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return null;
  }
}

export function generateTempPassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
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
  type: 'admin' | 'employee';
  profile_photo?: string;
  last_login?: Date;
  must_change_password?: boolean;
  permissions?: Record<string, boolean>;
  emp_code?: string;
  mobile_no?: string;
  designation?: string;
  department?: string;
}

function parsePermissions(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function authUserFromToken(token: string): Promise<AuthUser | null> {
  const payload = decodeToken(token);
  if (!payload) return null;
  if (payload.type === 'admin') {
    const admins = await query<HrAdminRow[]>('SELECT * FROM hr_admins WHERE id = ?', [payload.sub]);
    if (admins.length === 0) return null;
    const a = admins[0];
    
    let rolePerms: Record<string, boolean> = {};
    if (a.role && a.role !== 'ADMIN') {
      const roles = await query<RowDataPacket[]>('SELECT permissions FROM system_roles WHERE id = ?', [a.role]).catch(() => []);
      if (roles.length > 0 && roles[0].permissions) {
        rolePerms = parsePermissions(roles[0].permissions);
      }
    }
    const finalPerms = { ...rolePerms, ...parsePermissions(a.permissions) };

    return {
      id: a.id,
      email: a.email,
      name: a.full_name || a.email,
      role: a.role || 'HR_STAFF',
      type: 'admin',
      profile_photo: a.profile_photo,
      last_login: a.last_login,
      permissions: finalPerms,
    };
  } else {
    const emps = await query<EmployeeRow[]>('SELECT * FROM employees WHERE id = ?', [payload.sub]);
    if (emps.length === 0) return null;
    const e = emps[0];
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

export async function authenticateUser(email: string, password: string, type: 'admin' | 'employee'): Promise<{ user: AuthUser; token: string } | null> {
  if (type === 'admin') {
    const admins = await query<HrAdminRow[]>('SELECT * FROM hr_admins WHERE email = ?', [email]);
    if (admins.length === 0) return null;
    const a = admins[0];
    if (!verifyPassword(password, a.password)) return null;
    if (!a.is_active) return null;
    const token = createToken({ sub: a.id, email: a.email, role: a.role || 'HR_STAFF', type: 'admin' });
    await execute('UPDATE hr_admins SET last_login = NOW() WHERE id = ?', [a.id]);
    return {
      user: {
        id: a.id, email: a.email, name: a.full_name || a.email,
        role: a.role || 'HR_STAFF', type: 'admin',
        profile_photo: a.profile_photo, last_login: new Date(),
        permissions: parsePermissions(a.permissions),
      },
      token,
    };
  } else {
    const emps = await query<EmployeeRow[]>('SELECT * FROM employees WHERE email_id = ? AND status = ?', [email, 'active']);
    if (emps.length === 0) return null;
    const e = emps[0];
    if (!verifyPassword(password, e.password)) return null;
    const token = createToken({
      sub: e.id, email: e.email_id, role: 'USER', type: 'employee',
      must_change_password: !!e.must_change_password,
    });
    await execute('UPDATE employees SET last_login = NOW() WHERE id = ?', [e.id]);
    return {
      user: {
        id: e.id, email: e.email_id, name: e.full_name || e.email_id,
        role: 'USER', type: 'employee',
        profile_photo: e.profile_photo, last_login: new Date(),
        must_change_password: !!e.must_change_password,
        emp_code: e.emp_code, mobile_no: e.mobile_no, designation: e.designation,
      },
      token,
    };
  }
}

