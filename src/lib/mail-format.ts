// How the text of a mail is turned into what the receiving mail program shows.
// Webmail such as Hostinger's removes CSS like "white-space: pre-line", so line breaks must be real <br> and <p> tags,
// not something the page style is expected to do. A plain-text copy is sent along with the HTML as well.

const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// true when the text already has HTML layout tags (paragraphs, tables, lists ...); such a mail is sent as it is
export const hasBlockHtml = (s: string) => /<\/?(p|div|br|table|tr|td|ul|ol|li|h[1-6])\b/i.test(String(s || ''));

const STYLE = 'font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6';

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
