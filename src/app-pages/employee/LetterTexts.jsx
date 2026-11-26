import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { appLocale } from '@/lib/app-config-client';
import { isDocBody, docFromMarkup, parseDoc, docHasContent } from '@/lib/letter-doc';
import LetterEditor from './LetterEditor';

// Letter texts: the kinds of letter (offer, appointment, ...). The page lists them; a letter opens on its own page in a Word-like editor.
// /letters/texts (the list), /letters/texts/edit/:type (one letter), /letters/texts/new (a new kind of letter).
const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const when = (v) => { try { return new Date(v).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; } };

// the first words of a letter, for the card
function snippet(body) {
  let d = null;
  try { d = isDocBody(body) ? parseDoc(body) : docFromMarkup(String(body || '')); } catch { d = null; }
  const out = [];
  const walk = (n) => { if (out.join(' ').length > 140) return; if (n.type === 'text') out.push(n.text); (n.content || []).forEach(walk); };
  if (d) walk(d);
  return out.join(' ').replace(/\{\{[^}]*\}\}/g, '...').replace(/\s+/g, ' ').trim().slice(0, 130);
}

function useTemplates() {
  const [data, setData] = useState({ templates: [], placeholders: [] });
  const [ready, setReady] = useState(false);
  const load = useCallback(() => fetch(`${API}/letters/templates`, { headers: auth() }).then(r => r.json()).then(d => { setData({ templates: d.templates || [], placeholders: d.placeholders || [] }); setReady(true); return d; }).catch(() => setReady(true)), []);
  useEffect(() => { load(); }, [load]);
  return { data, ready, load };
}

export default function LetterTexts({ mode = 'list' }) {
  return (
    <div>
      <style>{LTX_CSS}</style>
      {mode === 'list' ? <List /> : <Edit />}
    </div>
  );
}

function List() {
  const navigate = useNavigate();
  const { data, ready, load } = useTemplates();
  const removeCard = async (t) => {
    const c = await Swal.fire({ icon: 'warning', title: `Remove "${t.name}"?`, text: 'Letters already made stay as they are. New ones of this kind cannot be made.', showCancelButton: true, confirmButtonText: 'Remove', confirmButtonColor: '#dc2626' });
    if (!c.isConfirmed) return;
    try {
      const res = await fetch(`${API}/letters/templates?letter_type=${encodeURIComponent(t.letter_type)}`, { method: 'DELETE', headers: auth() });
      const r = await res.json().catch(() => ({})); if (!res.ok) throw new Error(r.detail || 'Could not remove');
      load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not removed', text: e.message }); }
  };
  return (
    <>
      <div className="ph">
        <div><h1>Letter texts</h1><p>The kinds of letter. Open one to write it like a Word document: fonts, tables, pictures. It is written once and used every time that letter is made.</p></div>
        <button className="btn-premium" onClick={() => navigate('/letters/texts/new')}>+ Add a letter</button>
      </div>
      {!ready && <div className="ltx-empty">Loading...</div>}
      {ready && data.templates.length === 0 && <div className="ltx-empty">No letter yet. Add one with the button above.</div>}
      <div className="ltx-cards">
        {data.templates.map(t => (
          <div key={t.letter_type} className="ltx-wrap">
          <button type="button" className="ltx-card" onClick={() => navigate(`/letters/texts/edit/${t.letter_type}`)}>
            <div className="ltx-top"><span className="ltx-ico">&#9998;</span><span className={`ltx-tag${t.has_standard ? '' : ' own'}`}>{t.has_standard ? 'Standard' : 'Your own'}</span></div>
            <b>{t.name}</b>
            <p>{snippet(t.body) || 'No text yet.'}</p>
            <small>{t.updated_at ? `Saved ${when(t.updated_at)}${t.updated_by ? ' by ' + String(t.updated_by).split('@')[0] : ''}` : 'Not changed yet'}</small>
          </button>
          <button type="button" className="ltx-rm" title="Remove this letter" aria-label={`Remove ${t.name}`} onClick={() => removeCard(t)}>Remove</button>
          </div>
        ))}
        <button type="button" className="ltx-card ltx-new" onClick={() => navigate('/letters/texts/new')}><span>+</span><b>Add a letter</b><small>A new kind of letter</small></button>
      </div>
    </>
  );
}

async function previewUrl(text, title) {
  const res = await fetch(`${API}/letters/preview-pdf`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sample: true, title }) });
  if (!res.ok) { let m = 'Could not make the preview'; try { m = (await res.json()).detail || m; } catch { /* not json */ } throw new Error(m); }
  return URL.createObjectURL(await res.blob());
}

function Edit() {
  const navigate = useNavigate();
  const { type } = useParams();
  const isNew = !type;
  const { data, ready, load } = useTemplates();
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('edit');
  const [pdf, setPdf] = useState({ url: '', err: '', busy: false });
  const cur = data.templates.find(t => t.letter_type === type);

  useEffect(() => { if (cur) { setName(cur.name); setBody(cur.body); setSaved(cur.body); } }, [cur && cur.letter_type, cur && cur.updated_at]); // eslint-disable-line
  const dirty = isNew ? (!!name.trim() || body.trim().length > 0) : body !== saved;

  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const back = async () => {
    if (dirty) { const c = await Swal.fire({ icon: 'question', title: 'Leave without saving?', text: 'The changes you made to this letter will be lost.', showCancelButton: true, confirmButtonText: 'Leave' }); if (!c.isConfirmed) return; }
    navigate('/letters/texts');
  };

  const showPreview = async () => {
    setView('preview');
    setPdf(p => ({ ...p, busy: true, err: '' }));
    try {
      const text = body || (cur ? cur.body : '');
      if (!String(text).trim()) throw new Error('Nothing is written yet');
      const url = await previewUrl(isDocBody(text) ? text : JSON.stringify(docFromMarkup(text)), name || 'Letter');
      setPdf(p => { if (p.url) URL.revokeObjectURL(p.url); return { url, err: '', busy: false }; });
    } catch (e) { setPdf(p => ({ ...p, busy: false, err: e.message })); }
  };

  const create = async () => {
    if (!name.trim()) { Swal.fire({ icon: 'warning', title: 'Give the letter a name' }); return; }
    const d = isDocBody(body) ? parseDoc(body) : null;
    if (!d || !docHasContent(d)) { Swal.fire({ icon: 'warning', title: 'Write the letter first', text: 'Type the text of the letter in the page.' }); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/templates`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name, body }) });
      const r = await res.json(); if (!res.ok) throw new Error(r.detail || 'Could not add');
      await load(); setSaved(body);
      await Swal.fire({ icon: 'success', title: 'Letter added', timer: 1200, showConfirmButton: false });
      navigate('/letters/texts', { replace: true });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not added', text: e.message }); }
    finally { setBusy(false); }
  };
  const save = async (reset) => {
    if (reset) { const c = await Swal.fire({ icon: 'question', title: 'Bring back the standard text?', text: 'Your changes to this letter are lost.', showCancelButton: true, confirmButtonText: 'Bring it back' }); if (!c.isConfirmed) return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/templates`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ letter_type: type, body, reset: !!reset }) });
      const r = await res.json(); if (!res.ok) throw new Error(r.detail || 'Could not save');
      Swal.fire({ icon: 'success', title: r.message, timer: 1300, showConfirmButton: false });
      if (reset) { setBody(r.body); setSaved(r.body); } else setSaved(body);
      load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    const c = await Swal.fire({ icon: 'warning', title: `Remove "${cur.name}"?`, text: 'Letters already made stay as they are. New ones of this kind cannot be made.', showCancelButton: true, confirmButtonText: 'Remove', confirmButtonColor: '#dc2626' });
    if (!c.isConfirmed) return;
    try {
      const res = await fetch(`${API}/letters/templates?letter_type=${encodeURIComponent(type)}`, { method: 'DELETE', headers: auth() });
      const r = await res.json(); if (!res.ok) throw new Error(r.detail || 'Could not remove');
      navigate('/letters/texts', { replace: true });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not removed', text: e.message }); }
  };

  if (!isNew && ready && !cur) return <div className="ltx-empty">This letter was not found. <button className="btn-o" onClick={() => navigate('/letters/texts')}>Back to the letters</button></div>;
  if (!isNew && !ready) return <div className="ltx-empty">Loading...</div>;

  return (
    <>
      <div className="ltx-head">
        <button type="button" className="btn-o" onClick={back}>&larr; Letters</button>
        <div className="ltx-name">
          {isNew
            ? <input aria-label="Name of the letter" autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Name of the new letter, for example Salary certificate" />
            : <><h2>{cur.name}</h2>{cur.updated_at && <small>Last saved {when(cur.updated_at)}{cur.updated_by ? ` by ${String(cur.updated_by).split('@')[0]}` : ''}</small>}</>}
        </div>
        <div className="ltx-tabs">
          <button type="button" className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>Edit</button>
          <button type="button" className={view === 'preview' ? 'on' : ''} onClick={showPreview}>Preview</button>
        </div>
        <div className="ltx-act">
          {dirty && !isNew && <span className="ltx-dirty">Unsaved changes</span>}
          {!isNew && cur.has_standard && <button className="btn-o" onClick={() => save(true)} disabled={busy} title="Puts back the text the letter came with">Standard text</button>}
          {!isNew && <button className="btn-o ltx-del" onClick={remove} disabled={busy}>Remove</button>}
          {isNew
            ? <button className="btn-premium" onClick={create} disabled={busy}>{busy ? 'Adding...' : 'Add this letter'}</button>
            : <button className="btn-premium" onClick={() => save(false)} disabled={busy || !dirty}>{busy ? 'Saving...' : 'Save'}</button>}
        </div>
      </div>

      <div style={{ display: view === 'edit' ? 'block' : 'none' }}>
        <LetterEditor value={body} onChange={setBody} words={data.placeholders} height={700} />
        <p className="ltx-note">Write the letter once and save it. Each time the letter is made, the words in <mark className="le-word">{'{{ }}'}</mark> are filled in for that employee and the salary table is worked out. <b>Preview</b> shows the real pages.</p>
      </div>
      {view === 'preview' && (
        <div className="ltx-pv">
          {pdf.busy && <div className="ltx-empty">Making the preview...</div>}
          {pdf.err && <div className="ltx-empty">{pdf.err}</div>}
          {pdf.url && !pdf.busy && <iframe title="Letter preview" src={pdf.url} />}
          <p className="ltx-note">This is the letter as it will print, with the letterhead and the page breaks. The words in { } are shown as they are, and the salary table with a sample salary.</p>
        </div>
      )}
    </>
  );
}

const LTX_CSS = `
.ltx-empty { background:#fff; border:1px dashed #d9c5b3; border-radius:12px; padding:30px; text-align:center; color:#94a3b8; }
.ltx-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:14px; }
.ltx-wrap { position:relative; display:flex; } .ltx-wrap .ltx-card { flex:1; }
.ltx-rm { position:absolute; right:12px; bottom:12px; background:none; border:none; color:#b91c1c; font-size:.74rem; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:6px; font-family:inherit; } .ltx-rm:hover { background:#fee2e2; }
.ltx-card { text-align:left; background:#fff; border:1px solid #eadfd5; border-radius:14px; padding:16px; cursor:pointer; font-family:inherit; display:flex; flex-direction:column; gap:6px; transition:box-shadow .15s, border-color .15s, transform .15s; min-height:170px; }
.ltx-card:hover { border-color:var(--brand,#6f4e37); box-shadow:0 8px 22px rgba(111,78,55,.14); transform:translateY(-2px); }
.ltx-card b { font-size:1rem; color:#1e293b; } .ltx-card p { margin:0; font-size:.8rem; color:#64748b; line-height:1.45; flex:1; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; } .ltx-card small { color:#94a3b8; font-size:.72rem; }
.ltx-top { display:flex; justify-content:space-between; align-items:center; } .ltx-ico { width:32px; height:32px; border-radius:9px; background:var(--brand-soft,#f4ede7); color:var(--brand,#6f4e37); display:flex; align-items:center; justify-content:center; }
.ltx-tag { font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; background:#eff6ff; color:#1d4ed8; border-radius:20px; padding:2px 9px; } .ltx-tag.own { background:#f0fdf4; color:#15803d; }
.ltx-new { align-items:center; justify-content:center; border-style:dashed; color:var(--brand,#6f4e37); background:#faf6f2; } .ltx-new span { font-size:2rem; line-height:1; } .ltx-new b { color:var(--brand,#6f4e37); }
.ltx-head { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
.ltx-name { flex:1; min-width:220px; } .ltx-name h2 { margin:0; font-size:1.2rem; } .ltx-name small { color:#94a3b8; font-size:.74rem; }
.ltx-name input { width:100%; border:1px solid #e2d6c9; border-radius:10px; padding:9px 12px; font-size:.95rem; font-family:inherit; box-sizing:border-box; }
.ltx-tabs { display:inline-flex; background:#f1ebe5; border-radius:9px; padding:3px; } .ltx-tabs button { border:none; background:transparent; padding:6px 16px; border-radius:7px; font-size:.82rem; font-weight:600; cursor:pointer; color:#64748b; font-family:inherit; } .ltx-tabs button.on { background:#fff; color:var(--brand,#6f4e37); box-shadow:0 1px 3px rgba(0,0,0,.1); }
.ltx-act { display:flex; gap:8px; align-items:center; flex-wrap:wrap; } .ltx-dirty { font-size:.76rem; color:#b45309; font-weight:600; } .ltx-del { color:#b91c1c !important; }
.ltx-note { font-size:.78rem; color:#64748b; margin:10px 2px 0; }
.ltx-pv iframe { width:100%; height:78vh; border:1px solid #eadfd5; border-radius:12px; background:#fff; }
`;
