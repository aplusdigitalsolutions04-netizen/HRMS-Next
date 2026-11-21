// The way the text of a letter is written. The Letters page (preview) and the PDF both read it with these functions, so what HR sees is what is printed.
//
//   blank line          starts a new paragraph
//   # Title             a heading (bold, a little bigger, centred)
//   - point             a bullet
//   1. point            a numbered point (the number is typed)
//   <center> text       the line is centred   (also <right> and <left>)
//   **bold**   *italic*   __underlined__     inside a line
//
// A marker with no partner (a lone * in "5 * 3") is just printed as it is.

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Align = 'left' | 'center' | 'right';
export type LetterLine = { kind: 'heading' | 'bullet' | 'number' | 'text'; align: Align; label: string; runs: Run[] };

const ALIGN = /^<(center|right|left)>\s?/i;

// Splits one line into runs of the same look.
export function parseInline(src: string): Run[] {
  const s = String(src ?? '');
  // a marker only counts when it has a partner on the same line
  const boldOk = (s.match(/\*\*/g) || []).length % 2 === 0;
  const underOk = (s.match(/__/g) || []).length % 2 === 0;
  const single = s.replace(/\*\*/g, '');
  const italicOk = (single.match(/\*/g) || []).length % 2 === 0;

  const runs: Run[] = [];
  let bold = false, italic = false, underline = false, buf = '';
  const flush = () => { if (buf) { runs.push({ text: buf, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}), ...(underline ? { underline } : {}) }); buf = ''; } };
  for (let i = 0; i < s.length; i++) {
    if (boldOk && s.startsWith('**', i)) { flush(); bold = !bold; i++; continue; }
    if (underOk && s.startsWith('__', i)) { flush(); underline = !underline; i++; continue; }
    if (italicOk && s[i] === '*') { flush(); italic = !italic; continue; }
    buf += s[i];
  }
  flush();
  return runs;
}

export function parseLine(raw: string): LetterLine {
  let s = String(raw ?? '').replace(/\s+$/, '');
  let align: Align | '' = '';
  const am = ALIGN.exec(s);
  if (am) { align = am[1].toLowerCase() as Align; s = s.slice(am[0].length); }
  if (s.startsWith('# ')) {
    return { kind: 'heading', align: align || 'center', label: '', runs: parseInline(s.slice(2)).map(r => ({ ...r, bold: true })) };
  }
  if (s.startsWith('- ')) return { kind: 'bullet', align: align || 'left', label: '•', runs: parseInline(s.slice(2)) };
  const nm = /^(\d{1,3}[.)])\s+/.exec(s);
  if (nm) return { kind: 'number', align: align || 'left', label: nm[1], runs: parseInline(s.slice(nm[0].length)) };
  return { kind: 'text', align: align || 'left', label: '', runs: parseInline(s) };
}

// The text split into paragraphs of lines (a blank line starts a paragraph).
export function parseLetter(text: string): LetterLine[][] {
  return String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/)
    .map(block => block.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.length).map(parseLine))
    .filter(b => b.length);
}
