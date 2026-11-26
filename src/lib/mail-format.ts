// How the text of a mail is turned into what the receiving mail program shows.
// Webmail such as Hostinger's removes CSS like "white-space: pre-line", so line breaks must be real <br> and <p> tags,
// not something the page style is expected to do. A plain-text copy is sent along with the HTML as well.

const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// true when the text already has HTML layout tags (paragraphs, tables, lists ...); such a mail is sent as it is
export const hasBlockHtml = (s: string) => /<\/?(p|div|br|table|tr|td|ul|ol|li|h[1-6])\b/i.test(String(s || ''));

export const STYLE = 'font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6';

// Plain words to HTML: a blank line starts a new paragraph, a single new line becomes <br>.
// Inline tags the author typed (<b>, <a>, <img>) are kept unless escapeText is true.
export function plainToHtml(text: string, escapeText = false): string {
  const t = String(text || '').replace(/\r\n?/g, '\n').trim();
  const safe = escapeText ? esc(t) : t;
  const paras = safe.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('');
  return `<div style="${STYLE}">${paras}</div>`;
}

// the plain-text copy of an HTML mail
export function htmlToPlain(html: string): string {
  return String(html || '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|ul|ol|table)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Web addresses and email addresses in the text of a mail become links, so the reader can click them. Text that is already
// inside a link, and the inside of tags (src="...", href="..."), is left as it is.
const LINK_RE = /\b((?:https?:\/\/|www\.)[^\s<>"')]+[^\s<>"').,;:!?])|\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
// [Click here](https://example.com) gives a link with the words Click here; the link may also be www.example.com or mailto:a@b.com
const NAMED_RE = /\[([^\]<>\r\n]{1,120})\]\(\s*((?:https?:\/\/|www\.|mailto:)[^\s)<>"]+)\s*\)/gi;
export function linkify(html: string): string {
  let inLink = 0;
  const named = String(html || '').replace(NAMED_RE, (_m, label, url) => `<a href="${(/^www\./i.test(url) ? 'https://' + url : url).replace(/"/g, '&quot;')}" style="color:#2563eb">${label}</a>`);
  return named.split(/(<[^>]*>)/).map(part => {
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part)) inLink++;
      else if (/^<\/a\s*>/i.test(part)) inLink = Math.max(0, inLink - 1);
      return part;
    }
    if (inLink || !part) return part;
    return part.replace(LINK_RE, (m, url, mail) => {
      if (mail) return `<a href="mailto:${mail}" style="color:#2563eb">${mail}</a>`;
      const href = /^www\./i.test(url) ? 'https://' + url : url;
      return `<a href="${href.replace(/"/g, '&quot;')}" style="color:#2563eb">${url}</a>`;
    });
  }).join('');
}

// The signature that closes every mail. text: what HR typed (plain words; a new line is a line break; web and email addresses are
// made into links). gap: the space above it. line: a thin line above it.
export const SIGNATURE_GAPS: Record<string, number> = { compact: 10, normal: 22, wide: 38 };
export function signatureHtml(text: string, gap = 'normal', line = false): string {
  const t = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!t) return '';
  const pad = SIGNATURE_GAPS[gap] ?? SIGNATURE_GAPS.normal;
  const body = linkify(esc(t).replace(/\n/g, '<br>'));
  const top = line ? `border-top:1px solid #d1d5db;padding-top:12px;` : '';
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.5;margin-top:${pad}px;${top}">${body}</div>`;
}
