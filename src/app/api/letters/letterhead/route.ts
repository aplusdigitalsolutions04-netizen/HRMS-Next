// @ts-nocheck
import { withApiLog } from '@/lib/api-log';
import { NextRequest } from 'next/server';
import { getAuthUser, jsonError, jsonSuccess, checkPermission } from '@/lib/utils';
import { query, execute } from '@/lib/db';
import { getLetterhead } from '@/lib/letters';
import { auditFrom } from '@/lib/audit';

// The letterhead of the letters. GET gives the saved setting; PUT { mode, image?, top_mm, bottom_mm } saves it.
// placement: "auto" (by the shape of the picture), "top" or "bottom" (a strip across the page), "full" (the whole page).
// mode: "company" (logo, name and address from Company Settings), "image" (HR's own letterhead, an A4 picture behind every page)
// or "none" (blank space at the top, for paper that is already printed).
const IMAGE = /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE = 5 * 1024 * 1024;

async function GET_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'view_employees')) return jsonError('Insufficient permissions', 403);
    const lh = await getLetterhead();
    const meta = (await query('SELECT updated_by, updated_at FROM letterhead_settings WHERE id = 1').catch(() => []))[0] || {};
    return jsonSuccess({ ...lh, updated_by: meta.updated_by || null, updated_at: meta.updated_at || null });
  } catch (e: any) { return jsonError(e, 500); }
}

async function PUT_handler(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError('Not authenticated', 401);
    if (user.type !== 'admin' || !checkPermission(user, 'edit_employee')) return jsonError('Insufficient permissions', 403);
    const b = await req.json().catch(() => ({}));
    const cur = await getLetterhead();
    const mode = ['company', 'image', 'none'].includes(b.mode) ? b.mode : null;
    if (!mode) return jsonError('Choose how the letters get their header', 422);
    const placement = ['auto', 'top', 'bottom', 'full'].includes(b.placement) ? b.placement : cur.placement;
    const top = Math.round(Number(b.top_mm)), bottom = Math.round(Number(b.bottom_mm));
    if (!(top >= 0 && top <= 120)) return jsonError('The space at the top must be between 0 and 120 mm', 422);
    if (!(bottom >= 0 && bottom <= 80)) return jsonError('The space at the bottom must be between 0 and 80 mm', 422);
    // image: not sent = keep, "" = remove, a picture = replace
    let image = cur.image;
    if (b.image !== undefined) {
      if (b.image === '' || b.image === null) image = '';
      else if (typeof b.image === 'string' && IMAGE.test(b.image)) {
        if (b.image.length > MAX_IMAGE) return jsonError('The letterhead image is too big. Keep it under 3 MB.', 422);
        image = b.image;
      } else return jsonError('The letterhead must be a PNG or JPG picture', 422);
    }
    if (mode === 'image' && !image) return jsonError('Upload the letterhead image first', 422);
    await execute(
      `INSERT INTO letterhead_settings (id, mode, image, placement, top_mm, bottom_mm, updated_by, updated_at) VALUES (1,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE mode = VALUES(mode), image = VALUES(image), placement = VALUES(placement), top_mm = VALUES(top_mm), bottom_mm = VALUES(bottom_mm), updated_by = VALUES(updated_by), updated_at = NOW()`,
      [mode, image || null, placement, top, bottom, user.email || String(user.id)]);
    await auditFrom(user, 'letterhead_changed', 'settings', 'letterhead', { mode, placement, top_mm: top, bottom_mm: bottom, image: image ? '(image)' : '' });
    return jsonSuccess({ message: 'Letterhead saved' });
  } catch (e: any) { return jsonError(e, 500); }
}

export const GET = withApiLog(GET_handler);
export const PUT = withApiLog(PUT_handler);
