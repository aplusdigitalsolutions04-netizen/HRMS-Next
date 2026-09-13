import { google } from 'googleapis';
import { Readable } from 'stream';
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';

// Employee documents live in Drive under one folder per employee, named
// "<emp_code> - <full_name>", inside GOOGLE_DRIVE_ROOT_FOLDER_ID.
//
// Two auth methods are supported:
// 1. Service Account (GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) - the target folder
//    (or a Shared Drive) must be shared with the service account's
//    client_email as Editor, since service accounts have no My Drive of
//    their own.
// 2. OAuth2 (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, refresh token) - acts
//    as the Google account that connected via Settings > Google Drive, so
//    the folder just needs to belong to (or be shared with) that account.
//    The refresh token is stored in the google_drive_auth table (not
//    .env.local) so connecting from Settings takes effect immediately, with
//    no server restart - important on hosts where the app process can't
//    rewrite its own .env file or restart itself. GOOGLE_REFRESH_TOKEN in
//    the env is still honored as a fallback for a manually-configured token.

let driveClient: ReturnType<typeof google.drive> | null = null;
const folderCache = new Map<string, string>();

let authTableEnsured = false;
async function ensureAuthTable() {
  if (authTableEnsured) return;
  await execute(`
    CREATE TABLE IF NOT EXISTS google_drive_auth (
      id INT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  authTableEnsured = true;
}

// Short-lived cache, same tradeoff as other lookup caches in this codebase -
// avoids a DB round trip on every single Drive call.
let cachedToken: { value: string | null; expiresAt: number } = { value: null, expiresAt: 0 };

async function getStoredRefreshToken(): Promise<string | null> {
  if (cachedToken.expiresAt > Date.now()) return cachedToken.value;
  await ensureAuthTable();
  const rows = await query<RowDataPacket[]>('SELECT refresh_token FROM google_drive_auth WHERE id = 1');
  const value = rows[0]?.refresh_token || process.env.GOOGLE_REFRESH_TOKEN || null;
  cachedToken = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export async function saveRefreshToken(token: string): Promise<void> {
  await ensureAuthTable();
  await execute(
    'INSERT INTO google_drive_auth (id, refresh_token) VALUES (1, ?) ON DUPLICATE KEY UPDATE refresh_token = VALUES(refresh_token)',
    [token]
  );
  cachedToken = { value: token, expiresAt: Date.now() + 30_000 };
  driveClient = null; // force re-creation with the new token on next use
}

export function isOAuthClientConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function isDriveConfigured(): Promise<boolean> {
  if (!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID) return false;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) return true;
  if (isOAuthClientConfigured() && (await getStoredRefreshToken())) return true;
  return false;
}

function getRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
}

async function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials are not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)');
  }
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
  const refreshToken = await getStoredRefreshToken();
  if (refreshToken) oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return oAuth2Client;
}

export async function getAuthUrl(): Promise<string> {
  const oAuth2Client = await getOAuthClient();
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oAuth2Client = await getOAuthClient();
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

async function getDrive() {
  if (driveClient) return driveClient;

  if (isOAuthClientConfigured()) {
    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) {
      driveClient = google.drive({ version: 'v3', auth: await getOAuthClient() });
      return driveClient;
    }
  }

  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!keyBase64) throw new Error('Google Drive is not authorized yet. Connect an account from Settings > Google Drive, or configure GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.');
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
  const drive = await getDrive();
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
  const drive = await getDrive();
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
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from(buffer) },
    fields: 'id',
    supportsAllDrives: true,
  });
  return res.data.id as string;
}

export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = await getDrive();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function getDriveFileMeta(fileId: string): Promise<{ name: string; mimeType: string }> {
  const drive = await getDrive();
  const res = await drive.files.get({ fileId, fields: 'name, mimeType', supportsAllDrives: true });
  return { name: res.data.name as string, mimeType: res.data.mimeType as string };
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = await getDrive();
  await drive.files.delete({ fileId, supportsAllDrives: true }).catch(() => {});
}

export async function testDriveConnection(): Promise<{ folderId: string; folderName: string }> {
  const drive = await getDrive();
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
