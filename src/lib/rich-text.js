// Plain words typed by HR (a notice, a message) shown on a page: new lines stay, and links can be clicked.
// Typed as [words](address) it is a link with those words; a bare web or email address is a link too. Everything else is shown as text.
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NAMED = /\[([^\]\r\n<>]{1,120})\]\(\s*((?:https?:\/\/|www\.|mailto:)[^\s)<>"]+)\s*\)/gi;
const BARE = /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>"')]+[^\s<>"').,;:!?])|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
const href = (u) => (/^www\./i.test(u) ? 'https://' + u : u);
const a = (url, label) => `<a href="${esc(href(url))}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline">${label}</a>`;

export function textToHtml(text) {
  const keep = [];
  // the named links are set aside first, so the bare-address step does not touch them
  let t = String(text == null ? '' : text).replace(NAMED, (_m, label, url) => { keep.push(a(url, esc(label))); return `\u0000${keep.length - 1}\u0000`; });
  t = esc(t).replace(BARE, (m, pre, url, mail) => (mail ? a('mailto:' + mail, esc(mail)) : `${pre}${a(url.replace(/&amp;/g, '&'), url)}`));
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i) => keep[Number(i)]);
}

// a date from the server (a moment in UTC, or a plain YYYY-MM-DD) as the date on this computer's calendar: YYYY-MM-DD
export function localYmd(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
