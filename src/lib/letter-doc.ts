// The rich document of a letter (what the Word-like editor on the Letters page writes). It is a TipTap / ProseMirror document stored as JSON text:
//   { "type": "doc", "content": [ paragraph, heading, bulletList, orderedList, table, image, horizontalRule, pageBreak, signatureMark ... ] }
// Both the editor and the PDF read it. A letter written before the editor existed is plain text with simple marks (see letter-markup.ts);
// docFromMarkup turns such a text into a document so it can be opened in the editor, and the PDF still draws the old texts as they were.
import { parseLetter, Block, Run, LetterLine } from './letter-markup';

export type DocNode = { type: string; attrs?: Record<string, any>; content?: DocNode[]; marks?: { type: string; attrs?: any }[]; text?: string };

export const isDocBody = (s: any): boolean => typeof s === 'string' && /^\s*\{\s*"type"\s*:\s*"doc"/.test(s);
export function parseDoc(body: any): DocNode | null {
  try { const d = typeof body === 'string' ? JSON.parse(body) : body; return d && d.type === 'doc' && Array.isArray(d.content) ? d : null; } catch { return null; }
}
export const emptyDoc = (): DocNode => ({ type: 'doc', content: [{ type: 'paragraph' }] });

const text = (t: string, marks?: { type: string }[]): DocNode => ({ type: 'text', text: t, ...(marks && marks.length ? { marks } : {}) });
function runNodes(runs: Run[]): DocNode[] {
  return runs.filter(r => r.text).map(r => {
    const marks: { type: string }[] = [];
    if (r.bold) marks.push({ type: 'bold' });
    if (r.italic) marks.push({ type: 'italic' });
    if (r.underline) marks.push({ type: 'underline' });
    return text(r.text, marks);
  });
}
const para = (runs: Run[], align?: string): DocNode => ({ type: 'paragraph', ...(align && align !== 'left' ? { attrs: { textAlign: align } } : {}), ...(runs.length ? { content: runNodes(runs) } : {}) });

function tableNode(rows: Run[][][]): DocNode {
  return {
    type: 'table',
    content: rows.map((cells, ri) => ({
      type: 'tableRow',
      content: cells.map(c => ({ type: ri === 0 ? 'tableHeader' : 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [para(c, 'center')] })),
    })),
  };
}

// An old letter text (marks like **bold**, | tables |, <pagebreak>) as a document.
export function docFromMarkup(src: string): DocNode {
  const content: DocNode[] = [];
  for (const b of parseLetter(src) as Block[]) {
    if (b.type === 'break') { content.push({ type: 'pageBreak' }); continue; }
    if (b.type === 'signature') { content.push({ type: 'signatureMark' }); continue; }
    if (b.type === 'table') { content.push(tableNode(b.rows)); continue; }
    let list: DocNode | null = null;
    const closeList = () => { if (list) { content.push(list); list = null; } };
    for (const ln of b.lines as LetterLine[]) {
      if (ln.kind === 'bullet' || ln.kind === 'number') {
        const ordered = ln.kind === 'number';
        if (!list || (list.type === 'orderedList') !== ordered) { closeList(); list = ordered ? { type: 'orderedList', attrs: { start: parseInt(ln.label, 10) || 1 }, content: [] } : { type: 'bulletList', content: [] }; }
        list.content!.push({ type: 'listItem', content: [para(ln.runs, ln.align)] });
        continue;
      }
      closeList();
      if (ln.kind === 'heading') { content.push({ type: 'heading', attrs: { level: 2, textAlign: ln.align }, content: runNodes(ln.runs) }); continue; }
      if (ln.kind === 'rule') { content.push({ type: 'paragraph', content: [...runNodes(ln.runs), text('  ' + '_'.repeat(28))] }); continue; }
      content.push(para(ln.runs, ln.align));
    }
    closeList();
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

const WORD = /\{\{\s*([a-z_]+)\s*\}\}/gi;
const plainOf = (n: DocNode): string => (n.type === 'text' ? n.text || '' : n.type === 'hardBreak' ? '\n' : (n.content || []).map(plainOf).join(''));
// the salary table of a letter: a block of its own (salaryTable), or an older paragraph that is only {{compensation_table}}
const isSalaryPara = (n: DocNode) => n.type === 'salaryTable' || (n.type === 'paragraph' && /^\s*\{\{\s*compensation_table\s*\}\}\s*$/i.test(plainOf(n)));
// older documents: the {{compensation_table}} paragraph becomes the salary table block
export function normalizeDoc(src: DocNode): DocNode {
  const walk = (n: DocNode): DocNode => (n.type === 'paragraph' && isSalaryPara(n) ? { type: 'salaryTable' } : n.content ? { ...n, content: n.content.map(walk) } : n);
  return walk(src);
}

// The words ({{name}}) of a document replaced by their values. A paragraph that is only {{compensation_table}} becomes the salary table.
// missing: the words that had no value.
export function fillDoc(src: DocNode, vars: Record<string, string>, keepMissing = false): { doc: DocNode; missing: string[] } {
  const missing = new Set<string>();
  const valueOf = (k: string) => { const key = k.toLowerCase(); const v = vars[key]; if (v === undefined || v === '') { missing.add(key); return keepMissing ? `{{${key}}}` : ''; } return v; };
  const fillText = (n: DocNode): DocNode[] => {
    const t = String(n.text || '');
    if (!WORD.test(t)) { WORD.lastIndex = 0; return [n]; }
    WORD.lastIndex = 0;
    const filled = t.replace(WORD, (_m, k) => valueOf(k));
    // a value with new lines (an address) becomes lines inside the paragraph
    const parts = filled.split('\n'), out: DocNode[] = [];
    parts.forEach((p, i) => { if (i > 0) out.push({ type: 'hardBreak' }); if (p) out.push({ ...n, text: p }); });
    return out;
  };
  const walk = (n: DocNode): DocNode[] => {
    if (n.type === 'text') return fillText(n);
    if (isSalaryPara(n)) {
      const markup = vars['compensation_table'];
      if (!markup) { missing.add('compensation_table'); return keepMissing ? [n] : []; }
      return (docFromMarkup(markup).content || []).filter(x => x.type === 'table');
    }
    const copy: DocNode = { ...n };
    if (n.content) copy.content = n.content.flatMap(walk);
    return [copy];
  };
  const content = (src.content || []).flatMap(walk);
  return { doc: { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }, missing: [...missing] };
}

// the words a document uses
export function wordsIn(src: DocNode): string[] {
  const set = new Set<string>();
  const walk = (n: DocNode) => { if (n.type === 'salaryTable') set.add('compensation_table'); if (n.type === 'text') for (const m of String(n.text || '').matchAll(WORD)) set.add(m[1].toLowerCase()); (n.content || []).forEach(walk); };
  walk(src);
  return [...set];
}

// does the document say anything (text, a table, an image)?
export function docHasContent(src: DocNode): boolean {
  let found = false;
  const walk = (n: DocNode) => { if (found) return; if ((n.type === 'text' && String(n.text || '').trim()) || n.type === 'image' || n.type === 'table' || n.type === 'salaryTable') { found = true; return; } (n.content || []).forEach(walk); };
  walk(src);
  return found;
}
