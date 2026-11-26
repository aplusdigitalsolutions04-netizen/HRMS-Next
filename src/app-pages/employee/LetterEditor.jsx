import React, { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import '@fontsource/carlito/400.css';
import '@fontsource/carlito/700.css';
import '@fontsource/carlito/400-italic.css';
import '@fontsource/carlito/700-italic.css';
import { isDocBody, parseDoc, docFromMarkup, emptyDoc, normalizeDoc } from '@/lib/letter-doc';
import { SAMPLE_COMPONENTS, componentsTotal, inr } from '@/lib/compensation';

// The Word-like editor of a letter. value / onChange are text: the document as JSON (an older letter written with marks like ** is opened as a
// document and saved as one). The PDF is drawn from the same document, so what is seen here is what is printed.

export const docOf = (value) => {
  if (!value || !String(value).trim()) return emptyDoc();
  if (isDocBody(value)) return normalizeDoc(parseDoc(value) || emptyDoc());
  return normalizeDoc(docFromMarkup(String(value)));
};

const FONTS = [
  ['Calibri', 'Carlito, Calibri, sans-serif'],
  ['Arial', 'Arial, Helvetica, sans-serif'],
  ['Times New Roman', '"Times New Roman", Times, serif'],
  ['Courier New', '"Courier New", Courier, monospace'],
];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
const COLORS = ['#000000', '#475569', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#ffffff'];
const MARKS = ['#fde047', '#bbf7d0', '#bae6fd', '#fbcfe8', '#fed7aa', '#e2e8f0'];
const CELLS = ['#f1f5f9', '#dbeafe', '#dcfce7', '#fef9c3', '#fee2e2', '#ede9fe', '#ffffff'];

const PageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true, selectable: true,
  addKeyboardShortcuts() { return { 'Mod-Enter': () => this.editor.commands.insertContent({ type: 'pageBreak' }) }; },
  parseHTML() { return [{ tag: 'div[data-page-break]' }]; },
  renderHTML() { return ['div', { 'data-page-break': '', class: 'le-pb' }, ['span', {}, 'New page starts here']]; },
});
const SignatureMark = Node.create({
  name: 'signatureMark', group: 'block', atom: true, selectable: true,
  parseHTML() { return [{ tag: 'div[data-signature]' }]; },
  renderHTML() { return ['div', { 'data-signature': '', class: 'le-sig' }, 'Signature of the authorised person']; },
});
// The salary table of a letter. Its components and amounts are given for each letter (Make a letter); here the table is shown
// with a sample so the layout can be seen. It is one block: it can be moved or deleted, not edited cell by cell.
const SalaryTable = Node.create({
  name: 'salaryTable', group: 'block', atom: true, selectable: true, draggable: true,
  parseHTML() { return [{ tag: 'div[data-salary-table]' }]; },
  renderHTML() { return ['div', { 'data-salary-table': '', class: 'le-salary' }, 'Salary table']; },
  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.className = 'le-salary'; dom.setAttribute('data-salary-table', ''); dom.contentEditable = 'false';
      const rows = SAMPLE_COMPONENTS, total = componentsTotal(SAMPLE_COMPONENTS);
      const esc = (t) => String(t || '').replace(/</g, '&lt;');
      const body = rows.map(r => `<tr><td>${esc(r.name)}</td><td>${inr(r.amount)}</td><td>${inr(r.amount * 12)}</td></tr>`).join('');
      dom.innerHTML = '<div class="le-salary-tag">Salary table - the components and amounts of each employee are filled in when the letter is made (sample shown)</div>'
        + `<table><tbody><tr><th>Salary Component</th><th>Monthly</th><th>Yearly</th></tr>${body}<tr><th>Grand Total</th><th>${inr(total)}</th><th>${inr(total * 12)}</th></tr></tbody></table>`;
      return { dom };
    };
  },
});
// Pages, as in Word: the sheet is drawn as separate A4 pages with a gap between them. The text is one document; where a page would be full
// a spacer is put in front of the next paragraph, list item or table row so it starts on the next page. (The PDF is laid out by the server, so
// "Preview" is the exact result; this is a close picture of it.)
const PAGE_H = 1123, PAGE_PAD = 56, PAGE_GAP = 24;
const PAGE_CONTENT = PAGE_H - 2 * PAGE_PAD, PAGE_STEP_PAD = PAGE_PAD + PAGE_GAP + PAGE_PAD;
const pagesKey = new PluginKey('pages');
function pageUnits(doc) {
  const units = [];
  doc.forEach((node, off) => {
    const t = node.type.name;
    if (t === 'bulletList' || t === 'orderedList') node.forEach((li, lo) => units.push({ pos: off + 1 + lo, kind: 'li' }));
    else if (t === 'table') node.forEach((row, ro) => units.push({ pos: off + 1 + ro, kind: 'tr', cols: Math.max(1, row.childCount) }));
    else units.push({ pos: off, kind: 'block', brk: t === 'pageBreak' });
  });
  return units;
}
function makeGap(g) {
  let el;
  if (g.kind === 'li') { el = document.createElement('li'); el.style.display = 'block'; el.style.listStyle = 'none'; }
  else if (g.kind === 'tr') { el = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = g.cols || 1; td.style.height = g.h + 'px'; el.appendChild(td); }
  else el = document.createElement('div');
  el.className = 'le-gap'; el.contentEditable = 'false';
  if (g.kind !== 'tr') el.style.height = g.h + 'px';
  return el;
}
function layoutPages(view, onPages) {
  const dom = view.dom;
  if (!dom.isConnected) return;
  const old = [...dom.querySelectorAll('.le-gap')];
  old.forEach(e => { e.style.display = 'none'; });
  const top0 = dom.getBoundingClientRect().top;
  const units = pageUnits(view.state.doc);
  let added = 0, pageStart = 0, pageEnd = PAGE_CONTENT, force = false, lastV = 0;
  const gaps = [];
  for (const u of units) {
    const el = view.nodeDOM(u.pos);
    if (!(el instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const top = r.top - top0 - (parseFloat(cs.marginTop) || 0), bottom = r.bottom - top0 + (parseFloat(cs.marginBottom) || 0);
    const vTop = top + added;
    if (force || (bottom + added > pageEnd && vTop > pageStart + 1 && bottom - top <= PAGE_CONTENT)) {
      const h = Math.max(0, pageEnd - vTop) + PAGE_STEP_PAD;
      gaps.push({ pos: u.pos, kind: u.kind, cols: u.cols, h: Math.round(h) });
      added += h; pageStart = pageEnd + PAGE_STEP_PAD; pageEnd = pageStart + PAGE_CONTENT; force = false;
    }
    if (u.brk) force = true;
    // a unit taller than a page runs over the pages it covers
    while (bottom + added > pageEnd + 1) { pageStart = pageEnd + PAGE_STEP_PAD; pageEnd = pageStart + PAGE_CONTENT; }
    lastV = bottom + added;
  }
  // the last page is filled to its end, so the sheet always ends with a whole page
  gaps.push({ pos: view.state.doc.content.size, kind: 'end', h: Math.round(Math.max(0, pageEnd - lastV)) });
  old.forEach(e => { e.style.display = ''; });
  if (onPages) onPages(gaps.length);
  const prev = pagesKey.getState(view.state);
  if (JSON.stringify(prev.gaps) === JSON.stringify(gaps)) return;
  const decos = gaps.map(g => Decoration.widget(g.pos, () => makeGap(g), { side: g.kind === 'end' ? 1 : -1, key: `g${g.pos}:${g.h}:${g.kind}` }));
  view.dispatch(view.state.tr.setMeta(pagesKey, { gaps, deco: DecorationSet.create(view.state.doc, decos) }).setMeta('addToHistory', false));
}
const Pagination = Extension.create({
  name: 'pagination',
  addOptions() { return { onPages: null }; },
  addProseMirrorPlugins() {
    const onPages = this.options.onPages;
    return [new Plugin({
      key: pagesKey,
      state: {
        init: () => ({ gaps: [], deco: DecorationSet.empty }),
        apply(tr, old) { const m = tr.getMeta(pagesKey); if (m) return m; return tr.docChanged ? { gaps: old.gaps, deco: old.deco.map(tr.mapping, tr.doc) } : old; },
      },
      props: { decorations(state) { return pagesKey.getState(state).deco; } },
      view(view) {
        let raf = 0, dead = false;
        let tries = 0;
        // the view may not be on the page yet when the plugin starts: look again a few times
        const run = () => { raf = 0; if (dead) return; if (!view.dom.isConnected) { if (tries++ < 60) raf = setTimeout(run, 40); return; } layoutPages(view, onPages); };
        const schedule = () => { if (!raf && !dead) raf = setTimeout(run, 40); };
        schedule();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
        view.dom.addEventListener('load', schedule, true);
        window.addEventListener('resize', schedule);
        return { update: schedule, destroy() { dead = true; clearTimeout(raf); window.removeEventListener('resize', schedule); view.dom.removeEventListener('load', schedule, true); } };
      },
    })];
  },
});
// {{words}} are marked in the text
const WordMarks = Extension.create({
  name: 'wordMarks',
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        decorations(state) {
          const out = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const m of node.text.matchAll(/\{\{\s*[a-z_]+\s*\}\}/gi)) out.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, { class: 'le-word' }));
          });
          return DecorationSet.create(state.doc, out);
        },
      },
    })];
  },
});
// Find: the text that is searched is marked in the sheet (the one the cursor is on is darker)
const findKey = new PluginKey('find');
const FindMarks = Extension.create({
  name: 'findMarks',
  addOptions() { return { get: () => '' }; },
  addProseMirrorPlugins() {
    const get = this.options.get;
    return [new Plugin({
      key: findKey,
      props: {
        decorations(state) {
          const needle = get();
          if (!needle) return null;
          const out = [], sel = state.selection;
          for (const m of findInDoc(state.doc, needle)) out.push(Decoration.inline(m.from, m.to, { class: m.from === sel.from && m.to === sel.to ? 'le-find le-find-cur' : 'le-find' }));
          return DecorationSet.create(state.doc, out);
        },
      },
    })];
  },
});
// every place of the needle in the text of the document (not case sensitive): [{from, to}]
function findInDoc(doc, needle) {
  const out = [], n = needle.toLowerCase();
  if (!n) return out;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let str = ''; const segs = [];
    node.forEach((ch, off) => { segs.push([str.length, pos + 1 + off]); str += ch.isText ? ch.text : '￼'; });
    const low = str.toLowerCase();
    const at = (i) => { let s = segs[0]; for (const g of segs) if (g[0] <= i) s = g; return s[1] + (i - s[0]); };
    let i = 0;
    while (n && (i = low.indexOf(n, i)) >= 0) { out.push({ from: at(i), to: at(i + n.length - 1) + 1 }); i += n.length; }
    return false;
  });
  return out;
}
const cellBg = {
  backgroundColor: {
    default: null,
    parseHTML: el => el.style.backgroundColor || null,
    renderHTML: a => (a.backgroundColor ? { style: `background-color:${a.backgroundColor}` } : {}),
  },
};
const Cell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...cellBg }; } });
const HeadCell = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...cellBg }; } });
const Pic = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), width: { default: null, parseHTML: el => Number(el.getAttribute('width')) || null, renderHTML: a => (a.width ? { width: a.width } : {}) } };
  },
});

// a picture is made smaller before it goes into the letter (a letter keeps it inside itself)
function readPicture(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) { reject(new Error('Use a PNG or JPG picture')); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const k = Math.min(1, 1100 / img.width);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext('2d');
        const png = /png|gif|webp/i.test(file.type);
        if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
        g.drawImage(img, 0, 0, c.width, c.height);
        resolve({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), width: Math.min(c.width, 360) });
      };
      img.onerror = () => reject(new Error('This picture cannot be read'));
      img.src = fr.result;
    };
    fr.onerror = () => reject(new Error('This picture cannot be read'));
    fr.readAsDataURL(file);
  });
}

const I = ({ d, size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const lines = (rows) => rows.map(([x1, x2], i) => <line key={i} x1={x1} y1={6 + i * 4} x2={x2} y2={6 + i * 4} />);
const ICON = {
  left: <I d={lines([[3, 21], [3, 14], [3, 18], [3, 12], [3, 21]])} />,
  center: <I d={lines([[3, 21], [7, 17], [5, 19], [8, 16], [3, 21]])} />,
  right: <I d={lines([[3, 21], [10, 21], [6, 21], [12, 21], [3, 21]])} />,
  justify: <I d={lines([[3, 21], [3, 21], [3, 21], [3, 21], [3, 21]])} />,
  bullet: <I d={<><line x1="9" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>} />,
  number: <I d={<><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 5l1-1v4M3.5 14h2l-2 3h2" /></>} />,
  undo: <I d={<><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></>} />,
  redo: <I d={<><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></>} />,
  image: <I d={<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>} />,
  table: <I d={<><rect x="3" y="4" width="18" height="16" rx="1" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="4" x2="9" y2="20" /><line x1="15" y1="4" x2="15" y2="20" /></>} />,
  hr: <I d={<line x1="3" y1="12" x2="21" y2="12" />} />,
  clear: <I d={<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>} />,
  outdent: <I d={<><line x1="11" y1="6" x2="21" y2="6" /><line x1="11" y1="12" x2="21" y2="12" /><line x1="11" y1="18" x2="21" y2="18" /><path d="M7 8l-4 4 4 4z" /></>} />,
  indent: <I d={<><line x1="11" y1="6" x2="21" y2="6" /><line x1="11" y1="12" x2="21" y2="12" /><line x1="11" y1="18" x2="21" y2="18" /><path d="M3 8l4 4-4 4z" /></>} />,
  paste: <I size={26} d={<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="14" y2="16" /></>} />,
  cut: <I size={14} d={<><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M8 16L19 3M16 16L5 3" /></>} />,
  copy: <I size={14} d={<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>} />,
  search: <I size={14} d={<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16" y2="16" /></>} />,
  replace: <I size={14} d={<><path d="M4 8h13l-3-3M20 16H7l3 3" /></>} />,
  select: <I size={14} d={<><path d="M5 3l6 16 2-7 7-2z" /></>} />,
  page: <I size={14} d={<><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /></>} />,
  sign: <I size={14} d={<><path d="M3 18c3-6 5-10 7-10s-3 8-1 8 3-4 5-4 1 3 4 3" /><line x1="3" y1="21" x2="21" y2="21" /></>} />,
  words: <I size={14} d={<><path d="M4 6h16M4 12h10M4 18h13" /></>} />,
};
function Grp({ label, children }) {
  return <div className="rb-g"><div className="rb-gb">{children}</div><div className="rb-gl">{label}</div></div>;
}

function Btn({ title, on, off, onClick, children, wide, style }) {
  return <button type="button" className={`le-b${on ? ' on' : ''}${wide ? ' wide' : ''}`} title={title} aria-label={title} disabled={off} onMouseDown={e => e.preventDefault()} onClick={onClick} style={style}>{children}</button>;
}
// a button that opens a small set of colours
function Swatches({ title, label, colors, value, onPick, onClear, clearText }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  return (
    <div className="le-pop" ref={ref}>
      <button type="button" className="le-b" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}>{label}<i className="le-bar" style={{ background: value || 'transparent' }} /></button>
      {open && (
        <div className="le-menu" onMouseDown={e => e.preventDefault()}>
          <div className="le-sw">{colors.map(c => <button type="button" key={c} style={{ background: c }} title={c} onClick={() => { onPick(c); setOpen(false); }} />)}</div>
          <label className="le-own">Other <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={e => onPick(e.target.value)} /></label>
          <button type="button" className="le-none" onClick={() => { onClear(); setOpen(false); }}>{clearText}</button>
        </div>
      )}
    </div>
  );
}
function TablePicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState([0, 0]);
  const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  return (
    <div className="le-pop" ref={ref}>
      <Btn title="Insert a table" wide onClick={() => setOpen(o => !o)}>{ICON.table} Table</Btn>
      {open && (
        <div className="le-menu" onMouseDown={e => e.preventDefault()}>
          <div className="le-grid" onMouseLeave={() => setHover([0, 0])}>
            {Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (
              <i key={r + '-' + c} className={r < hover[0] && c < hover[1] ? 'on' : ''} onMouseEnter={() => setHover([r + 1, c + 1])} onClick={() => { onPick(r + 1, c + 1); setOpen(false); }} />
            )))}
          </div>
          <div className="le-gridl">{hover[0] ? `${hover[0]} rows x ${hover[1]} columns` : 'Pick the size'}</div>
        </div>
      )}
    </div>
  );
}

// salary: the salary table block of a letter text (filled for each letter). salaryMarkup: in a letter being made, a function that gives the table
// of this letter's salary components as text; its button puts that table where the cursor is.
export default function LetterEditor({ value, onChange, words, height = 620, salary = true, salaryMarkup = null, readOnly = false }) {
  const last = useRef(null);
  const fileRef = useRef(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('home');
  const [marks, setMarks] = useState(false);
  const [showWords, setShowWords] = useState(true);
  const [pageCount, setPageCount] = useState(1);
  const [find, setFind] = useState('');
  const [findQ, setFindQ] = useState('');
  const [repQ, setRepQ] = useState('');
  const findRef = useRef('');
  findRef.current = find ? findQ : '';
  const initial = useMemo(() => docOf(value), []); // eslint-disable-line
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    content: initial,
    extensions: [
      StarterKit.configure({ link: false, blockquote: false, code: false, codeBlock: false, heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'image'], alignments: ['left', 'center', 'right', 'justify'] }),
      TextStyle, Color, FontFamily, FontSize,
      Highlight.configure({ multicolor: true }),
      Pic.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }), TableRow, Cell, HeadCell,
      PageBreak, SignatureMark, SalaryTable, WordMarks, Pagination.configure({ onPages: (n) => setPageCount(n) }), FindMarks.configure({ get: () => findRef.current }),
    ],
    editorProps: {
      handleKeyDown: (view, e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'h')) { e.preventDefault(); setTab('home'); setFind(e.key === 'h' ? 'replace' : 'find'); return true; }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => { const s = JSON.stringify(ed.getJSON()); last.current = s; onChange && onChange(s); },
  });
  // a text that comes from outside (another letter was opened, the text was filled) replaces the document
  useEffect(() => {
    if (!editor) return;
    if (value === last.current) return;
    last.current = value;
    editor.commands.setContent(docOf(value), { emitUpdate: false });
  }, [value, editor]);

  // the marked search text is drawn again when the search text is typed or the search is closed
  useEffect(() => { if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false)); }, [find, findQ, editor]);

  const attrs = editor ? editor.getAttributes('textStyle') : {};
  const chain = () => editor.chain().focus();
  const family = FONTS.find(f => f[1] === attrs.fontFamily);
  const sizePt = attrs.fontSize ? parseFloat(attrs.fontSize) : '';
  const headingLevel = editor ? [1, 2, 3].find(l => editor.isActive('heading', { level: l })) || 0 : 0;
  const inTable = editor && editor.isActive('table');
  const onImage = editor && editor.isActive('image');
  const word = (k) => chain().insertContent(`{{${k}}}`).run();

  const addPicture = async (file) => {
    if (!file) return;
    try { const p = await readPicture(file); chain().setImage({ src: p.src }).updateAttributes('image', { width: p.width }).run(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'No picture', text: e.message }); }
  };
  const curTab = tab === 'table' && !inTable ? 'home' : tab;
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) chain().insertContent(t.split(/\r?\n/).map(s => (s ? { type: 'paragraph', content: [{ type: 'text', text: s }] } : { type: 'paragraph' }))).run(); }
    catch { Swal.fire({ icon: 'info', title: 'Press Ctrl+V', text: 'The browser did not allow the Paste button. Click in the letter and press Ctrl+V.' }); }
  };
  const stepSize = (d) => {
    const cur = sizePt || 11, i = SIZES.indexOf(cur);
    const next = i >= 0 ? SIZES[Math.min(SIZES.length - 1, Math.max(0, i + d))] : (d > 0 ? SIZES.find(s => s > cur) : [...SIZES].reverse().find(s => s < cur)) || cur;
    if (next === 11) chain().unsetFontSize().run(); else chain().setFontSize(`${next}pt`).run();
  };
  const findAll = (s) => findInDoc(editor.state.doc, s);
  const redraw = () => setTimeout(() => editor && !editor.isDestroyed && editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false)), 0);
  const goTo = (m) => { editor.chain().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run(); };
  const findNext = () => {
    const all = findAll(findQ); if (!all.length) return;
    const end = editor.state.selection.to;
    goTo(all.find(m => m.from >= end) || all[0]);
  };
  const replaceOne = () => {
    const sel = editor.state.selection, cur = findAll(findQ).find(m => m.from === sel.from && m.to === sel.to);
    if (cur) { const tr = repQ ? editor.state.tr.insertText(repQ, cur.from, cur.to) : editor.state.tr.delete(cur.from, cur.to); editor.view.dispatch(tr); }
    findNext();
  };
  const replaceAll = () => {
    const all = findAll(findQ); if (!all.length) return;
    let tr = editor.state.tr;
    for (const m of [...all].reverse()) tr = repQ ? tr.insertText(repQ, m.from, m.to) : tr.delete(m.from, m.to);
    editor.view.dispatch(tr);
  };
  const cellColor = (c) => editor.chain().focus().setCellAttribute('backgroundColor', c).run();
  if (!editor) return <div className="le-loading">Loading the editor...</div>;

  const shown = (words || []).filter(([k, l]) => !q.trim() || (k + ' ' + l).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="le">
      <style>{LE_CSS}</style>
      {!readOnly && (
        <div className="rb" role="toolbar" aria-label="Formatting">
          <div className="rb-tabs">
            {[['home', 'Home'], ['insert', 'Insert'], ['view', 'View']].map(([k, l]) => <button key={k} type="button" className={`rb-tab${curTab === k ? ' on' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => setTab(k)}>{l}</button>)}
            {inTable && <button type="button" className={`rb-tab ctx${curTab === 'table' ? ' on' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => setTab('table')}>Table</button>}
          </div>
          <div className="rb-panel">
            {curTab === 'home' && <>
              <Grp label="Clipboard">
                <button type="button" className="le-b rb-big" title="Paste (Ctrl+V)" onMouseDown={e => e.preventDefault()} onClick={paste}>{ICON.paste}<span>Paste</span></button>
                <div className="rb-col">
                  <Btn wide title="Cut (Ctrl+X)" onClick={() => document.execCommand('cut')}>{ICON.cut} Cut</Btn>
                  <Btn wide title="Copy (Ctrl+C)" onClick={() => document.execCommand('copy')}>{ICON.copy} Copy</Btn>
                </div>
              </Grp>
              <Grp label="Font">
                <div className="rb-col">
                  <div className="rb-r">
                    <select className="le-sel" aria-label="Font" style={{ width: 150 }} value={family ? family[1] : ''} onChange={e => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}>
                      <option value="">Calibri (Body)</option>
                      {FONTS.slice(1).map(([n, v]) => <option key={n} value={v}>{n}</option>)}
                    </select>
                    <select className="le-sel" aria-label="Font size" style={{ width: 58 }} value={sizePt || 11} onChange={e => (Number(e.target.value) === 11 ? chain().unsetFontSize().run() : chain().setFontSize(`${e.target.value}pt`).run())}>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Btn title="Increase the font size" onClick={() => stepSize(1)}><b style={{ fontSize: 14 }}>A<sup style={{ fontSize: 9 }}>+</sup></b></Btn>
                    <Btn title="Decrease the font size" onClick={() => stepSize(-1)}><b style={{ fontSize: 11 }}>A<sup style={{ fontSize: 9 }}>-</sup></b></Btn>
                    <Btn title="Clear all formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>{ICON.clear}</Btn>
                  </div>
                  <div className="rb-r">
                    <Btn title="Bold (Ctrl+B)" on={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} style={{ fontWeight: 800 }}>B</Btn>
                    <Btn title="Italic (Ctrl+I)" on={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} style={{ fontStyle: 'italic', fontFamily: 'serif' }}>I</Btn>
                    <Btn title="Underline (Ctrl+U)" on={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} style={{ textDecoration: 'underline' }}>U</Btn>
                    <Btn title="Strikethrough" on={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()} style={{ textDecoration: 'line-through' }}>ab</Btn>
                    <Swatches title="Highlight colour" label={<b style={{ fontSize: 13, background: '#fde047', padding: '0 3px', borderRadius: 2 }}>ab</b>} colors={MARKS} value={editor.getAttributes('highlight').color} onPick={c => chain().setHighlight({ color: c }).run()} onClear={() => chain().unsetHighlight().run()} clearText="No highlight" />
                    <Swatches title="Font colour" label={<b style={{ fontSize: 14 }}>A</b>} colors={COLORS} value={attrs.color} onPick={c => chain().setColor(c).run()} onClear={() => chain().unsetColor().run()} clearText="Automatic" />
                  </div>
                </div>
              </Grp>
              <Grp label="Paragraph">
                <div className="rb-col">
                  <div className="rb-r">
                    <Btn title="Bullets" on={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>{ICON.bullet}</Btn>
                    <Btn title="Numbering" on={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>{ICON.number}</Btn>
                    <Btn title="Decrease the list level" off={!editor.can().liftListItem('listItem')} onClick={() => chain().liftListItem('listItem').run()}>{ICON.outdent}</Btn>
                    <Btn title="Increase the list level" off={!editor.can().sinkListItem('listItem')} onClick={() => chain().sinkListItem('listItem').run()}>{ICON.indent}</Btn>
                    <Btn title="Show / hide paragraph marks" on={marks} onClick={() => setMarks(m => !m)}><b style={{ fontSize: 15 }}>&para;</b></Btn>
                  </div>
                  <div className="rb-r">
                    {['left', 'center', 'right', 'justify'].map(a => <Btn key={a} title={`Align ${a}`} on={editor.isActive({ textAlign: a })} onClick={() => chain().setTextAlign(a).run()}>{ICON[a]}</Btn>)}
                  </div>
                </div>
              </Grp>
              <Grp label="Styles">
                <div className="rb-styles">
                  {[[0, 'Normal', 'rb-st-n'], [1, 'Heading 1', 'rb-st-1'], [2, 'Heading 2', 'rb-st-2'], [3, 'Heading 3', 'rb-st-3']].map(([l, n, c]) => (
                    <button key={n} type="button" className={`rb-st ${c}${headingLevel === l ? ' on' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => (l ? chain().setHeading({ level: l }).run() : chain().setParagraph().run())}>{n}</button>
                  ))}
                </div>
              </Grp>
              <Grp label="Editing">
                <div className="rb-col">
                  <Btn wide title="Find (Ctrl+F)" on={find === 'find'} onClick={() => setFind(f => (f === 'find' ? '' : 'find'))}>{ICON.search} Find</Btn>
                  <Btn wide title="Find and replace (Ctrl+H)" on={find === 'replace'} onClick={() => setFind(f => (f === 'replace' ? '' : 'replace'))}>{ICON.replace} Replace</Btn>
                  <Btn wide title="Select all (Ctrl+A)" onClick={() => chain().selectAll().run()}>{ICON.select} Select</Btn>
                </div>
              </Grp>
            </>}
            {curTab === 'insert' && <>
              <Grp label="Tables"><TablePicker onPick={(r, c) => chain().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()} /></Grp>
              <Grp label="Illustrations">
                <Btn wide title="Insert a picture" onClick={() => fileRef.current && fileRef.current.click()}>{ICON.image} Picture</Btn>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { addPicture(e.target.files[0]); e.target.value = ''; }} />
                <Btn wide title="A line across the page" onClick={() => chain().setHorizontalRule().run()}>{ICON.hr} Line</Btn>
                {onImage && <label className="le-w">Width <input type="number" min={20} max={720} value={editor.getAttributes('image').width || ''} onChange={e => chain().updateAttributes('image', { width: Number(e.target.value) || null }).run()} /> px</label>}
              </Grp>
              <Grp label="Pages">
                <Btn wide title="The rest of the letter starts on a new page (Ctrl+Enter)" onClick={() => chain().insertContent({ type: 'pageBreak' }).run()}>{ICON.page} Page break</Btn>
                <Btn wide title="The signature of the authorised person (Payslip Settings) goes here" onClick={() => chain().insertContent({ type: 'signatureMark' }).run()}>{ICON.sign} Signature</Btn>
              </Grp>
              {(salaryMarkup || salary) && <Grp label="Salary">
                {salaryMarkup && <Btn wide title="Puts the salary table of the components typed above at the cursor" onClick={() => { const m = salaryMarkup(); const t = m ? (docFromMarkup(m).content || []).filter(x => x.type === 'table') : []; if (!t.length) { Swal.fire({ icon: 'info', title: 'No salary table yet', text: 'Type the amounts of the salary components above and press "Prepare the letter" again, or add at least one amount.' }); return; } chain().insertContent(t).run(); }}>{ICON.table} Salary table (from the components)</Btn>}
                {salary && <Btn wide title="The salary table, filled for each letter from its salary components" onClick={() => chain().insertContent({ type: 'salaryTable' }).run()}>{ICON.table} Salary table (calculated)</Btn>}
              </Grp>}
            </>}
            {curTab === 'view' && <>
              <Grp label="Show">
                <Btn wide title="Show / hide paragraph marks" on={marks} onClick={() => setMarks(m => !m)}><b>&para;</b> Paragraph marks</Btn>
                {words && <Btn wide title="Show / hide the list of words" on={showWords} onClick={() => setShowWords(s => !s)}>{ICON.words} Words list</Btn>}
              </Grp>
            </>}
            {curTab === 'table' && inTable && <>
              <Grp label="Rows and columns">
                <div className="rb-col">
                  <div className="rb-r"><Btn wide title="A row above" onClick={() => chain().addRowBefore().run()}>+ Row above</Btn><Btn wide title="A row below" onClick={() => chain().addRowAfter().run()}>+ Row below</Btn><Btn wide title="Delete the row" onClick={() => chain().deleteRow().run()}>Delete row</Btn></div>
                  <div className="rb-r"><Btn wide title="A column on the left" onClick={() => chain().addColumnBefore().run()}>+ Column left</Btn><Btn wide title="A column on the right" onClick={() => chain().addColumnAfter().run()}>+ Column right</Btn><Btn wide title="Delete the column" onClick={() => chain().deleteColumn().run()}>Delete column</Btn></div>
                </div>
              </Grp>
              <Grp label="Merge">
                <Btn wide title="Join the selected cells (drag over them first)" off={!editor.can().mergeCells()} onClick={() => chain().mergeCells().run()}>Merge cells</Btn>
                <Btn wide title="Split a joined cell" off={!editor.can().splitCell()} onClick={() => chain().splitCell().run()}>Split cell</Btn>
              </Grp>
              <Grp label="Table style">
                <Btn wide title="The first row as a heading" onClick={() => chain().toggleHeaderRow().run()}>Heading row</Btn>
                <Swatches title="Colour of the cell" label={<span style={{ fontSize: 12, fontWeight: 700 }}>Shading</span>} colors={CELLS} value={editor.getAttributes('tableCell').backgroundColor || editor.getAttributes('tableHeader').backgroundColor} onPick={cellColor} onClear={() => chain().setCellAttribute('backgroundColor', null).run()} clearText="No colour" />
              </Grp>
              <Grp label="Delete"><Btn wide title="Delete the whole table" onClick={() => chain().deleteTable().run()}><span style={{ color: '#b91c1c' }}>Delete table</span></Btn></Grp>
            </>}
          </div>
          {find && (
            <div className="rb-find">
              <input autoFocus placeholder="Find" aria-label="Find" value={findQ} onChange={e => { setFindQ(e.target.value); redraw(); }} onKeyDown={e => { if (e.key === 'Enter') findNext(); if (e.key === 'Escape') setFind(''); }} />
              {find === 'replace' && <input placeholder="Replace with" aria-label="Replace with" value={repQ} onChange={e => setRepQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') replaceOne(); }} />}
              <button type="button" onClick={findNext}>Find next</button>
              {find === 'replace' && <><button type="button" onClick={replaceOne}>Replace</button><button type="button" onClick={replaceAll}>Replace all</button></>}
              <span className="rb-fc">{findQ ? `${findAll(findQ).length} found` : ''}</span>
              <button type="button" className="rb-x" aria-label="Close" onClick={() => setFind('')}>&times;</button>
            </div>
          )}
        </div>
      )}
      <div className="le-body">
        <div className="le-desk" style={{ maxHeight: height }}>
          <div className={`le-paper${marks ? ' le-marks' : ''}`}><EditorContent editor={editor} /></div>
          {!readOnly && <div className="le-addrow">
            <button type="button" className="le-addpage" title="Adds a new page at the end of the letter" onClick={() => editor.chain().focus('end').insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run()}>+ Add page</button>
            <span>Pages are shown as in Word. "Preview" shows the exact PDF pages.</span>
          </div>}
        </div>
        {words && !readOnly && showWords && (
          <aside className="le-words" style={{ maxHeight: height }}>
            <div className="le-words-h">Words</div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search words" aria-label="Search words" />
            <p>Click a word to put it where the cursor is. It is filled in for each employee.</p>
            <div className="le-chips">
              {shown.length === 0 && <span className="le-none2">No word matches.</span>}
              {shown.map(([k, l]) => <button type="button" key={k} title={l} onMouseDown={e => e.preventDefault()} onClick={() => word(k)}>{k}</button>)}
            </div>
          </aside>
        )}
      </div>
      <div className="le-status">
        <span>Pages: {Math.max(1, pageCount)}</span>
        <span>Words: {(editor.getText().match(/\S+/g) || []).length}</span>
        {!readOnly && <span className="le-st-r">A4 &middot; Calibri 11 pt</span>}
      </div>
    </div>
  );
}

const LE_CSS = `
.rb { background:#f3f3f3; border-bottom:1px solid #d1d5db; }
.rb-tabs { display:flex; gap:2px; padding:4px 10px 0; background:#f3f3f3; }
.rb-tab { border:none; background:transparent; padding:6px 14px; font-size:.82rem; font-family:inherit; color:#334155; cursor:pointer; border-radius:6px 6px 0 0; border-bottom:2px solid transparent; }
.rb-tab:hover { background:#e7e7e7; } .rb-tab.on { background:#fbfbfb; color:#111827; font-weight:600; border-bottom-color:var(--brand,#6f4e37); } .rb-tab.ctx { color:#7c3aed; }
.rb-panel { display:flex; flex-wrap:wrap; align-items:stretch; background:#fbfbfb; border-top:1px solid #e5e7eb; padding:6px 6px 4px; min-height:84px; }
.rb-g { display:flex; flex-direction:column; justify-content:space-between; padding:0 8px; border-right:1px solid #e1e1e1; }
.rb-g:last-child { border-right:none; }
.rb-gb { display:flex; gap:4px; align-items:flex-start; flex:1; }
.rb-gl { font-size:.68rem; color:#6b7280; text-align:center; padding-top:3px; }
.rb-col { display:flex; flex-direction:column; gap:3px; } .rb-r { display:flex; gap:2px; align-items:center; }
.rb-big { flex-direction:column; height:62px; width:54px; gap:3px; font-size:.74rem; padding:4px; }
.rb-big svg { flex:none; }
.rb-styles { display:flex; gap:5px; align-items:stretch; }
.rb-st { min-width:84px; height:56px; border:1px solid #d1d5db; background:#fff; border-radius:4px; cursor:pointer; padding:0 8px; font-family:Carlito,Calibri,sans-serif; color:#111827; text-align:center; }
.rb-st:hover { border-color:#9ca3af; background:#f3f4f6; } .rb-st.on { border-color:var(--brand,#6f4e37); box-shadow:inset 0 0 0 1px var(--brand,#6f4e37); }
.rb-st-n { font-size:11pt; } .rb-st-1 { font-size:18pt; font-weight:700; } .rb-st-2 { font-size:14pt; font-weight:700; } .rb-st-3 { font-size:12pt; font-weight:700; }
.rb-find { display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:6px 12px; background:#fff; border-top:1px solid #e5e7eb; }
.rb-find input { height:28px; border:1px solid #cbd5e1; border-radius:6px; padding:0 8px; font-size:.82rem; font-family:inherit; width:190px; }
.rb-find button { height:28px; border:1px solid #cbd5e1; background:#f8fafc; border-radius:6px; padding:0 10px; font-size:.78rem; cursor:pointer; font-family:inherit; color:#334155; } .rb-find button:hover { background:#eef2f7; }
.rb-find .rb-x { font-size:1.1rem; line-height:1; padding:0 8px; } .rb-fc { font-size:.76rem; color:#64748b; }
.le-find { background:#fde68a; } .le-find-cur { background:#fb923c; color:#000; }
.le-marks .ProseMirror p::after, .le-marks .ProseMirror h1::after, .le-marks .ProseMirror h2::after, .le-marks .ProseMirror h3::after { content:'\\00B6'; color:#94a3b8; font-weight:400; font-size:10pt; margin-left:2px; }
.le-status { display:flex; gap:18px; padding:4px 14px; font-size:.74rem; color:#475569; background:#f3f3f3; border-top:1px solid #d1d5db; } .le-st-r { margin-left:auto; }
.le { border:1px solid #eadfd5; border-radius:12px; background:#fff; overflow:hidden; }
.le-loading { padding:30px; color:#94a3b8; text-align:center; }
.le-tools { background:#faf6f2; border-bottom:1px solid #eadfd5; padding:6px 8px; display:flex; flex-direction:column; gap:5px; }
.le-row { display:flex; flex-wrap:wrap; gap:3px; align-items:center; }
.le-trow { border-top:1px dashed #e2d6c9; padding-top:5px; }
.le-lab { font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; margin:0 4px 0 2px; }
.le-sep { width:1px; height:20px; background:#e2d6c9; margin:0 4px; }
.le-b { min-width:30px; height:30px; padding:0 7px; border:1px solid transparent; background:transparent; border-radius:6px; cursor:pointer; color:#334155; font-size:.82rem; font-family:inherit; display:inline-flex; align-items:center; justify-content:center; gap:5px; position:relative; }
.le-b.wide { font-size:.76rem; font-weight:600; }
.le-b:hover:not(:disabled) { background:#efe6dd; } .le-b.on { background:#e7d9cb; border-color:#d9c5b3; color:var(--brand,#6f4e37); } .le-b:disabled { opacity:.35; cursor:default; }
.le-bar { position:absolute; left:6px; right:6px; bottom:2px; height:3px; border-radius:2px; border:1px solid #e2d6c9; }
.le-sel { height:30px; border:1px solid #e2d6c9; border-radius:6px; background:#fff; font-size:.8rem; font-family:inherit; padding:0 6px; color:#334155; }
.le-pop { position:relative; } .le-menu { position:absolute; top:34px; left:0; z-index:30; background:#fff; border:1px solid #e2d6c9; border-radius:10px; padding:10px; box-shadow:0 10px 30px rgba(15,23,42,.18); min-width:150px; }
.le-sw { display:grid; grid-template-columns:repeat(5,22px); gap:5px; } .le-sw button { width:22px; height:22px; border-radius:5px; border:1px solid #cbd5e1; cursor:pointer; padding:0; }
.le-own { display:flex; align-items:center; justify-content:space-between; font-size:.74rem; color:#64748b; margin-top:8px; } .le-own input { width:34px; height:22px; padding:0; border:none; background:none; }
.le-none { margin-top:6px; width:100%; border:1px solid #e2d6c9; background:#fff; border-radius:6px; font-size:.74rem; padding:4px; cursor:pointer; font-family:inherit; color:#475569; }
.le-grid { display:grid; grid-template-columns:repeat(8,18px); gap:3px; } .le-grid i { width:18px; height:18px; border:1px solid #cbd5e1; border-radius:3px; cursor:pointer; } .le-grid i.on { background:#d9c5b3; border-color:var(--brand,#6f4e37); }
.le-gridl { font-size:.74rem; color:#64748b; margin-top:6px; text-align:center; }
.le-w { display:inline-flex; align-items:center; gap:5px; font-size:.76rem; color:#475569; margin-left:6px; } .le-w input { width:64px; height:26px; border:1px solid #e2d6c9; border-radius:6px; padding:0 6px; font-family:inherit; }
.le-body { display:flex; align-items:flex-start; }
.le-desk { flex:1; min-width:0; overflow:auto; background:#e8e2dc; padding:18px 12px; }
.le-paper { width:794px; max-width:100%; margin:0 auto; background:repeating-linear-gradient(to bottom, #fff 0, #fff 1123px, #e8e2dc 1123px, #e8e2dc 1147px); padding:56px 75px; min-height:1123px; box-sizing:border-box; color:#000; }
.le-gap { pointer-events:none; user-select:none; } .le-paper .ProseMirror tr.le-gap td { border:none !important; padding:0 !important; background:transparent !important; } .le-paper .ProseMirror li.le-gap { margin:0; padding:0; }
.le-addrow { width:794px; max-width:100%; margin:12px auto 4px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:.76rem; color:#64748b; }
.le-addpage { background:#fff; border:1px dashed #94a3b8; border-radius:8px; padding:7px 16px; font-weight:700; color:var(--brand,#6f4e37); cursor:pointer; font-family:inherit; } .le-addpage:hover { background:#f8f3ed; border-color:var(--brand,#6f4e37); }
.le-paper .ProseMirror { outline:none; font-family:Carlito, Calibri, sans-serif; font-size:11pt; line-height:1.28; color:#000; }
.le-paper .ProseMirror p { margin:0 0 6px; min-height:1.28em; } .le-paper .ProseMirror h1 { font-size:20pt; margin:6px 0; } .le-paper .ProseMirror h2 { font-size:15pt; margin:6px 0; } .le-paper .ProseMirror h3 { font-size:13pt; margin:6px 0; }
.le-paper .ProseMirror h1, .le-paper .ProseMirror h2, .le-paper .ProseMirror h3 { color:#000 !important; font-weight:700; line-height:1.25; }
.le-paper .ProseMirror ul, .le-paper .ProseMirror ol { margin:0 0 6px; padding-left:26px; } .le-paper .ProseMirror li p { margin:0 0 2px; }
.le-paper .ProseMirror hr { border:none; border-top:1px solid #475569; margin:8px 0; }
.le-paper .ProseMirror img { max-width:100%; height:auto; display:block; } .le-paper .ProseMirror img[style*="text-align: center"] { margin:0 auto; } .le-paper .ProseMirror img[style*="text-align: right"] { margin-left:auto; }
.le-paper .ProseMirror img.ProseMirror-selectednode { outline:2px solid var(--brand,#6f4e37); }
.le-paper .ProseMirror table { border-collapse:collapse; table-layout:fixed; width:100%; margin:0 0 8px; overflow:hidden; }
.le-paper .ProseMirror td, .le-paper .ProseMirror th { border:1px solid #475569; padding:4px 5px; vertical-align:top; position:relative; min-width:30px; box-sizing:border-box; }
.le-paper .ProseMirror th { background:#f1f5f9; text-align:left; } .le-paper .ProseMirror td p, .le-paper .ProseMirror th p { margin:0 0 2px; }
.le-paper .ProseMirror .selectedCell:after { content:''; position:absolute; inset:0; background:rgba(111,78,55,.18); pointer-events:none; }
.le-paper .ProseMirror .column-resize-handle { position:absolute; right:-2px; top:0; bottom:0; width:4px; background:var(--brand,#6f4e37); pointer-events:none; } .le-paper .ProseMirror.resize-cursor { cursor:col-resize; }
.le-paper .ProseMirror .tableWrapper { overflow-x:auto; }
.le-pb { border-top:2px dashed #94a3b8; margin:12px 0; text-align:center; height:0; position:relative; } .le-pb span { position:relative; top:-10px; background:#fff; padding:0 10px; font-size:9pt; color:#64748b; font-family:Inter,sans-serif; }
.le-salary { margin:8px 0; } .le-salary-tag { font:11px Inter,sans-serif; color:#2563eb; margin-bottom:4px; } .le-salary table { border-collapse:collapse; width:100%; } .le-salary td, .le-salary th { border:1px solid #94a3b8; padding:5px 8px; text-align:left; font-size:10.5pt; } .le-salary th { background:#f1f5f9; } .le-salary.ProseMirror-selectednode { outline:2px solid #2563eb; }
.le-sig { border:1px dashed #94a3b8; border-radius:6px; padding:12px; font-size:9pt; color:#64748b; margin:6px 0; width:200px; font-family:Inter,sans-serif; }
.le-word { background:#fef3c7; color:#92400e; border-radius:3px; }
.le-words { width:210px; flex:0 0 210px; border-left:1px solid #eadfd5; padding:10px; background:#fff; display:flex; flex-direction:column; gap:6px; max-height:100%; overflow:auto; }
.le-words-h { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; }
.le-words input { border:1px solid #e2d6c9; border-radius:8px; padding:6px 8px; font-size:.8rem; font-family:inherit; }
.le-words p { font-size:.72rem; color:#64748b; margin:0; line-height:1.4; }
.le-chips { display:flex; flex-wrap:wrap; gap:4px; } .le-chips button { border:1px solid #e2d6c9; background:#faf6f2; color:#6f4e37; border-radius:6px; font-size:.72rem; padding:3px 7px; cursor:pointer; font-family:inherit; } .le-chips button:hover { background:#efe6dd; }
.le-none2 { font-size:.74rem; color:#94a3b8; }
@media (max-width: 900px) { .le-body { flex-direction:column; } .le-words { width:auto; flex:none; border-left:none; border-top:1px solid #eadfd5; } .le-paper { padding:28px 18px; } }
`;
