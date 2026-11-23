import React, { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
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
  parseHTML() { return [{ tag: 'div[data-page-break]' }]; },
  renderHTML() { return ['div', { 'data-page-break': '', class: 'le-pb' }, ['span', {}, 'Page break']]; },
});
const SignatureMark = Node.create({
  name: 'signatureMark', group: 'block', atom: true, selectable: true,
  parseHTML() { return [{ tag: 'div[data-signature]' }]; },
  renderHTML() { return ['div', { 'data-signature': '', class: 'le-sig' }, 'Signature of the authorised person']; },
});
// The salary table of a letter. Its figures are worked out for each letter (monthly salary x the Salary Breakup); here the table is shown
// with a sample salary so the layout can be seen. It is one block: it can be moved or deleted, not edited cell by cell.
const SAMPLE_SALARY = 60000;
let breakupCache = null;
const loadBreakup = () => {
  if (!breakupCache) {
    let token = ''; try { token = sessionStorage.getItem('token') || ''; } catch { /* none */ }
    breakupCache = fetch('/api/letters/breakup', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(j => ({ rows: Array.isArray(j.rows) ? j.rows : [], columns: j.columns || [] })).catch(() => { breakupCache = null; return { rows: [], columns: [] }; });
  }
  return breakupCache;
};
const inr = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');
const SalaryTable = Node.create({
  name: 'salaryTable', group: 'block', atom: true, selectable: true, draggable: true,
  parseHTML() { return [{ tag: 'div[data-salary-table]' }]; },
  renderHTML() { return ['div', { 'data-salary-table': '', class: 'le-salary' }, 'Salary table']; },
  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.className = 'le-salary'; dom.setAttribute('data-salary-table', ''); dom.contentEditable = 'false';
      const paint = ({ rows, columns }) => {
        const esc = (t) => String(t || '').replace(/</g, '&lt;');
        const list = rows.filter(r => r.name && r.percent > 0);
        const body = list.map(r => { const m = Math.round(SAMPLE_SALARY * r.percent / 100); return `<tr><td>${r.name.replace(/</g, '&lt;')}</td><td>${inr(m)}</td><td>${inr(m * 12)}</td>${columns.map((_, k) => `<td>${esc((r.extra || [])[k]) || '-'}</td>`).join('')}</tr>`; }).join('');
        dom.innerHTML = `<div class="le-salary-tag">Salary table - worked out for each letter from its monthly salary (sample: ${inr(SAMPLE_SALARY)} a month)</div>`
          + `<table><tbody><tr><th>Salary Component</th><th>Monthly</th><th>Yearly</th>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${body}<tr><th>Grand Total</th><th>${inr(SAMPLE_SALARY)}</th><th>${inr(SAMPLE_SALARY * 12)}</th>${columns.map(() => '<th>-</th>').join('')}</tr></tbody></table>`;
      };
      paint({ rows: [], columns: [] }); loadBreakup().then(paint);
      return { dom };
    };
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
};

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

export default function LetterEditor({ value, onChange, words, height = 620, salary = true, readOnly = false }) {
  const last = useRef(null);
  const fileRef = useRef(null);
  const [q, setQ] = useState('');
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
      PageBreak, SignatureMark, SalaryTable, WordMarks,
    ],
    onUpdate: ({ editor: ed }) => { const s = JSON.stringify(ed.getJSON()); last.current = s; onChange && onChange(s); },
  });
  // a text that comes from outside (another letter was opened, the text was filled) replaces the document
  useEffect(() => {
    if (!editor) return;
    if (value === last.current) return;
    last.current = value;
    editor.commands.setContent(docOf(value), { emitUpdate: false });
  }, [value, editor]);

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
  const cellColor = (c) => editor.chain().focus().setCellAttribute('backgroundColor', c).run();
  if (!editor) return <div className="le-loading">Loading the editor...</div>;

  const shown = (words || []).filter(([k, l]) => !q.trim() || (k + ' ' + l).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="le">
      <style>{LE_CSS}</style>
      {!readOnly && (
        <div className="le-tools" role="toolbar" aria-label="Formatting">
          <div className="le-row">
            <Btn title="Undo (Ctrl+Z)" off={!editor.can().undo()} onClick={() => chain().undo().run()}>{ICON.undo}</Btn>
            <Btn title="Redo (Ctrl+Y)" off={!editor.can().redo()} onClick={() => chain().redo().run()}>{ICON.redo}</Btn>
            <span className="le-sep" />
            <select className="le-sel" aria-label="Style" value={headingLevel} onChange={e => { const l = Number(e.target.value); if (l) chain().setHeading({ level: l }).run(); else chain().setParagraph().run(); }}>
              <option value={0}>Normal text</option><option value={1}>Heading 1</option><option value={2}>Heading 2</option><option value={3}>Heading 3</option>
            </select>
            <select className="le-sel" aria-label="Font" style={{ width: 130 }} value={family ? family[1] : ''} onChange={e => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}>
              <option value="">Calibri</option>
              {FONTS.slice(1).map(([n, v]) => <option key={n} value={v}>{n}</option>)}
            </select>
            <select className="le-sel" aria-label="Font size" style={{ width: 64 }} value={sizePt || ''} onChange={e => (e.target.value ? chain().setFontSize(`${e.target.value}pt`).run() : chain().unsetFontSize().run())}>
              <option value="">11</option>
              {SIZES.filter(s => s !== 11).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="le-sep" />
            <Btn title="Bold (Ctrl+B)" on={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} style={{ fontWeight: 800 }}>B</Btn>
            <Btn title="Italic (Ctrl+I)" on={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} style={{ fontStyle: 'italic', fontFamily: 'serif' }}>I</Btn>
            <Btn title="Underline (Ctrl+U)" on={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} style={{ textDecoration: 'underline' }}>U</Btn>
            <Btn title="Strikethrough" on={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()} style={{ textDecoration: 'line-through' }}>S</Btn>
            <Swatches title="Text colour" label={<b style={{ fontSize: 14 }}>A</b>} colors={COLORS} value={attrs.color} onPick={c => chain().setColor(c).run()} onClear={() => chain().unsetColor().run()} clearText="Automatic" />
            <Swatches title="Highlight" label={<b style={{ fontSize: 13, background: '#fde047', padding: '0 3px', borderRadius: 2 }}>ab</b>} colors={MARKS} value={editor.getAttributes('highlight').color} onPick={c => chain().setHighlight({ color: c }).run()} onClear={() => chain().unsetHighlight().run()} clearText="No highlight" />
            <span className="le-sep" />
            {['left', 'center', 'right', 'justify'].map(a => <Btn key={a} title={`Align ${a}`} on={editor.isActive({ textAlign: a })} onClick={() => chain().setTextAlign(a).run()}>{ICON[a]}</Btn>)}
            <span className="le-sep" />
            <Btn title="Bulleted list" on={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>{ICON.bullet}</Btn>
            <Btn title="Numbered list" on={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>{ICON.number}</Btn>
            <Btn title="Make the list point go in" off={!editor.can().sinkListItem('listItem')} onClick={() => chain().sinkListItem('listItem').run()} wide>&rarr; Indent</Btn>
            <Btn title="Make the list point come out" off={!editor.can().liftListItem('listItem')} onClick={() => chain().liftListItem('listItem').run()} wide>&larr; Outdent</Btn>
            <Btn title="Remove the formatting of the selected text" onClick={() => chain().unsetAllMarks().clearNodes().run()}>{ICON.clear}</Btn>
          </div>
          <div className="le-row">
            <span className="le-lab">Insert</span>
            <TablePicker onPick={(r, c) => chain().insertTable({ rows: r, cols: c, withHeaderRow: true }).run()} />
            {salary && <Btn wide title="The salary table, worked out for each letter from its monthly salary and the Salary Breakup" onClick={() => chain().insertContent({ type: 'salaryTable' }).run()}>{ICON.table} Salary table (calculated)</Btn>}
            <Btn wide title="Insert a picture" onClick={() => fileRef.current && fileRef.current.click()}>{ICON.image} Picture</Btn>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { addPicture(e.target.files[0]); e.target.value = ''; }} />
            <Btn wide title="A line across the page" onClick={() => chain().setHorizontalRule().run()}>{ICON.hr} Line</Btn>
            <Btn wide title="The rest of the letter starts on a new page" onClick={() => chain().insertContent({ type: 'pageBreak' }).run()}>Page break</Btn>
            <Btn wide title="The signature of the authorised person (Payslip Settings) goes here" onClick={() => chain().insertContent({ type: 'signatureMark' }).run()}>Signature</Btn>
            {onImage && (
              <label className="le-w">Picture width <input type="number" min={20} max={720} value={editor.getAttributes('image').width || ''} onChange={e => chain().updateAttributes('image', { width: Number(e.target.value) || null }).run()} /> px</label>
            )}
          </div>
          {inTable && (
            <div className="le-row le-trow">
              <span className="le-lab">Table</span>
              <Btn wide title="A row above" onClick={() => chain().addRowBefore().run()}>+ Row above</Btn>
              <Btn wide title="A row below" onClick={() => chain().addRowAfter().run()}>+ Row below</Btn>
              <Btn wide title="A column on the left" onClick={() => chain().addColumnBefore().run()}>+ Column left</Btn>
              <Btn wide title="A column on the right" onClick={() => chain().addColumnAfter().run()}>+ Column right</Btn>
              <Btn wide title="Delete the row" onClick={() => chain().deleteRow().run()}>Delete row</Btn>
              <Btn wide title="Delete the column" onClick={() => chain().deleteColumn().run()}>Delete column</Btn>
              <Btn wide title="Join the selected cells (drag over them first)" off={!editor.can().mergeCells()} onClick={() => chain().mergeCells().run()}>Merge cells</Btn>
              <Btn wide title="Split a joined cell" off={!editor.can().splitCell()} onClick={() => chain().splitCell().run()}>Split cell</Btn>
              <Btn wide title="The first row as a heading" onClick={() => chain().toggleHeaderRow().run()}>Heading row</Btn>
              <Swatches title="Colour of the cell" label={<span style={{ fontSize: 12, fontWeight: 700 }}>Cell colour</span>} colors={CELLS} value={editor.getAttributes('tableCell').backgroundColor || editor.getAttributes('tableHeader').backgroundColor} onPick={cellColor} onClear={() => chain().setCellAttribute('backgroundColor', null).run()} clearText="No colour" />
              <Btn wide title="Delete the whole table" onClick={() => chain().deleteTable().run()}><span style={{ color: '#b91c1c' }}>Delete table</span></Btn>
            </div>
          )}
        </div>
      )}
      <div className="le-body">
        <div className="le-desk" style={{ maxHeight: height }}>
          <div className="le-paper"><EditorContent editor={editor} /></div>
        </div>
        {words && !readOnly && (
          <aside className="le-words">
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
    </div>
  );
}

const LE_CSS = `
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
.le-body { display:flex; align-items:stretch; }
.le-desk { flex:1; min-width:0; overflow:auto; background:#e8e2dc; padding:18px 12px; }
.le-paper { width:794px; max-width:100%; margin:0 auto; background:#fff; box-shadow:0 2px 14px rgba(15,23,42,.18); padding:56px 75px; min-height:1000px; box-sizing:border-box; color:#000; }
.le-paper .ProseMirror { outline:none; font-family:Carlito, Calibri, sans-serif; font-size:11pt; line-height:1.28; color:#000; min-height:880px; }
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
