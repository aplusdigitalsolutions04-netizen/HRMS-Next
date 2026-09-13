import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { isDriveConfigured, testDriveConnection } from '@/lib/googleDrive';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.role !== 'ADMIN') return jsonError('Only ADMIN can test the Google Drive connection.', 403);

    if (!isDriveConfigured()) {
      return jsonSuccess({ connected: false, message: 'Google Drive is not configured. Set the required environment variables and restart the server.' });
    }

    try {
      const { folderName } = await testDriveConnection();
      return jsonSuccess({ connected: true, folderName });
    } catch (e: any) {
      return jsonSuccess({ connected: false, message: e?.message || 'Could not reach Google Drive.' });
    }
  } catch (e: any) {
    return jsonError(e, 500);
  }
}
