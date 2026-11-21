// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { previewLetterEmail, sendLetterEmail } from '@/lib/letter-mail';
import { auditFrom } from '@/lib/audit';

// Email a letter that was made to the employee (HR with edit_employee).
//   GET  -> the mail as it will go out: recipients to pick from, subject, text, attached file name
//   POST { to: 'personal' | 'official', subject?, html? } -> sends it (PDF attached) and notes the date on the letter
const gate = async (req: NextRequest): Promise<{ user?: any; res?: Response }> => {
  const u = await getAuthUser(req);
  if (!u) return { res: jsonError('Not authenticated', 401) };
  if (!(u.type === 'admin' && checkPermission(u, 'edit_employee'))) return { res: jsonError('Insufficient permissions', 403) };
  return { user: u };
};

async function GET_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await gate(req); if (g.res) return g.res;
    const { id } = await params;
    const r = await previewLetterEmail(id);
    if (!r.ok) return jsonError(r.message || 'Not found', r.status || 500);
    return jsonSuccess(r);
  } catch (e: any) { return jsonError(e, 500); }
}

async function POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await gate(req); if (g.res) return g.res;
    const user = g.user;
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const r = await sendLetterEmail(id, String(b.to || ''), { id: user.id, type: user.type, email: user.email }, { subject: String(b.subject || '').slice(0, 300), html: String(b.html || '').slice(0, 200000), ...(b.cc !== undefined ? { cc: String(b.cc).slice(0, 1000) } : {}), ...(b.bcc !== undefined ? { bcc: String(b.bcc).slice(0, 1000) } : {}) });
    if (!r.ok) return jsonError(r.message, r.status || 500);
    await auditFrom(user, 'letter_emailed', 'letter', id, { to: String(b.to || '') });
    return jsonSuccess({ message: r.message });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const POST = withApiLog(POST_handler);
