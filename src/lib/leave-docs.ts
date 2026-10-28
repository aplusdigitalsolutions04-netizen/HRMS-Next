// @ts-nocheck
import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { uuidv4 } from './utils';
import { saveToDriveFolder, downloadFileFromDrive, getDriveFileMeta, driveErrorMessage } from './googleDrive';

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

// The file goes to Google Drive (folder "Leave Documents"); "drive:<id>" is kept in leave_requests.supporting_doc.
export async function saveLeaveDoc(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  try {
    return await saveToDriveFolder('Leave Documents', `${uuidv4()}${ext}`, Buffer.from(await file.arrayBuffer()), LEAVE_DOC_TYPES[ext] || 'application/octet-stream');
  } catch (e: any) {
    throw new Error(driveErrorMessage(e) || e?.message || 'The document could not be saved on Google Drive');
  }
}

export async function readLeaveDoc(stored: string): Promise<{ buf: Buffer; mime: string; name: string } | null> {
  if (/^drive:[A-Za-z0-9_-]+$/.test(String(stored || ''))) {
    try {
      const id = String(stored).slice(6);
      const [buf, meta] = await Promise.all([downloadFileFromDrive(id), getDriveFileMeta(id)]);
      return { buf, mime: meta.mimeType || 'application/octet-stream', name: meta.name || 'leave-document' };
    } catch { return null; }
  }
  // older documents kept in the private folder on the server
  const name = path.basename(String(stored || '')); // never a path
  const ext = path.extname(name).toLowerCase();
  if (!name || !LEAVE_DOC_TYPES[ext]) return null;
  try { return { buf: await readFile(path.join(DIR, name)), mime: LEAVE_DOC_TYPES[ext], name }; } catch { return null; }
}
