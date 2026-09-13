import { google } from 'googleapis';
import { Readable } from 'stream';

// Employee documents live in Drive under one folder per employee, named
// "<emp_code> - <full_name>", inside GOOGLE_DRIVE_ROOT_FOLDER_ID.
//
// Two auth methods are supported:
// 1. Service Account (GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) - the target folder
//    (or a Shared Drive) must be shared with the service account's
//    client_email as Editor, since service accounts have no My Drive of
//    their own.
// 2. OAuth2 (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)
//    - acts as the Google account that generated the refresh token, so the
//    folder just needs to belong to (or be shared with) that account.

let driveClient: ReturnType<typeof google.drive> | null = null;
const folderCache = new Map<string, string>();

export function isDriveConfigured(): boolean {
  const hasServiceAccount = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  const hasOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
  return (hasServiceAccount || hasOAuth) && !!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
}

function getDrive() {
  if (driveClient) return driveClient;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    driveClient = google.drive({ version: 'v3', auth: oauth2Client });
    return driveClient;
  }

  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyBase64) throw new Error('Google Drive is not configured: set either GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_KEY_BASE64');
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

export async function testDriveConnection(): Promise<{ folderId: string; folderName: string }> {
  const drive = getDrive();
  const folderId = rootFolderId();

  const res = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, mimeType, trashed',
    supportsAllDrives: true,
  });

  if (res.data.trashed) throw new Error('The configured Drive folder has been moved to trash.');
  if (res.data.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID does not point to a folder.');
  }

  return { folderId: res.data.id as string, folderName: res.data.name as string };
}
