// @ts-nocheck
// Draws a letter document (see letter-doc.ts) into a pdfkit page: fonts, sizes, colours, bold / italic / underline / strike, highlight, alignment
// (also justified), lists, tables (merged cells, cell colours), pictures, lines and page breaks. Words are placed one by one so the mix of fonts
// on a line is measured exactly. Drawn directly, so it works on a server without a browser.
import fs from 'fs';
import path from 'path';
import { DocNode } from './letter-doc';

const FONT_DIR = path.join(process.cwd(), 'node_modules', '@fontsource', 'carlito', 'files');
const CARLITO: Record<string, string> = { r: 'carlito-latin-400-normal.woff', b: 'carlito-latin-700-normal.woff', i: 'carlito-latin-400-italic.woff', bi: 'carlito-latin-700-italic.woff' };

// Calibri has no free copy, Carlito is the same size and shape. If its files are not on the server, Helvetica is used instead.
function registerFonts(doc: any): boolean {
  try {
    for (const k of Object.keys(CARLITO)) { const f = path.join(FONT_DIR, CARLITO[k]); if (!fs.existsSync(f)) return false; }
    doc.registerFont('Carlito', path.join(FONT_DIR, CARLITO.r));
    doc.registerFont('Carlito-Bold', path.join(FONT_DIR, CARLITO.b));
    doc.registerFont('Carlito-Italic', path.join(FONT_DIR, CARLITO.i));
    doc.registerFont('Carlito-BoldItalic', path.join(FONT_DIR, CARLITO.bi));
    return true;
  } catch { return false; }
}

const familyOf = (css: string, carlito: boolean) => {
  const f = String(css || '').toLowerCase();
  if (f.includes('times') || f.includes('georgia') || f.includes('serif') && !f.includes('sans')) return 'times';
  if (f.includes('courier') || f.includes('mono')) return 'courier';
  if (f.includes('arial') || f.includes('helvetica')) return 'helv';
  return carlito ? 'carlito' : 'helv';
};
const FONTS: Record<string, string[]> = {
  carlito: ['Carlito', 'Carlito-Bold', 'Carlito-Italic', 'Carlito-BoldItalic'],
  helv: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
  times: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
  courier: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'],
};
const fontName = (fam: string, bold: boolean, italic: boolean) => FONTS[fam][(bold ? 1 : 0) + (italic ? 2 : 0)];

const sizeOf = (v: any, dflt: number) => {
  const m = /^([\d.]+)\s*(pt|px)?$/i.exec(String(v ?? '').trim());
  if (!m) return dflt;
  const n = parseFloat(m[1]);
  return Math.min(72, Math.max(5, /px/i.test(m[2] || '') ? n * 0.75 : n));
};
const colorOf = (v: any, dflt: string) => {
  const s = String(v || '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s.length === 9 ? s.slice(0, 7) : s;
  const m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(s);
  return m ? '#' + [m[1], m[2], m[3]].map(x => Math.min(255, +x).toString(16).padStart(2, '0')).join('') : dflt;
};
const latin = (v: any) => String(v ?? '').replace(/₹/g, 'Rs. ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[•]/g, '*').replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '');

type Ctx = { doc: any; carlito: boolean; left: number; width: number; sigImg: Buffer | null; sigDrawn: boolean; img: (src: string) => any };
type St = { y: number; paged: boolean; dry: boolean };

const BASE = 11, GAP = 2.2, AFTER = 6;

// ---- one paragraph: words with their own fonts, wrapped into lines ----
type Item = { t: string; w: number; font: string; size: number; color: string; underline?: boolean; strike?: boolean; bg?: string; space?: boolean };
type Line = { items: Item[]; w: number; size: number; hard: boolean };

function inlineItems(ctx: Ctx, node: DocNode, base: { size: number; bold: boolean; family: string }): (Item | 'br')[] {
  const out: (Item | 'br')[] = [];
  const doc = ctx.doc;
  for (const n of node.content || []) {
    if (n.type === 'hardBreak') { out.push('br'); continue; }
    if (n.type !== 'text' || !n.text) continue;
    const marks = n.marks || [];
    const has = (t: string) => marks.find(m => m.type === t);
    const ts = marks.find(m => m.type === 'textStyle')?.attrs || {};
    const size = sizeOf(ts.fontSize, base.size);
    const fam = familyOf(ts.fontFamily || base.family, ctx.carlito);
    const font = fontName(fam, !!has('bold') || base.bold, !!has('italic'));
    const color = colorOf(ts.color, '#000000');
    const hl = has('highlight');
    const bg = hl ? colorOf(hl.attrs?.color, '#ffff00') : undefined;
    const underline = !!has('underline'), strike = !!has('strike');
    const parts = latin(n.text).split(/( +)/).filter(Boolean);
    for (const p of parts) {
      doc.font(font).fontSize(size);
      out.push({ t: p, w: doc.widthOfString(p), font, size, color, underline, strike, bg, space: /^ +$/.test(p) });
    }
  }
  return out;
}

function wrap(ctx: Ctx, items: (Item | 'br')[], width: number, dsize: number): Line[] {
  const lines: Line[] = [];
  let cur: Line = { items: [], w: 0, size: dsize, hard: false };
  const push = (hard: boolean) => {
    while (cur.items.length && cur.items[cur.items.length - 1].space) { cur.w -= cur.items.pop()!.w; }
    cur.hard = hard; if (cur.items.length) cur.size = Math.max(...cur.items.map(i => i.size));
    lines.push(cur); cur = { items: [], w: 0, size: dsize, hard: false };
  };
  for (const it of items) {
    if (it === 'br') { push(true); continue; }
    if (it.space && cur.items.length === 0 && lines.length > 0 && !lines[lines.length - 1].hard) continue; // no spaces at the start of a wrapped line
    if (!it.space && cur.w + it.w > width && cur.items.some(i => !i.space)) push(false);
    if (!it.space && it.w > width) { // a word wider than the line is cut
      let rest = it.t;
      while (rest) {
        let n = rest.length; ctx.doc.font(it.font).fontSize(it.size);
        while (n > 1 && ctx.doc.widthOfString(rest.slice(0, n)) > width) n--;
        const piece = rest.slice(0, n); rest = rest.slice(n);
        cur.items.push({ ...it, t: piece, w: ctx.doc.widthOfString(piece) }); cur.w += ctx.doc.widthOfString(piece);
        if (rest) push(false);
      }
      continue;
    }
    cur.items.push(it); cur.w += it.w;
  }
  push(true);
  return lines;
}

const lineH = (size: number) => size * 1.2 + GAP;

function paragraph(ctx: Ctx, node: DocNode, x0: number, W: number, st: St, o: { size?: number; bold?: boolean; before?: number; after?: number; align?: string } = {}) {
  const doc = ctx.doc, dsize = o.size || BASE;
  const items = inlineItems(ctx, node, { size: dsize, bold: !!o.bold, family: '' });
  const lines = wrap(ctx, items, W, dsize);
  const align = o.align || node.attrs?.textAlign || 'left';
  st.y += o.before || 0;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  lines.forEach((ln, li) => {
    const h = lineH(ln.size);
    if (st.paged && !st.dry && st.y + h > bottom()) { doc.addPage(); st.y = doc.page.margins.top; }
    if (!st.dry) {
      const spaces = ln.items.filter(i => i.space).length;
      let x = x0, extra = 0;
      if (align === 'center') x = x0 + (W - ln.w) / 2;
      else if (align === 'right') x = x0 + W - ln.w;
      else if (align === 'justify' && !ln.hard && li < lines.length - 1 && spaces) extra = (W - ln.w) / spaces;
      for (const it of ln.items) {
        const w = it.w + (it.space ? extra : 0);
        const top = st.y + (ln.size - it.size) * 0.85;
        if (it.bg) { doc.rect(x, st.y, w, h).fillColor(it.bg).fill(); }
        if (!it.space) { doc.fillColor(it.color).font(it.font).fontSize(it.size).text(it.t, x, top, { lineBreak: false }); }
        if (it.underline) { const yy = top + it.size * 1.05; doc.moveTo(x, yy).lineTo(x + w, yy).lineWidth(Math.max(0.5, it.size / 18)).strokeColor(it.color).stroke(); }
        if (it.strike) { const yy = top + it.size * 0.55; doc.moveTo(x, yy).lineTo(x + w, yy).lineWidth(Math.max(0.5, it.size / 18)).strokeColor(it.color).stroke(); }
        x += w;
      }
    }
    st.y += h;
  });
  st.y += o.after ?? AFTER;
}

const HEAD = { 1: 20, 2: 15, 3: 13, 4: 12, 5: 11, 6: 11 };

function blocks(ctx: Ctx, nodes: DocNode[], x0: number, W: number, st: St, cell = false) {
  const doc = ctx.doc;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  for (const n of nodes || []) {
    switch (n.type) {
      case 'paragraph': paragraph(ctx, n, x0, W, st, { after: cell ? 2 : AFTER }); break;
      case 'heading': paragraph(ctx, n, x0, W, st, { size: HEAD[n.attrs?.level || 2] || 14, bold: true, before: cell ? 0 : 4, after: cell ? 2 : 6 }); break;
      case 'bulletList':
      case 'orderedList': {
        let k = Number(n.attrs?.start) || 1;
        for (const li of n.content || []) {
          if (st.paged && !st.dry && st.y + lineH(BASE) > bottom()) { doc.addPage(); st.y = doc.page.margins.top; }
          const y0 = st.y, pg = doc.page;
          const first = (li.content || [])[0];
          const fs = first && first.type === 'paragraph' ? Math.max(BASE, ...((first.content || []).map(t => sizeOf((t.marks || []).find(m => m.type === 'textStyle')?.attrs?.fontSize, BASE)))) : BASE;
          if (!st.dry) {
            if (n.type === 'bulletList') { doc.circle(x0 + 8, y0 + fs * 0.6 + 1, 2).fillColor('#000000').fill(); }
            else { doc.fillColor('#000000').font(fontName(ctx.carlito ? 'carlito' : 'helv', false, false)).fontSize(BASE).text(`${k}.`, x0, y0 + 1, { width: 20, align: 'right', lineBreak: false }); }
          }
          blocks(ctx, li.content || [], x0 + 26, W - 26, st, true);
          k++;
          st.y += 1;
        }
        st.y += AFTER - 2;
        break;
      }
      case 'horizontalRule':
        if (st.paged && !st.dry && st.y + 14 > bottom()) { doc.addPage(); st.y = doc.page.margins.top; }
        if (!st.dry) doc.moveTo(x0, st.y + 6).lineTo(x0 + W, st.y + 6).lineWidth(0.8).strokeColor('#475569').stroke();
        st.y += 14; break;
      case 'pageBreak':
        if (!st.dry && st.paged) { if (st.y > doc.page.margins.top + 2) { doc.addPage(); } st.y = doc.page.margins.top; }
        break;
      case 'signatureMark':
        if (ctx.sigImg) {
          if (st.paged && !st.dry && st.y + 56 > bottom()) { doc.addPage(); st.y = doc.page.margins.top; }
          if (!st.dry) { try { doc.image(ctx.sigImg, x0, st.y, { fit: [120, 44] }); ctx.sigDrawn = true; } catch { /* left out */ } }
          st.y += 52;
        }
        ctx.sigDrawn = true; break;
      case 'image': {
        const im = ctx.img(n.attrs?.src);
        if (!im) break;
        const natural = im.width * 0.75;
        let w = n.attrs?.width ? Number(n.attrs.width) * 0.75 : natural;
        w = Math.max(10, Math.min(w, W)); const h = w * im.height / im.width;
        if (st.paged && !st.dry && st.y + h > bottom()) { doc.addPage(); st.y = doc.page.margins.top; }
        const al = n.attrs?.textAlign || 'left';
        const x = al === 'center' ? x0 + (W - w) / 2 : al === 'right' ? x0 + W - w : x0;
        if (!st.dry) { try { doc.image(im.buf, x, st.y, { width: w }); } catch { /* left out */ } }
        st.y += h + AFTER; break;
      }
      case 'table': table(ctx, n, x0, W, st); break;
      case 'blockquote': blocks(ctx, n.content || [], x0 + 18, W - 18, st, cell); break;
      default: if (n.content) blocks(ctx, n.content, x0, W, st, cell);
    }
  }
}

// ---- tables ----
function table(ctx: Ctx, node: DocNode, x0: number, W: number, st: St) {
  const doc = ctx.doc, PAD = 5;
  const rows = (node.content || []).filter(r => r.type === 'tableRow');
  if (!rows.length) return;
  // put the cells on a grid (a merged cell takes the places of the cells it covers)
  const taken: boolean[][] = rows.map(() => []);
  const cells: { r: number; c: number; cs: number; rs: number; node: DocNode }[] = [];
  let ncols = 0;
  rows.forEach((row, r) => {
    let c = 0;
    for (const cell of row.content || []) {
      while (taken[r][c]) c++;
      const cs = Math.max(1, Number(cell.attrs?.colspan) || 1), rs = Math.max(1, Number(cell.attrs?.rowspan) || 1);
      for (let i = 0; i < rs && r + i < rows.length; i++) for (let j = 0; j < cs; j++) taken[r + i][c + j] = true;
      cells.push({ r, c, cs, rs: Math.min(rs, rows.length - r), node: cell });
      c += cs; ncols = Math.max(ncols, c);
    }
  });
  if (!ncols) return;
  // column widths: as set in the editor, else all equal
  const given: number[] = new Array(ncols).fill(0);
  for (const cl of cells) { const cw = cl.node.attrs?.colwidth; if (Array.isArray(cw) && cw.length === cl.cs) cw.forEach((v: number, j: number) => { if (v) given[cl.c + j] = v * 0.75; }); }
  let widths: number[];
  if (given.every(v => v > 0)) { const sum = given.reduce((a, b) => a + b, 0); const f = sum > W ? W / sum : 1; widths = given.map(v => v * f); }
  else widths = new Array(ncols).fill(W / ncols);
  const xs = widths.reduce((a, w, i) => { a.push(a[i] + w); return a; }, [0]);
  const cellW = (cl: any) => xs[cl.c + cl.cs] - xs[cl.c];

  // heights
  const content = (cl: any) => { const s = { y: 0, paged: false, dry: true }; blocks(ctx, cl.node.content || [], 0, cellW(cl) - PAD * 2, s, true); return Math.max(14, s.y) + PAD * 2 - 2; };
  const hs = rows.map(() => 22);
  for (const cl of cells) if (cl.rs === 1) hs[cl.r] = Math.max(hs[cl.r], content(cl));
  for (const cl of cells) if (cl.rs > 1) { const have = hs.slice(cl.r, cl.r + cl.rs).reduce((a, b) => a + b, 0); const need = content(cl); if (need > have) hs[cl.r + cl.rs - 1] += need - have; }

  const bottom = () => doc.page.height - doc.page.margins.bottom;
  const total = hs.reduce((a, b) => a + b, 0);
  if (st.paged && !st.dry && st.y + total > bottom() && total < bottom() - doc.page.margins.top) { doc.addPage(); st.y = doc.page.margins.top; }
  const tableW = xs[ncols], tx = x0;
  for (let r = 0; r < rows.length; r++) {
    if (st.paged && !st.dry && st.y + hs[r] > bottom()) { doc.addPage(); st.y = doc.page.margins.top; }
    if (!st.dry) {
      for (const cl of cells.filter(c => c.r === r)) {
        const h = hs.slice(cl.r, cl.r + cl.rs).reduce((a, b) => a + b, 0), x = tx + xs[cl.c], w = cellW(cl);
        const header = cl.node.type === 'tableHeader';
        const bgc = cl.node.attrs?.backgroundColor ? colorOf(cl.node.attrs.backgroundColor, '') : header ? '#f1f5f9' : '';
        if (bgc) doc.rect(x, st.y, w, h).fillColor(bgc).fill();
        doc.rect(x, st.y, w, h).lineWidth(0.8).strokeColor('#475569').stroke();
        const s2 = { y: st.y + PAD, paged: false, dry: false };
        const nodes = header ? (cl.node.content || []).map(p => p.type === 'paragraph' ? { ...p, content: (p.content || []).map(t => t.type === 'text' ? { ...t, marks: [...(t.marks || []), { type: 'bold' }] } : t) } : p) : cl.node.content || [];
        blocks(ctx, nodes, x + PAD, w - PAD * 2, s2, true);
      }
    }
    st.y += hs[r];
  }
  st.y += AFTER + 2;
}

// ---- the whole document ----
export function drawDoc(doc: any, root: DocNode, o: { left: number; width: number; sigImg: Buffer | null }) {
  const carlito = registerFonts(doc);
  const cache = new Map<string, any>();
  const ctx: Ctx = {
    doc, carlito, left: o.left, width: o.width, sigImg: o.sigImg, sigDrawn: false,
    img: (src: string) => {
      if (cache.has(src)) return cache.get(src);
      let r = null;
      const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(String(src || ''));
      if (m) { try { const buf = Buffer.from(m[2], 'base64'); const im = doc.openImage(buf); r = { buf, width: im.width, height: im.height }; } catch { r = null; } }
      cache.set(src, r); return r;
    },
  };
  const st: St = { y: doc.y, paged: true, dry: false };
  const marked = JSON.stringify(root).includes('"signatureMark"');
  blocks(ctx, root.content || [], o.left, o.width, st);
  // no <signature> place in the letter: the signature of the authorised person goes at the end
  if (o.sigImg && !marked) {
    if (st.y > doc.page.height - doc.page.margins.bottom - 70) { doc.addPage(); st.y = doc.page.margins.top; }
    try { doc.image(o.sigImg, o.left, st.y, { fit: [120, 44] }); st.y += 52; } catch { /* left out */ }
  }
  doc.y = st.y; doc.x = o.left;
}
