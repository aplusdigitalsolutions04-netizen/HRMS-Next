// @ts-nocheck
import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { uuidv4 } from './utils';

// A paper attached to a leave request (a medical certificate, for example). It is kept in a private folder that the
// website does not serve; it is only handed out through /api/leave/<id>/document to the people who may see the request.
const DIR = path.join(process.cwd(), 'storage', 'leave-docs');
export const LEAVE_DOC_TYPES: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
export const LEAVE_DOC_MAX = 5 * 1024 * 1024;

export function checkLeaveDoc(file: any): string | null {
  const ext = path.extname(String(file?.name || '')).toLowerCase();
  if (!LEAVE_DOC_TYPES[ext]) return 'The supporting document must be a PDF, JPG or PNG file';
  if ((file.size || 0) > LEAVE_DOC_MAX) return 'The supporting document must be smaller than 5 MB';
  return null;
}

// returns the stored file name (kept in leave_requests.supporting_doc)
export async function saveLeaveDoc(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  const name = `${uuidv4()}${ext}`;
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function readLeaveDoc(stored: string): Promise<{ buf: Buffer; mime: string; name: string } | null> {
  const name = path.basename(String(stored || '')); // never a path
  const ext = path.extname(name).toLowerCase();
  if (!name || !LEAVE_DOC_TYPES[ext]) return null;
  try { return { buf: await readFile(path.join(DIR, name)), mime: LEAVE_DOC_TYPES[ext], name }; } catch { return null; }
}
