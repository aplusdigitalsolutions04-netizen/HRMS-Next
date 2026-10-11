// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { DOC_OPTIONS } from './documents';

// An employee can see the documents they uploaded, but cannot upload any document - a new one or a replacement - until HR
// allows it. HR allows one document at a time and the permission is used up by the next upload. The exception is
// "Additional documents" (extra papers): that permission stays until HR takes it back, because several files go in together.

export const DOC_KEYS = DOC_OPTIONS.map(d => d.key);
export const PERMISSION_KEYS = [...DOC_KEYS, 'Additional'];
export const docLabel = (key: string) => (key === 'Additional' ? 'Additional documents' : (DOC_OPTIONS.find(d => d.key === key) || { label: key }).label);

export interface DocSlot { key: string; label: string; filled: boolean; waiting: boolean; permission: 'none' | 'requested' | 'granted'; }

export async function documentSlots(employeeId: string): Promise<DocSlot[]> {
  const emp = (await query<RowDataPacket[]>('SELECT * FROM employees WHERE id = ?', [employeeId]))[0] || {};
  const rows = await query<RowDataPacket[]>("SELECT document_type, action FROM document_approvals WHERE employee_id = ? AND action IN ('pending','approved')", [employeeId]);
  const perms = await query<RowDataPacket[]>('SELECT document_type, status FROM document_reupload_permissions WHERE employee_id = ?', [employeeId]);
  const slots = DOC_OPTIONS.map(d => {
    const mine = rows.filter(r => r.document_type === d.key);
    const waiting = mine.some(r => r.action === 'pending');
    const filled = !!emp[d.column] || mine.length > 0;
    const p = perms.find(x => x.document_type === d.key);
    return { key: d.key, label: d.label, filled, waiting, permission: (p ? (p.status === 'granted' ? 'granted' : 'requested') : 'none') as DocSlot['permission'] };
  });
  const ap = perms.find(x => x.document_type === 'Additional');
  slots.push({ key: 'Additional', label: 'Additional documents', filled: false, waiting: false, permission: ap ? (ap.status === 'granted' ? 'granted' : 'requested') : 'none' });
  return slots;
}

export async function canUploadDocument(employeeId: string, key: string): Promise<{ ok: boolean; reason?: string; usesPermission?: boolean }> {
  if (!PERMISSION_KEYS.includes(key)) return { ok: false, reason: 'Unknown document type' };
  const s = (await documentSlots(employeeId)).find(x => x.key === key)!;
  if (s.waiting) return { ok: false, reason: 'This document is already waiting for HR approval' };
  if (s.permission === 'granted') return { ok: true, usesPermission: true };
  return { ok: false, reason: s.filled ? `You have already uploaded ${s.label}. Ask HR for permission to upload it again.` : `HR has to allow you to upload ${s.label} first. Ask HR for permission.` };
}

export async function usePermission(employeeId: string, key: string) {
  await execute('DELETE FROM document_reupload_permissions WHERE employee_id = ? AND document_type = ?', [employeeId, key]);
}
