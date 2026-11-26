import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';

// The text box of an email, with the same buttons as a mail program: font, size, bold, italic, underline, colour, alignment, lists, indent,
// quote, strikethrough and links. value / onChange are the mail as HTML; a template written before as plain words (new lines, {{words}})
// opens as it was. Words like {{name}} can be put in with ref.insert('{{name}}').

const FONTS = [['Sans Serif', 'Arial, Helvetica, sans-serif'], ['Serif', 'Georgia, serif'], ['Fixed width', '"Courier New", monospace'], ['Verdana', 'Verdana, Geneva, sans-serif'], ['Tahoma', 'Tahoma, Geneva, sans-serif'], ['Times New Roman', '"Times New Roman", Times, serif'], ['Trebuchet', '"Trebuchet MS", sans-serif']];
const SIZES = [['Small', '12px'], ['Normal', ''], ['Large', '18px'], ['Huge', '26px']];
const COLORS = ['#000000', '#434343', '#666666', '#b91c1c', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ffffff'];
const MARKS = ['#fde047', '#bbf7d0', '#bae6fd', '#fbcfe8', '#fed7aa', '#e2e8f0'];

const hasBlock = (s) => /<\/?(p|div|br|table|tr|td|ul|ol|li|h[1-6]|blockquote)\b/i.test(String(s || ''));
// a plain text (new lines, maybe a few tags typed by hand) as HTML paragraphs; HTML stays as it is
export const mailToHtml = (v) => {
  const t = String(v || '').replace(/\r\n?/g, '\n').trim();
  if (!t) return '';
  if (hasBlock(t)) return t;
  return t.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
};

// the space a paragraph is moved in by (Indent buttons)
const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: { indent: {
      default: 0,
      parseHTML: el => Math.round((parseInt(el.style.marginLeft, 10) || 0) / 30),
      renderHTML: a => (a.indent ? { style: `margin-left:${a.indent * 30}px` } : {}),
    } } }];
  },
});

const I = ({ d }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const lines = (rows) => rows.map(([x1, x2], i) => <line key={i} x1={x1} y1={6 + i * 4} x2={x2} y2={6 + i * 4} />);
const IC = {
  left: <I d={lines([[3, 21], [3, 14], [3, 18], [3, 12], [3, 21]])} />, center: <I d={lines([[3, 21], [7, 17], [5, 19], [8, 16], [3, 21]])} />,
  right: <I d={lines([[3, 21], [10, 21], [6, 21], [12, 21], [3, 21]])} />, justify: <I d={lines([[3, 21], [3, 21], [3, 21], [3, 21], [3, 21]])} />,
  bullet: <I d={<><line x1="9" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>} />,
  number: <I d={<><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 5l1-1v4M3.5 14h2l-2 3h2" /></>} />,
  outdent: <I d={<><line x1="11" y1="6" x2="21" y2="6" /><line x1="11" y1="12" x2="21" y2="12" /><line x1="11" y1="18" x2="21" y2="18" /><path d="M7 8l-4 4 4 4z" /></>} />,
  indent: <I d={<><line x1="11" y1="6" x2="21" y2="6" /><line x1="11" y1="12" x2="21" y2="12" /><line x1="11" y1="18" x2="21" y2="18" /><path d="M3 8l4 4-4 4z" /></>} />,
  link: <I d={<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>} />,
  clear: <I d={<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />} />,
  undo: <I d={<><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></>} />,
  redo: <I d={<><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></>} />,
};

function Btn({ title, on, off, onClick, children, style }) {
  return <button type="button" className={`gm-b${on ? ' on' : ''}`} title={title} aria-label={title} disabled={off} onMouseDown={e => e.preventDefault()} onClick={onClick} style={style}>{children}</button>;
}
function Colors({ title, label, colors, value, onPick, onClear, clearText }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open]);
  return (
    <span className="gm-pop" ref={ref}>
      <button type="button" className="gm-b" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}>{label}<i className="gm-bar" style={{ background: value || 'transparent' }} /></button>
      {open && (
        <div className="gm-menu" onMouseDown={e => e.preventDefault()}>
          <div className="gm-sw">{colors.map(c => <button type="button" key={c} style={{ background: c }} title={c} onClick={() => { onPick(c); setOpen(false); }} />)}</div>
          <label className="gm-own">Other <input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={e => onPick(e.target.value)} /></label>
          <button type="button" className="gm-none" onClick={() => { onClear(); setOpen(false); }}>{clearText}</button>
        </div>
      )}
    </span>
  );
}

const MailEditor = React.forwardRef(function MailEditor({ value, onChange, minHeight = 220, placeholder = '' }, ref) {
  const last = useRef(null);
  const initial = useMemo(() => mailToHtml(value), []); // eslint-disable-line
  const editor = useEditor({
    immediatelyRender: false,
    content: initial,
    extensions: [
      StarterKit.configure({ heading: false, code: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false, autolink: false, HTMLAttributes: { style: 'color:#2563eb', target: '_blank', rel: 'noopener noreferrer' } } }),
      TextAlign.configure({ types: ['paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      TextStyle, Color, FontFamily, FontSize, Indent,
      Highlight.configure({ multicolor: true }),
    ],
    onUpdate: ({ editor: ed }) => {
      // an empty paragraph is kept as a blank line in the mail
      const html = ed.isEmpty ? '' : ed.getHTML().replace(/<p([^>]*)><\/p>/g, '<p$1><br></p>');
      last.current = html; onChange && onChange(html);
    },
  });
  // a text that comes from outside (another template was chosen) replaces the content
  useEffect(() => {
    if (!editor) return;
    const v = value || '';
    if (v === last.current) return;
    last.current = v;
    editor.commands.setContent(mailToHtml(v), { emitUpdate: false });
  }, [value, editor]);
  useImperativeHandle(ref, () => ({ insert: (text) => { if (editor) editor.chain().focus().insertContent(text).run(); }, focus: () => editor && editor.commands.focus() }), [editor]);

  if (!editor) return <div className="gm-loading">Loading the editor...</div>;
  const chain = () => editor.chain().focus();
  const ts = editor.getAttributes('textStyle');
  const fam = FONTS.find(f => f[1] === ts.fontFamily);
  const size = SIZES.find(s => s[1] && s[1] === ts.fontSize);
  const indentBy = (d) => {
    if (editor.isActive('listItem')) { if (d > 0) chain().sinkListItem('listItem').run(); else chain().liftListItem('listItem').run(); return; }
    const cur = editor.getAttributes('paragraph').indent || 0;
    chain().updateAttributes('paragraph', { indent: Math.max(0, Math.min(8, cur + d)) }).run();
  };
  const link = async () => {
    const prev = editor.getAttributes('link').href || '';
    const { from, to } = editor.state.selection;
    const picked = editor.state.doc.textBetween(from, to, ' ');
    const r = await Swal.fire({
      title: prev ? 'Change the link' : 'Add a link',
      html: '<div style="text-align:left;font-size:13px;font-weight:600;margin:6px 0 3px">Words to show</div><input id="gm-t" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box" placeholder="For example: Open in Google Maps">'
        + '<div style="text-align:left;font-size:13px;font-weight:600;margin:12px 0 3px">Web address</div><input id="gm-u" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box" placeholder="https://maps.app.goo.gl/...">',
      didOpen: () => { const t = document.getElementById('gm-t'), u = document.getElementById('gm-u'); if (picked) t.value = picked; if (prev) u.value = prev; (picked ? u : t).focus(); },
      showCancelButton: true, showDenyButton: !!prev, denyButtonText: 'Remove the link', confirmButtonText: prev ? 'Save' : 'Add the link',
      preConfirm: () => {
        const t = document.getElementById('gm-t').value.trim();
        let u = document.getElementById('gm-u').value.trim();
        if (!t) { Swal.showValidationMessage('Type the words to show'); return false; }
        if (!u) { Swal.showValidationMessage('Type the web address'); return false; }
        if (!/^(https?:\/\/|mailto:)/i.test(u)) u = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) ? 'mailto:' + u : 'https://' + u;
        return { t, u };
      },
    });
    if (r.isDenied) { chain().extendMarkRange('link').unsetLink().run(); return; }
    if (!r.isConfirmed) return;
    if (picked && picked === r.value.t) chain().extendMarkRange('link').setLink({ href: r.value.u }).run();
    else chain().insertContent({ type: 'text', text: r.value.t, marks: [{ type: 'link', attrs: { href: r.value.u } }] }).run();
  };

  return (
    <div className="gm">
      <style>{GM_CSS}</style>
      <div className="gm-tools" role="toolbar" aria-label="Formatting">
        <select className="gm-sel" aria-label="Font" style={{ width: 118 }} value={fam ? fam[1] : ''} onChange={e => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}>
          <option value="">Sans Serif</option>
          {FONTS.slice(1).map(([n, v]) => <option key={n} value={v}>{n}</option>)}
        </select>
        <select className="gm-sel" aria-label="Size" style={{ width: 82 }} value={size ? size[1] : ''} onChange={e => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}>
          {SIZES.map(([n, v]) => <option key={n} value={v}>{n}</option>)}
        </select>
        <span className="gm-sep" />
        <Btn title="Bold (Ctrl+B)" on={editor.isActive('bold')} onClick={() => chain().toggleBold().run()} style={{ fontWeight: 800 }}>B</Btn>
        <Btn title="Italic (Ctrl+I)" on={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()} style={{ fontStyle: 'italic', fontFamily: 'serif' }}>I</Btn>
        <Btn title="Underline (Ctrl+U)" on={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()} style={{ textDecoration: 'underline' }}>U</Btn>
        <Colors title="Text colour" label={<b style={{ fontSize: 15 }}>A</b>} colors={COLORS} value={ts.color} onPick={c => chain().setColor(c).run()} onClear={() => chain().unsetColor().run()} clearText="Automatic" />
        <Colors title="Highlight" label={<b style={{ fontSize: 12, background: '#fde047', padding: '0 3px', borderRadius: 2 }}>ab</b>} colors={MARKS} value={editor.getAttributes('highlight').color} onPick={c => chain().setHighlight({ color: c }).run()} onClear={() => chain().unsetHighlight().run()} clearText="No highlight" />
        <span className="gm-sep" />
        {['left', 'center', 'right', 'justify'].map(a => <Btn key={a} title={`Align ${a}`} on={editor.isActive({ textAlign: a })} onClick={() => chain().setTextAlign(a).run()}>{IC[a]}</Btn>)}
        <span className="gm-sep" />
        <Btn title="Numbered list" on={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>{IC.number}</Btn>
        <Btn title="Bulleted list" on={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>{IC.bullet}</Btn>
        <Btn title="Decrease indent" onClick={() => indentBy(-1)}>{IC.outdent}</Btn>
        <Btn title="Increase indent" onClick={() => indentBy(1)}>{IC.indent}</Btn>
        <Btn title="Quote" on={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><b style={{ fontSize: 17, lineHeight: 1 }}>&ldquo;</b></Btn>
        <Btn title="Strikethrough" on={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()} style={{ textDecoration: 'line-through' }}>S</Btn>
        <span className="gm-sep" />
        <Btn title="Add or change a link" on={editor.isActive('link')} onClick={link}>{IC.link}</Btn>
        <Btn title="Remove the formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>{IC.clear}</Btn>
        <Btn title="Undo (Ctrl+Z)" off={!editor.can().undo()} onClick={() => chain().undo().run()}>{IC.undo}</Btn>
        <Btn title="Redo (Ctrl+Y)" off={!editor.can().redo()} onClick={() => chain().redo().run()}>{IC.redo}</Btn>
      </div>
      <div className="gm-page" style={{ minHeight }} onClick={() => editor.commands.focus()}>
        {placeholder && editor.isEmpty && <div className="gm-ph">{placeholder}</div>}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
export default MailEditor;

const GM_CSS = `
.gm { border:1.5px solid #dbe2ea; border-radius:10px; background:#fff; overflow:visible; }
.gm:focus-within { border-color:var(--brand,#6f4e37); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.gm-loading { padding:18px; color:#94a3b8; text-align:center; }
.gm-tools { display:flex; flex-wrap:wrap; align-items:center; gap:2px; padding:6px 8px; background:#f1f5f9; border-radius:9px 9px 0 0; border-bottom:1px solid #e2e8f0; }
.gm-sel { height:28px; border:1px solid #d5dbe3; border-radius:6px; background:#fff; font-size:.78rem; font-family:inherit; padding:0 4px; color:#334155; margin-right:2px; }
.gm-b { min-width:28px; height:28px; padding:0 6px; border:1px solid transparent; background:transparent; border-radius:6px; cursor:pointer; color:#334155; font-size:.84rem; font-family:inherit; display:inline-flex; align-items:center; justify-content:center; position:relative; }
.gm-b:hover:not(:disabled) { background:#e2e8f0; } .gm-b.on { background:#dbe4f0; border-color:#c3d0e2; color:#1e3a8a; } .gm-b:disabled { opacity:.35; cursor:default; }
.gm-sep { width:1px; height:18px; background:#d5dbe3; margin:0 5px; }
.gm-bar { position:absolute; left:5px; right:5px; bottom:1px; height:3px; border-radius:2px; border:1px solid #e2e8f0; }
.gm-pop { position:relative; display:inline-block; } .gm-menu { position:absolute; top:32px; left:0; z-index:40; background:#fff; border:1px solid #d5dbe3; border-radius:10px; padding:10px; box-shadow:0 10px 30px rgba(15,23,42,.18); min-width:150px; }
.gm-sw { display:grid; grid-template-columns:repeat(6,22px); gap:5px; } .gm-sw button { width:22px; height:22px; border-radius:5px; border:1px solid #cbd5e1; cursor:pointer; padding:0; }
.gm-own { display:flex; align-items:center; justify-content:space-between; font-size:.74rem; color:#64748b; margin-top:8px; } .gm-own input { width:34px; height:22px; padding:0; border:none; background:none; }
.gm-none { margin-top:6px; width:100%; border:1px solid #d5dbe3; background:#fff; border-radius:6px; font-size:.74rem; padding:4px; cursor:pointer; font-family:inherit; color:#475569; }
.gm-page { position:relative; padding:14px 16px; cursor:text; }
.gm-ph { position:absolute; left:16px; top:14px; color:#94a3b8; pointer-events:none; font-size:14px; }
.gm-page .ProseMirror { outline:none; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.6; color:#1f2937; min-height:inherit; }
.gm-page .ProseMirror p { margin:0 0 12px; } .gm-page .ProseMirror ul, .gm-page .ProseMirror ol { margin:0 0 12px; padding-left:28px; } .gm-page .ProseMirror li p { margin:0 0 2px; }
.gm-page .ProseMirror blockquote { margin:0 0 12px; padding-left:14px; border-left:3px solid #cbd5e1; color:#475569; }
.gm-page .ProseMirror a { color:#2563eb; text-decoration:underline; }
`;
