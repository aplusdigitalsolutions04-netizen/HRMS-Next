// @ts-nocheck
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, now } from '@/lib/utils';
import { execute } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    const { id } = await params;
    const body = await req.json();

    await execute(
      `UPDATE interview_details SET apply_post=?, interview_round=?, interview_date=?, interview_mode=?, interview_link=?, status=?, remarks=?, comments=?, updated_on=? WHERE id=?`,
      [body.apply_post || '', body.interview_round || 1, body.interview_date || null, body.interview_mode || '', body.interview_link || '', body.status || 'Scheduled', body.remarks || '', body.comments || '', now(), id]
    );

    return jsonSuccess({ success: true, id });
  } catch (e: any) { return jsonError(e, 500); }
}
