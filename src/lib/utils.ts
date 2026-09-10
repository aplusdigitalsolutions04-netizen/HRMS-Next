import { NextResponse } from 'next/server';
import { authUserFromToken, AuthUser } from './auth';
import { execute } from './db';

export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function createNotification(title: string, message: string, category: string, referenceId: string | null, isCompanyWide: boolean, userId: string | null) {
  try {
    await execute(
      `INSERT INTO notifications (title, message, category, reference_id, is_read, created_at, user_id, is_company_wide) VALUES (?,?,?,?,0,NOW(),?,?)`,
      [title, message, category, referenceId || null, userId, isCompanyWide ? 1 : 0]
    );
  } catch (e: any) {
    console.error('[createNotification] Failed:', e?.message || e);
  }
}

export function sanitizeFilename(name: string): string {
  return require('path').basename(name).replace(/[^\w\.\- ]/g, '_');
}

export function parsePagination(searchParams: URLSearchParams, defaultPerPage = 20, maxPerPage = 100): { page: number; perPage: number; offset: number } {
  let page = parseInt(searchParams.get('page') || '1');
  if (!Number.isFinite(page) || page < 1) page = 1;
  let perPage = parseInt(searchParams.get('per_page') || String(defaultPerPage));
  if (!Number.isFinite(perPage) || perPage < 1) perPage = defaultPerPage;
  perPage = Math.min(perPage, maxPerPage);
  return { page, perPage, offset: (page - 1) * perPage };
}

export function now(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function jsonError(e: any, status = 400) {
  const message = e?.message || e?.code || (e?.errors?.map((x: any) => x.message).join('; ')) || e || 'Server error';
  return NextResponse.json({ detail: message }, { status });
}

export function jsonSuccess(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function parseBody(req: Request): Promise<any> {
  return req.json();
}

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return authUserFromToken(auth.slice(7));
}

export function requireRole(user: AuthUser | null, roles: string[]): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return roles.includes(user.role);
}

export function checkPermission(user: AuthUser | null, perm: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  return user.permissions?.[perm] === true;
}

export async function getAdminUser(req: Request): Promise<AuthUser | null> {
  const user = await getAuthUser(req);
  if (!user || user.type !== 'admin') return null;
  return user;
}

export function splitEmails(val: string | null | undefined): string[] {
  if (!val) return [];
  return val.split(',').map(e => e.trim()).filter(Boolean);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function calcHours(inTime: string | null | undefined, outTime: string | null | undefined): string {
  if (!inTime || !outTime) return '0.0';
  const toMins = (t: string): number | null => {
    if (!t || ['--:--','---',''].includes(t.trim())) return null;
    let s = t.trim().toUpperCase();
    let pm = false;
    if (s.endsWith('AM')) { s = s.slice(0, -2).trim(); }
    else if (s.endsWith('PM')) { s = s.slice(0, -2).trim(); pm = true; }
    s = s.replace(/[^0-9:]/g, '');
    const parts = s.split(':');
    if (parts.length < 2) return null;
    let h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + m;
  };
  const inMins = toMins(inTime);
  const outMins = toMins(outTime);
  if (inMins === null || outMins === null) return '0.0';
  let diff = outMins - inMins;
  if (diff < 0) diff += 1440;
  return (diff / 60).toFixed(1);
}
