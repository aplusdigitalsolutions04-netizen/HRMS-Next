import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { isDriveConfigured, findDuplicateFolders, mergeDuplicateFolders, driveErrorMessage } from '@/lib/googleDrive';
import { auditFrom } from '@/lib/audit';

// ADMIN only. GET lists employee folders that exist more than once; POST merges them (files moved into one folder, the emptied
// extra folders put in the Drive trash).
async function admin(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return { err: jsonError('Not authenticated', 401) };
  if (user.role !== 'ADMIN') return { err: jsonError('Only ADMIN can tidy the Google Drive folders.', 403) };
  if (!(await isDriveConfigured())) return { err: jsonError('Google Drive is not connected.', 400) };
  return { user };
}

export async function GET(req: NextRequest) {
  try {
    const a = await admin(req);
    if (a.err) return a.err;
    return jsonSuccess({ groups: await findDuplicateFolders() });
  } catch (e: any) {
    return jsonError(driveErrorMessage(e) || e, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const a = await admin(req);
    if (a.err) return a.err;
    const body = await req.json().catch(() => ({}));
    const key = body && body.key ? String(body.key) : undefined; // one employee code, or everything when empty
    const r = await mergeDuplicateFolders(key);
    await auditFrom(a.user as any, 'drive_folders_merged', 'settings', 'google-drive', { ...r, only: key || null });
    return jsonSuccess({ ...r, message: `Merged ${r.groups} employee folder${r.groups === 1 ? '' : 's'}: ${r.filesMoved} file${r.filesMoved === 1 ? '' : 's'} moved, ${r.foldersTrashed} extra folder${r.foldersTrashed === 1 ? '' : 's'} put in the Drive trash.` });
  } catch (e: any) {
    return jsonError(driveErrorMessage(e) || e, 500);
  }
}
