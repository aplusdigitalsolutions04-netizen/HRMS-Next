import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { isDriveConfigured, testDriveConnection } from '@/lib/googleDrive';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.role !== 'ADMIN') return jsonError('Only ADMIN can test the Google Drive connection.', 403);

    if (!(await isDriveConfigured())) {
      return jsonSuccess({ connected: false, message: 'Google Drive is not connected. Click "Connect Google Account" below, or configure GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.', needsAuth: true });
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
