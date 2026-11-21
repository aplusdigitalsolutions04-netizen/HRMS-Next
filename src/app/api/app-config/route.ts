// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess } from '@/lib/utils';
import { getConfig } from '@/lib/app-config';

// What the browser needs to format money and dates and to check files before sending them (public: the registration page uses it before sign-in; nothing private is in it).
async function GET_handler(req: NextRequest) {
  try {
    const c = await getConfig();
    const pick = ['currency_symbol', 'locale', 'upload_shrink_above_mb', 'upload_one_file_mb', 'upload_total_mb', 'register_photo_kb', 'register_pdf_mb', 'register_doc_mb', 'upload_max_mb', 'leave_doc_max_mb', 'app_short_name'];
    return jsonSuccess(Object.fromEntries(pick.map(k => [k, c[k]])));
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
