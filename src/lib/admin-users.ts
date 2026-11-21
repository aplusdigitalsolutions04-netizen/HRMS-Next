// @ts-nocheck
import { query } from './db';
import { RowDataPacket } from 'mysql2';
import { ALL_PERMISSIONS } from './permissions';

// The people who sign in to run the system (hr_admins) and the role each one has.
// A role is one of the three built-in ones, or the id of a role made on the Roles page (system_roles).
export const BUILT_IN_ROLES: { id: string; name: string; note: string }[] = [
  { id: 'ADMIN', name: 'Admin', note: 'Everything, always. Cannot be limited.' },
  { id: 'HR', name: 'HR', note: 'HR team. What this person may do is set under Permissions.' },
  { id: 'HR_STAFF', name: 'HR Staff', note: 'Limited HR work. What this person may do is set under Permissions.' },
];
export const isBuiltInRole = (r: string) => BUILT_IN_ROLES.some(b => b.id === r);

// The role as a person reads it: "Admin", "HR Staff" or the name of the custom role. null when there is no such role.
export async function roleName(role: string): Promise<string | null> {
  const b = BUILT_IN_ROLES.find(x => x.id === role);
  if (b) return b.name;
  const r = (await query<RowDataPacket[]>('SELECT name FROM system_roles WHERE id = ?', [role]).catch(() => []))[0];
  return r ? r.name : null;
}

// how many accounts that can sign in are administrators (one account can be left out, for "would this leave nobody?")
export async function activeAdmins(exceptId?: string): Promise<number> {
  const r = (await query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM hr_admins WHERE role = 'ADMIN' AND is_active = 1 AND id <> ?", [exceptId || '']))[0];
  return Number(r?.n || 0);
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// only known permissions, each true or false
export function cleanPermissions(raw: any): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const k of Object.keys(raw)) if (ALL_PERMISSIONS[k]) out[k] = raw[k] === true;
  return out;
}

// a role made on the Roles page cannot be called by the name of a built-in one
export const isReservedRoleName = (n: string) => ['admin', 'hr', 'hr staff', 'hr_staff', 'user'].includes(String(n || '').trim().toLowerCase());
