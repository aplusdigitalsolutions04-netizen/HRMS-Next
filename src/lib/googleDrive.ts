import { google } from 'googleapis';
import { Readable } from 'stream';

// Employee documents live in Drive under one folder per employee, named
// "<emp_code> - <full_name>", inside GOOGLE_DRIVE_ROOT_FOLDER_ID. Auth is a
// Service Account (no per-user OAuth flow) - that folder (or a Shared Drive)
// must be shared with the service account's client_email as Editor, since
// service accounts have no My Drive storage of their own.

let driveClient: ReturnType<typeof google.drive> | null = null;
const folderCache = new Map<string, string>();

export function isDriveConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
}

function getDrive() {
  if (driveClient) return driveClient;
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is not configured');
  const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/drive'] });
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

function rootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured');
  return id;
}

async function findFolder(name: string, parentId: string): Promise<string | null> {
  const drive = getDrive();
  const safeName = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id || null;
}

async function createFolder(name: string, parentId: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return res.data.id as string;
}

export async function getEmployeeFolderId(empCode: string, employeeName?: string): Promise<string> {
  const cached = folderCache.get(empCode);
  if (cached) return cached;

  const folderName = employeeName ? `${empCode} - ${employeeName}` : empCode;
  const parentId = rootFolderId();
  let folderId = await findFolder(folderName, parentId);
  if (!folderId) folderId = await createFolder(folderName, parentId);
  folderCache.set(empCode, folderId);
  return folderId;
}

export async function uploadFileToDrive(folderId: string, fileName: string, buffer: Buffer, mimeType: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from(buffer) },
    fields: 'id',
    supportsAllDrives: true,
  });
  return res.data.id as string;
}

export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId, supportsAllDrives: true }).catch(() => {});
}
