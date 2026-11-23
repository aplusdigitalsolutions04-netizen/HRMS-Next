// The way the text of a letter is written. The Letters page (preview) and the PDF both read it with these functions, so what HR sees is what is printed.
//
//   blank line          starts a new paragraph
//   # Title             a heading (bold, a little bigger, centred)
//   - point             a bullet
//   1. point            a numbered point (the number is typed)
//   <center> text       the line is centred   (also <right> and <left>)
//   **bold**   *italic*   __underlined__     inside a line
//   [line] Label        a blank line to write on, with a label in front ("Signature:", "Date:")
//   | a | b | c |       a table row (the lines that follow are the next rows; the first row is the heading)
//   <pagebreak>         the rest starts on a new page
//   <signature>         the signature of the authorised person (Payslip Settings) goes here
//
// A marker with no partner (a lone * in "5 * 3") is just printed as it is.

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Align = 'left' | 'center' | 'right';
export type LetterLine = { kind: 'heading' | 'bullet' | 'number' | 'text' | 'rule'; align: Align; label: string; runs: Run[] };
export type Cell = Run[];
// A letter is a list of blocks: paragraphs of lines, tables, and the marks that start a new page or place the signature.
export type Block =
  | { type: 'lines'; lines: LetterLine[] }
  | { type: 'table'; rows: Cell[][] }
  | { type: 'break' }
  | { type: 'signature' };

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
  const rm = /^\[line\]\s?/i.exec(s);
  if (rm) return { kind: 'rule', align: align || 'left', label: '', runs: parseInline(s.slice(rm[0].length)) };
  if (s.startsWith('# ')) {
    return { kind: 'heading', align: align || 'center', label: '', runs: parseInline(s.slice(2)).map(r => ({ ...r, bold: true, underline: true })) };
  }
  if (s.startsWith('- ')) return { kind: 'bullet', align: align || 'left', label: '•', runs: parseInline(s.slice(2)) };
  const nm = /^(\d{1,3}[.)])\s+/.exec(s);
  if (nm) return { kind: 'number', align: align || 'left', label: nm[1], runs: parseInline(s.slice(nm[0].length)) };
  return { kind: 'text', align: align || 'left', label: '', runs: parseInline(s) };
}

const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isBreak = (l: string) => /^\s*<pagebreak>\s*$/i.test(l);
const isSignature = (l: string) => /^\s*<signature>\s*$/i.test(l);
// | a | b | -> the cells; a row of dashes (| --- | --- |) is only the line under the heading and is skipped
function tableRow(l: string): Cell[] | null {
  const cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  if (cells.every(c => /^:?-{2,}:?$/.test(c))) return null;
  return cells.map(c => parseInline(c));
}

// The text split into blocks (a blank line starts a new paragraph; a table, a page break and the signature are blocks of their own).
export function parseLetter(text: string): Block[] {
  const out: Block[] = [];
  const paragraphs = String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const para of paragraphs) {
    const lines = para.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.length);
    let group: LetterLine[] = [], rows: Cell[][] = [];
    const flushLines = () => { if (group.length) out.push({ type: 'lines', lines: group }); group = []; };
    const flushTable = () => { if (rows.length) out.push({ type: 'table', rows }); rows = []; };
    for (const l of lines) {
      if (isTableLine(l)) { flushLines(); const r = tableRow(l); if (r) rows.push(r); continue; }
      flushTable();
      if (isBreak(l)) { flushLines(); out.push({ type: 'break' }); continue; }
      if (isSignature(l)) { flushLines(); out.push({ type: 'signature' }); continue; }
      group.push(parseLine(l));
    }
    flushLines(); flushTable();
  }
  return out;
}
