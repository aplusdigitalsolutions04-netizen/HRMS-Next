// Checks what HR typed for a notice and returns clean values (or { error }).
export function cleanAnnouncement(b: any) {
  const title = String(b.title || '').trim().slice(0, 150);
  if (!title) return { error: 'Please write a title' };
  const date = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
  const starts = date(b.starts_on), expires = date(b.expires_on);
  if (starts && expires && expires < starts) return { error: 'The end date is before the start date' };
  return { title, body: String(b.body || '').trim().slice(0, 5000) || null, pinned: b.is_pinned ? 1 : 0, starts, expires };
}
