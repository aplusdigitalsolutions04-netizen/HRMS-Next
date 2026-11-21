// @ts-nocheck
import { parseAddressList } from './request-mail';

// The people a template always copies (Settings > Email Templates > Always CC / Always BCC). Each address is checked; the saved text is
// one clean comma list (or null when empty).
export function templateAddresses(body: any): { cc: string | null; bcc: string | null; error?: string } {
  const one = (v: any, label: string) => {
    const p = parseAddressList(v);
    if (p.bad) return { err: `"${p.bad}" in ${label} is not a valid email address.` };
    return { val: p.list.length ? p.list.join(',') : null };
  };
  const c = one(body.cc_emails, 'Always CC'), b = one(body.bcc_emails, 'Always BCC');
  if (c.err || b.err) return { cc: null, bcc: null, error: c.err || b.err };
  return { cc: c.val, bcc: b.val };
}
