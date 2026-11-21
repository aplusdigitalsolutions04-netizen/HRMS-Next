import { withApiLog } from '@/lib/api-log';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, checkPermission } from '@/lib/utils';
import { getTeamOfficeApiUrl, getTeamOfficeApiKey } from '@/lib/teamoffice';

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    if (!checkPermission(user, 'upload_attendance')) {
      return NextResponse.json({ detail: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const empcode = searchParams.get('Empcode') || 'ALL';
    const lastRecord = searchParams.get('LastRecord');

    if (!lastRecord) {
      return NextResponse.json({ Error: true, Msg: 'LastRecord is required' }, { status: 400 });
    }

    const apiKey = await getTeamOfficeApiKey();
    if (!apiKey) {
      return NextResponse.json({ Error: true, Msg: 'E-Timeoffice API key or login details not configured' }, { status: 500 });
    }

    const apiUrl = await getTeamOfficeApiUrl();
    const response = await fetch(`${apiUrl}/DownloadLastPunchData?Empcode=${empcode}&LastRecord=${lastRecord}`, {
      headers: { 'Authorization': `Basic ${apiKey}` }
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ Error: true, Msg: error.message }, { status: 500 });
  }
}

export const GET = withApiLog(GET_handler);
