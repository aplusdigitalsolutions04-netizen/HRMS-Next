// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { getPrefs, savePrefs, NOTIF_GROUPS } from '@/lib/preferences';

// The signed-in person's own settings (HR and employees alike). Nobody can read or change anyone else's.
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    return jsonSuccess({ prefs: await getPrefs(user), groups: Object.entries(NOTIF_GROUPS).map(([key, g]) => ({ key, label: g.label, hint: g.hint })) });
  } catch (e: any) { return jsonError(e, 500); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const body = await req.json();
    return jsonSuccess({ prefs: await savePrefs(user, body), message: 'Saved' });
  } catch (e: any) { return jsonError(e, 500); }
}
