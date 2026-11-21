import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import Pagination from '../shared/Pagination';
import { appLocale } from '@/lib/app-config-client';
import { parseLetter } from '@/lib/letter-markup';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const when = (v) => { try { return new Date(v).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; } };

// the PDF opens in a new tab (the page is asked with the login, so it is read as a file first)
export async function openLetter(id) {
  const tab = window.open('', '_blank');
  try {
    const res = await fetch(`${API}/letters/${id}`, { headers: auth() });
    if (!res.ok) { let m = 'Could not open the letter'; try { m = (await res.json()).detail || m; } catch { /* not json */ } throw new Error(m); }
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { if (tab) tab.close(); Swal.fire({ icon: 'error', title: 'Not opened', text: e.message }); }
}

const input = { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', outline: 'none', background: '#fff', fontFamily: 'inherit', width: '100%' };
const label = { fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 };

// HR: make letters from the templates, see the letters made, and change the text of each letter.
// Each part of the letters is its own page (Letters in the side menu): /letters/make, /made, /texts, /words and /letterhead.
const SECTIONS = {
  make: ['Make a letter', 'Pick an employee and a letter, fill in the details, read the text and make the PDF.'],
  made: ['Letters made', 'Every letter that was made. Open the PDF, email it, edit it or delete it.'],
  texts: ['Letter texts', 'The text of each kind of letter. Change it, or add a new kind of letter.'],
  words: ['Letter words', 'The words that are filled in for each employee when a letter is made. Add your own.'],
  letterhead: ['Letterhead', 'How the top of every letter and of the Full and Final statement looks: the company header, your own letterhead picture, or none.'],
};
export default function Letters({ section = 'make' }) {
  const navigate = useNavigate();
  const [title, about] = SECTIONS[section] || SECTIONS.make;
  return (
    <div>
      <div className="ph">
        <div>
          <h1>{title}</h1>
          <p>{about}</p>
        </div>
      </div>
      {section === 'make' && <Issue onDone={() => navigate('/letters/made')} />}
      {section === 'made' && <Issued isHr />}
      {section === 'texts' && <Templates />}
      {section === 'words' && <Words />}
      {section === 'letterhead' && <Letterhead />}
    </div>
  );
}

function Issue({ onDone }) {
  const [types, setTypes] = useState([]);
  const [people, setPeople] = useState([]);
  const [q, setQ] = useState('');
  const [emp, setEmp] = useState(null);
  const [type, setType] = useState('');
  const [fields, setFields] = useState({ joining_date: '', resignation_date: '', last_working_day: '', effective_date: '' });
  const [text, setText] = useState('');
  const [askVars, setAskVars] = useState([]);
  const [custom, setCustom] = useState({});
  const [missing, setMissing] = useState([]);
  const [busy, setBusy] = useState(false);
  const [mailFor, setMailFor] = useState(null);
  const [refNo, setRefNo] = useState('');
  const [letterDate, setLetterDate] = useState('');

  useEffect(() => { fetch(`${API}/letters`, { headers: auth() }).then(r => r.json()).then(d => { setTypes(d.types || []); setAskVars(d.ask_vars || []); setType(t => (d.types || []).some(x => x.key === t) ? t : ((d.types || [])[0] || {}).key || ''); }).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) { setPeople([]); return; }
      fetch(`${API}/directory?search=${encodeURIComponent(q.trim())}&per_page=8`, { headers: auth() }).then(r => r.json()).then(d => setPeople(d.people || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const clean = () => Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
  const preview = async () => {
    if (!emp) { Swal.fire({ icon: 'warning', title: 'Pick an employee first' }); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/preview`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, letter_type: type, fields: { ...clean(), custom } }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not prepare the letter');
      setText(d.text); setMissing(d.missing || []);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(false); }
  };
  const make = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, letter_type: type, fields: { ...clean(), custom }, text, ref_no: refNo.trim(), letter_date: letterDate }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not make the letter');
      const next = await Swal.fire({ icon: 'success', title: d.ref_no || 'Letter made', text: d.message + ' The employee can see it in their portal.', showDenyButton: true, showCancelButton: true, confirmButtonText: 'Email it to the employee', denyButtonText: 'Open the PDF', cancelButtonText: 'Done' });
      setText(''); setRefNo(''); setLetterDate('');
      if (next.isConfirmed) { setMailFor(d.id); return; }
      if (next.isDenied) openLetter(d.id);
      onDone();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(false); }
  };

  const date = (k, l) => <div><label style={label}>{l}</label><input type="date" style={input} value={fields[k]} onChange={e => setFields(f => ({ ...f, [k]: e.target.value }))} /></div>;
  return (
    <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <div style={{ position: 'relative' }}>
          <label style={label}>Employee</label>
          {emp ? (
            <div style={{ ...input, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span><b>{emp.full_name}</b> <span style={{ color: '#94a3b8' }}>({emp.emp_code})</span></span><button onClick={() => { setEmp(null); setText(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>&#10005;</button></div>
          ) : (
            <>
              <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name..." />
              {people.length > 0 && <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}>
                {people.map(p => <div key={p.id} onClick={() => { setEmp(p); setQ(''); setPeople([]); }} style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}><b>{p.full_name}</b> <span style={{ color: '#94a3b8' }}>({p.emp_code}) {p.designation || ''}</span></div>)}
              </div>}
            </>
          )}
        </div>
        <div>
          <label style={label}>Letter</label>
          <select style={input} value={type} onChange={e => { setType(e.target.value); setText(''); }}>{types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
        </div>
        {date('joining_date', 'Date of joining (if not on the profile)')}
        {date('resignation_date', 'Resignation date')}
        {date('last_working_day', 'Last working day')}
        {date('effective_date', 'Effective date')}
        {askVars.map(v => <div key={v.key}><label style={label}>{v.label}</label><input style={input} value={custom[v.key] || ''} onChange={e => setCustom(c => ({ ...c, [v.key]: e.target.value }))} /></div>)}
      </div>
      <div style={{ marginTop: 14 }}><button className="btn-premium" onClick={preview} disabled={busy}>{text ? 'Prepare the text again' : 'Prepare the letter'}</button></div>
      {mailFor && <LetterEmailModal id={mailFor} onClose={() => { setMailFor(null); onDone(); }} />}

      {text && (
        <div style={{ marginTop: 16 }}>
          {missing.length > 0 && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 10, padding: '8px 12px', fontSize: '.82rem', marginBottom: 10 }}>These details are empty, so the letter has a gap where they belong: <b>{missing.join(', ')}</b>. Fill the dates above and prepare the letter again, or type them into the text below.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 320px))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label} htmlFor="ltr-ref">Reference number (optional)</label>
              <input id="ltr-ref" style={input} maxLength={30} value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Leave empty for a letter without one" />
            </div>
            <div>
              <label style={label} htmlFor="ltr-date">Letter date (optional)</label>
              <input id="ltr-date" type="date" style={input} value={letterDate} onChange={e => setLetterDate(e.target.value)} />
            </div>
          </div>
          <label style={label}>The text of the letter (you can change it)</label>
          <textarea style={{ ...input, minHeight: 320, lineHeight: 1.55, fontFamily: 'inherit' }} value={text} onChange={e => setText(e.target.value)} />
          <div style={{ fontSize: 12, color: '#64748b', margin: '6px 0 12px' }}>A blank line starts a new paragraph. Write **bold**, *italic* or __underline__; start a line with "# " for a heading, "- " for a bullet, or &lt;center&gt; / &lt;right&gt; to align it. The company logo, name, address and the signature are added by themselves.</div>
          <button className="btn-premium" onClick={make} disabled={busy}>{busy ? 'Working...' : 'Make the PDF'}</button>
        </div>
      )}
    </div>
  );
}

// The mail window: who it goes to, the subject and the text (all can be changed), and the PDF that goes with it.
function LetterEmailModal({ id, onClose }) {
  const [m, setM] = useState(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${API}/letters/${id}/email`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not prepare the mail'); return d; })
      .then(d => { setM(d); setSubject(d.subject); setHtml(d.html); setCc(d.cc || ''); setBcc(d.bcc || ''); setTo((d.recipients[0] || {}).key || ''); }).catch(e => setError(e.message));
  }, [id]);
  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/${id}/email`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, html, cc, bcc }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not send');
      await Swal.fire({ icon: 'success', title: 'Sent', text: d.message, timer: 1800, showConfirmButton: false });
      onClose();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not sent', text: e.message }); }
    finally { setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(680px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Email the letter</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}>&#10005;</button>
        </div>
        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>{error}</div>}
        {!m && !error && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}
        {m && (
          <div style={{ display: 'grid', gap: 12 }}>
            {m.emailed_at && <div style={{ background: '#f0fdf4', color: '#15803d', padding: '8px 12px', borderRadius: 10, fontSize: 12 }}>Already emailed to {m.emailed_to} on {when(m.emailed_at)}. Sending again sends one more copy.</div>}
            <div>
              <label style={label}>To</label>
              {m.recipients.length === 0
                ? <div style={{ background: '#fffbeb', color: '#92400e', padding: '8px 12px', borderRadius: 10, fontSize: 13 }}>This employee has no email address on the profile. Add one on the employee's page first.</div>
                : <select style={input} value={to} onChange={e => setTo(e.target.value)}>{m.recipients.map(r => <option key={r.key} value={r.key}>{r.label}: {r.address}</option>)}</select>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div><label style={label}>CC</label><input style={input} value={cc} onChange={e => setCc(e.target.value)} placeholder="Separate addresses with a comma" /></div>
              <div><label style={label}>BCC</label><input style={input} value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Hidden copy" /></div>
            </div>
            <div><label style={label}>Subject</label><input style={input} value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <div><label style={label}>Attached</label><div style={{ fontSize: 13 }}>&#128206; {m.filename}</div></div>
            <div>
              <label style={label}>Message (you can change it)</label>
              <div contentEditable suppressContentEditableWarning style={{ ...input, minHeight: 140, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: m.html }} onBlur={e => setHtml(e.currentTarget.innerHTML)} />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>The standard wording and the always-copied people (CC / BCC) come from the email template named "Letter" (Settings &gt; Email Templates).</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-o" onClick={onClose}>Cancel</button>
              <button className="btn-premium" onClick={send} disabled={busy || !to}>{busy ? 'Sending...' : 'Send email'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// HR changes a letter that was made: the reference number, the date and the text. The PDF is drawn again from these.
function LetterEditModal({ id, onClose, onSaved }) {
  const [d, setD] = useState(null);
  const [ref, setRef] = useState('');
  const [day, setDay] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${API}/letters/${id}?json=1`, { headers: auth() }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.detail || 'Could not open the letter'); return j; })
      .then(j => { setD(j); setRef(j.ref_no || ''); setDay(j.day || ''); setText(j.body || ''); }).catch(e => setError(e.message));
  }, [id]);
  const changed = d && (ref.trim() !== (d.ref_no || '') || day !== d.day || text.trim() !== String(d.body || '').trim());
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/${id}`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ref_no: ref.trim(), day, text }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || 'Could not save');
      await Swal.fire({ icon: 'success', title: j.message, text: d.emailed_at ? 'This letter was already emailed. Email it again to send the changed copy.' : undefined, timer: d.emailed_at ? undefined : 1500, showConfirmButton: !!d.emailed_at });
      onSaved();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(760px, 100%)', maxHeight: '92vh', overflow: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Edit the letter{d ? ` - ${d.title}` : ''}</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}>&#10005;</button>
        </div>
        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>{error}</div>}
        {!d && !error && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}
        {d && (
          <div style={{ display: 'grid', gap: 12 }}>
            {d.emailed_at && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>This letter was already emailed. The copy the employee has stays as it was; after saving, email it again to send the changed one.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div><label style={label} htmlFor="le-ref">Reference number (optional)</label><input id="le-ref" style={input} maxLength={30} value={ref} onChange={e => setRef(e.target.value)} /></div>
              <div><label style={label} htmlFor="le-day">Letter date (optional)</label><input id="le-day" type="date" style={input} value={day} onChange={e => setDay(e.target.value)} /></div>
            </div>
            <div>
              <label style={label} htmlFor="le-text">The text of the letter</label>
              <textarea id="le-text" style={{ ...input, minHeight: 340, lineHeight: 1.55 }} value={text} onChange={e => setText(e.target.value)} />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>A blank line starts a new paragraph. Write **bold**, *italic* or __underline__; start a line with "# " for a heading, "- " for a bullet, or &lt;center&gt; / &lt;right&gt; to align it. The company logo, name, address and the signature are added by themselves.</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-o" onClick={onClose}>Cancel</button>
              <button className="btn-premium" onClick={save} disabled={busy || !changed}>{busy ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// the letters that were made (HR: all of them; an employee: their own)
export function Issued({ isHr }) {
  const [data, setData] = useState({ letters: [], total: 0, types: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [mailFor, setMailFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const ready = useRef(false);

  const removeLetter = async (l) => {
    const c = await Swal.fire({
      icon: 'warning', title: 'Delete this letter?',
      html: `<b>${String(l.title).replace(/</g, '&lt;')}</b>${l.ref_no ? ` (${String(l.ref_no).replace(/</g, '&lt;')})` : ''} of ${String(l.full_name || l.emp_code || 'the employee').replace(/</g, '&lt;')} will be removed for good. The employee will no longer see it in the portal and the PDF cannot be opened again.`,
      showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626', focusCancel: true,
    });
    if (!c.isConfirmed) return;
    try {
      const res = await fetch(`${API}/letters/${l.id}`, { method: 'DELETE', headers: auth() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not delete');
      Swal.fire({ icon: 'success', title: d.message, timer: 1400, showConfirmButton: false });
      // the last letter of a page goes: show the page before it
      load(data.letters.length === 1 && page > 1 ? page - 1 : page);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not deleted', text: e.message }); }
  };

  const load = useCallback((p = 1, o = {}) => {
    setLoading(true); setError('');
    const q = { type, search, perPage: pageSize, ...o };
    const params = new URLSearchParams({ page: p, per_page: q.perPage });
    if (q.type) params.set('type', q.type);
    if (q.search) params.set('search', q.search);
    fetch(`${API}/letters?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setData(d); setPage(d.page || 1); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [type, search, pageSize]);
  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [search]);

  const cell = { padding: '9px 12px' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {isHr && <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by employee or reference..." style={{ ...input, flex: '1 1 220px', maxWidth: 320, width: 'auto' }} />}
        <select value={type} onChange={e => { setType(e.target.value); load(1, { type: e.target.value }); }} style={{ ...input, width: 'auto' }}>
          <option value="">All letters</option>{data.types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}
      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={cell}>#</th><th style={cell}>Reference</th>{isHr && <th style={cell}>Employee</th>}<th style={cell}>Letter</th><th style={cell}>Date</th>{isHr && <th style={cell}>Made by</th>}{isHr && <th style={cell}>Emailed</th>}<th style={cell}></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : data.letters.length === 0 ? <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>{isHr ? 'No letters made yet.' : 'No letters have been issued to you yet.'}</td></tr>
                : data.letters.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...cell, color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                    <td style={{ ...cell, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.ref_no || '-'}</td>
                    {isHr && <td style={{ ...cell, whiteSpace: 'nowrap' }}>{l.full_name || '-'} <span style={{ color: '#94a3b8' }}>({l.emp_code})</span></td>}
                    <td style={cell}>{l.title}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{l.no_date ? <span style={{ color: '#94a3b8' }}>-</span> : when(l.issued_on)}</td>
                    {isHr && <td style={{ ...cell, color: '#64748b' }}>{String(l.issued_by || '').split('@')[0]}</td>}
                    {isHr && <td style={{ ...cell, whiteSpace: 'nowrap', fontSize: 12, color: l.emailed_at ? '#15803d' : '#94a3b8' }}>{l.emailed_at ? <span title={l.emailed_to}>{when(l.emailed_at)}</span> : 'Not yet'}</td>}
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}><button className="btn-premium" onClick={() => openLetter(l.id)}>Open PDF</button>{isHr && <> <button className="btn-premium" style={{ background: '#64748b' }} onClick={() => setMailFor(l.id)}>{l.emailed_at ? 'Email again' : 'Email'}</button> <button className="btn-o" style={{ height: 32 }} onClick={() => setEditFor(l.id)}>Edit</button> <button className="btn-o" style={{ height: 32, color: '#b91c1c' }} onClick={() => removeLetter(l)}>Delete</button></>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {mailFor && <LetterEmailModal id={mailFor} onClose={() => { setMailFor(null); load(page); }} />}
        {editFor && <LetterEditModal id={editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); load(page); }} />}
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={data.total} pageSize={pageSize} itemLabel="letters" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}

// The text of each letter: the letters on the left, the chosen one on the right with its words to click in.
function Templates() {
  const [data, setData] = useState({ templates: [], placeholders: [] });
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState('');   // the text as last saved, to know when there are changes
  const [body, setBody] = useState('');
  const [adding, setAdding] = useState(null); // { name, body } while a new letter is being written
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('write');
  const area = useRef(null);

  const open = (t) => { setKey(t ? t.letter_type : ''); setBody(t ? t.body : ''); setSaved(t ? t.body : ''); };
  const load = (keep) => fetch(`${API}/letters/templates`, { headers: auth() }).then(r => r.json()).then(d => {
    setData(d);
    const list = d.templates || [];
    open(list.find(x => x.letter_type === (keep ?? key)) || list[0]);
  }).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line

  const cur = data.templates.find(x => x.letter_type === key);
  const text = adding ? adding.body : body;
  const setText = (v) => (adding ? setAdding({ ...adding, body: v }) : setBody(v));
  const dirty = !adding && body !== saved;

  // leaving a letter with unsaved changes asks first
  const guard = async () => {
    if (!dirty && !(adding && (adding.name || adding.body))) return true;
    const c = await Swal.fire({ icon: 'question', title: 'Leave without saving?', text: 'The changes you made to this text will be lost.', showCancelButton: true, confirmButtonText: 'Leave' });
    return c.isConfirmed;
  };
  const pick = async (k) => { if (k === key && !adding) return; if (!(await guard())) return; setAdding(null); const t = data.templates.find(x => x.letter_type === k); open(t); };
  const startAdd = async () => { if (adding) return; if (!(await guard())) return; setAdding({ name: '', body: '' }); };

  // Every change goes through the browser's own typing command, so Ctrl+Z undoes it like normal typing.
  const apply = (from, to, repl, selFrom, selTo) => {
    const el = area.current;
    if (!el) { setText(text.slice(0, from) + repl + text.slice(to)); return; }
    el.focus(); el.setSelectionRange(from, to);
    let ok = false;
    try { ok = document.execCommand('insertText', false, repl); } catch { ok = false; }
    const f = selFrom ?? from + repl.length, t = selTo ?? f;
    if (ok) { el.setSelectionRange(f, t); return; } // the typing command has already changed the text
    setText(text.slice(0, from) + repl + text.slice(to));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(f, t); });
  };
  const caret = () => { const el = area.current; return el ? [el.selectionStart, el.selectionEnd] : [text.length, text.length]; };
  // a clicked word goes where the cursor is (replacing any selected text), and the cursor lands after it
  const put = (insertText) => { const [a, b] = caret(); apply(a, b, insertText); };

  // **bold**, *italic*, __underline__ around the selected words (again to take it off); with nothing selected the cursor sits between the marks
  const wrap = (m) => {
    const [a, b] = caret(); const sel = text.slice(a, b);
    const star = m === '*';
    const outside = text.slice(a - m.length, a) === m && text.slice(b, b + m.length) === m && (!star || (text[a - 2] !== '*' && text[b + 1] !== '*'));
    if (outside) return apply(a - m.length, b + m.length, sel, a - m.length, a - m.length + sel.length);
    if (sel.length > 2 * m.length && sel.startsWith(m) && sel.endsWith(m) && (!star || !sel.startsWith('**'))) return apply(a, b, sel.slice(m.length, -m.length), a, b - 2 * m.length);
    if (!sel) return apply(a, b, m + m, a + m.length);
    apply(a, b, m + sel + m, a + m.length, a + m.length + sel.length);
  };

  // the lines the selection touches (start of the first line, end of the last)
  const linesAt = () => {
    const [a, b] = caret();
    const from = text.lastIndexOf('\n', a - 1) + 1;
    const last = b > a && text[b - 1] === '\n' ? b - 1 : b;
    let to = text.indexOf('\n', last); if (to < 0) to = text.length;
    return [from, to];
  };
  const ALIGN_RE = /^<(center|right|left)>/i, STRUCT_RE = /^(# |- |\d{1,3}[.)]\s+)/;
  const split = (ln) => { const am = ALIGN_RE.exec(ln); const align = am ? am[0] : ''; const rest = ln.slice(align.length).replace(/^ /, align ? '' : ' '); const sm = STRUCT_RE.exec(rest); const struct = sm ? sm[0] : ''; return { align, struct, body: rest.slice(struct.length) }; };
  const kindOf = (struct) => (struct === '# ' ? 'heading' : struct === '- ' ? 'bullet' : struct ? 'number' : 'text');
  const editLines = (fn) => {
    const [from, to] = linesAt();
    const out = text.slice(from, to).split('\n').map(fn).join('\n');
    apply(from, to, out, from, from + out.length);
  };
  // heading, bullet or numbered list on every selected line; pressed again on lines that already have it, it goes away
  const structure = (kind) => {
    const [from, to] = linesAt();
    const lines = text.slice(from, to).split('\n');
    const filled = lines.filter(l => l.trim());
    const all = filled.length > 0 && filled.every(l => kindOf(split(l).struct) === kind);
    let n = 1;
    if (kind === 'number' && from > 0) { const prev = split(text.slice(text.lastIndexOf('\n', from - 2) + 1, from - 1)); const pm = /^(\d{1,3})/.exec(prev.struct); if (pm) n = Number(pm[1]) + 1; }
    editLines(l => {
      if (!l.trim()) return l;
      const { align, body } = split(l);
      if (all) return align + body;
      const mark = kind === 'heading' ? '# ' : kind === 'bullet' ? '- ' : `${n++}. `;
      return align + mark + body;
    });
  };
  // left, centre or right: the line starts with <center> or <right> (a heading is centred, anything else left, unless told otherwise)
  const align = (al) => editLines(l => {
    if (!l.trim()) return l;
    const { struct, body } = split(l);
    const base = kindOf(struct) === 'heading' ? 'center' : 'left';
    return (al === base ? '' : `<${al}>`) + struct + body;
  });
  // take the marks off the selected words (or the lines): bold, italic, underline, list and alignment
  const clearFormat = () => {
    const strip = (t) => t.replace(/\*\*|__/g, '').replace(/(?<!\*)\*(?!\*)/g, '');
    editLines(l => strip(split(l).body));
  };
  const onKeys = (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrap('**'); } else if (k === 'i') { e.preventDefault(); wrap('*'); } else if (k === 'u') { e.preventDefault(); wrap('__'); }
  };

  const create = async () => {
    if (!adding.name.trim()) { Swal.fire({ icon: 'warning', title: 'Give the letter a name' }); return; }
    if (adding.body.trim().length < 20) { Swal.fire({ icon: 'warning', title: 'Write the text of the letter', text: 'Add the content of the letter, or click the words on the right to put them in.' }); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/templates`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: adding.name, body: adding.body }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not add');
      setAdding(null); await load(d.letter_type);
      Swal.fire({ icon: 'success', title: 'Letter added', timer: 1400, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not added', text: e.message }); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!cur) return;
    const c = await Swal.fire({ icon: 'warning', title: `Remove "${cur.name}"?`, text: 'Letters already made stay as they are. New ones of this kind cannot be made.', showCancelButton: true, confirmButtonText: 'Remove', confirmButtonColor: '#dc2626' });
    if (!c.isConfirmed) return;
    try {
      const res = await fetch(`${API}/letters/templates?letter_type=${encodeURIComponent(key)}`, { method: 'DELETE', headers: auth() });
      const d = await res.json(); if (!res.ok) throw new Error(d.detail || 'Could not remove');
      setKey(''); load('');
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not removed', text: e.message }); }
  };
  const save = async (reset) => {
    if (reset) { const c = await Swal.fire({ icon: 'question', title: 'Bring back the standard text?', text: 'Your changes to this letter are lost.', showCancelButton: true, confirmButtonText: 'Bring it back' }); if (!c.isConfirmed) return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/templates`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ letter_type: key, body, reset: !!reset }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      Swal.fire({ icon: 'success', title: d.message, timer: 1500, showConfirmButton: false });
      await load(key);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };

  const words = data.placeholders.filter(([k, l]) => !q.trim() || (k + ' ' + l).toLowerCase().includes(q.trim().toLowerCase()));
  const used = (k) => text.includes(`{{${k}}}`);
  return (
    <div className="lt-wrap">
      <style>{LT_CSS}</style>

      <aside className="lt-list">
        <div className="lt-list-h">Letters <span>{data.templates.length}</span></div>
        {data.templates.map(t => (
          <button key={t.letter_type} type="button" className={`lt-item${!adding && key === t.letter_type ? ' on' : ''}`} onClick={() => pick(t.letter_type)}>
            <b>{t.name}</b>
            <small>{t.has_standard ? 'Standard letter' : 'Your own letter'}</small>
          </button>
        ))}
        <button type="button" className={`lt-add${adding ? ' on' : ''}`} onClick={startAdd}>+ Add a letter</button>
      </aside>

      <section className="lt-main">
        <div className="lt-head">
          <div className="lt-title">
            {adding
              ? <><label htmlFor="lt-new-name">New letter</label><input id="lt-new-name" className="lt-name" maxLength={80} autoFocus value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} placeholder="Name, for example Salary certificate" /></>
              : <><h3>{cur ? cur.name : 'No letter'}</h3>{cur && cur.updated_at && <small>Last saved {when(cur.updated_at)}{cur.updated_by ? ` by ${String(cur.updated_by).split('@')[0]}` : ''}</small>}</>}
          </div>
          <div className="lt-actions">
            {adding ? (
              <>
                <button className="btn-o" onClick={() => setAdding(null)} disabled={busy}>Cancel</button>
                <button className="btn-premium" onClick={create} disabled={busy}>{busy ? 'Adding...' : 'Add this letter'}</button>
              </>
            ) : cur && (
              <>
                {dirty && <span className="lt-dirty">Unsaved changes</span>}
                {cur.has_standard && <button className="btn-o" onClick={() => save(true)} disabled={busy} title="Puts back the text the letter came with">Standard text</button>}
                <button className="btn-o lt-del" onClick={remove} disabled={busy}>Remove</button>
                <button className="btn-premium" onClick={() => save(false)} disabled={busy || !dirty}>Save</button>
              </>
            )}
          </div>
        </div>

        <div className="lt-bar" role="toolbar" aria-label="Text formatting">
          <div className="lt-tabs">
            <button type="button" className={view === 'write' ? 'on' : ''} onClick={() => setView('write')}>Write</button>
            <button type="button" className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}>Preview</button>
          </div>
          <span className="lt-sep" />
          <TbBtn label="B" title="Bold (Ctrl+B)" off={view !== 'write'} onClick={() => wrap('**')} style={{ fontWeight: 800 }} />
          <TbBtn label="I" title="Italic (Ctrl+I)" off={view !== 'write'} onClick={() => wrap('*')} style={{ fontStyle: 'italic', fontFamily: 'serif' }} />
          <TbBtn label="U" title="Underline (Ctrl+U)" off={view !== 'write'} onClick={() => wrap('__')} style={{ textDecoration: 'underline' }} />
          <span className="lt-sep" />
          <button type="button" className="lt-tb wide" title="Heading: bold and centred" disabled={view !== 'write'} onMouseDown={e => e.preventDefault()} onClick={() => structure('heading')}>Heading</button>
          <button type="button" className="lt-tb wide" title="Bulleted list" disabled={view !== 'write'} onMouseDown={e => e.preventDefault()} onClick={() => structure('bullet')}>&bull; List</button>
          <button type="button" className="lt-tb wide" title="Numbered list" disabled={view !== 'write'} onMouseDown={e => e.preventDefault()} onClick={() => structure('number')}>1. List</button>
          <span className="lt-sep" />
          <TbBtn title="Align left" off={view !== 'write'} onClick={() => align('left')} label={<AlignIcon kind="left" />} />
          <TbBtn title="Centre" off={view !== 'write'} onClick={() => align('center')} label={<AlignIcon kind="center" />} />
          <TbBtn title="Align right" off={view !== 'write'} onClick={() => align('right')} label={<AlignIcon kind="right" />} />
          <span className="lt-sep" />
          <button type="button" className="lt-tb wide" title="Remove bold, italic, underline, list and alignment from the selected lines" disabled={view !== 'write'} onMouseDown={e => e.preventDefault()} onClick={clearFormat}>Clear</button>
        </div>

        <div className="lt-edit">
          <div className="lt-pane">
            {view === 'write'
              ? <textarea ref={area} className="lt-text" value={text} onChange={e => setText(e.target.value)} onKeyDown={onKeys} disabled={!adding && !cur}
                  placeholder={adding ? 'Write the text of the letter here. Click a word on the right to put it in, for example the employee name.' : ''} />
              : <LetterPreview text={text} />}
            <div className="lt-count">{view === 'write' ? `${text.length.toLocaleString()} characters` : 'The words in { } are filled in for each employee when the letter is made'}</div>
          </div>
          <div className="lt-words">
            <div className="lt-words-h">Words</div>
            <input className="lt-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search words" aria-label="Search words" />
            <p>Click a word to put it where the cursor is. It is filled in for each employee. Add your own on the "Letter words" tab.</p>
            <div className="lt-chips">
              {words.length === 0 && <span className="lt-none">No word matches.</span>}
              {words.map(([k, l]) => <button type="button" key={k} title={l} className={used(k) ? 'used' : ''} onClick={() => put(`{{${k}}}`)}>{k}</button>)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// a toolbar button: pressing it keeps the cursor and the selection in the text
function TbBtn({ label, title, onClick, off, style }) {
  return <button type="button" className="lt-tb" title={title} aria-label={title} disabled={off} onMouseDown={e => e.preventDefault()} onClick={onClick} style={style}>{label}</button>;
}
function AlignIcon({ kind }) {
  const rows = { left: [[3, 21], [3, 15], [3, 19]], center: [[3, 21], [7, 17], [5, 19]], right: [[3, 21], [9, 21], [5, 21]] }[kind];
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      {rows.map(([x1, x2], i) => <line key={i} x1={x1} y1={6 + i * 6} x2={x2} y2={6 + i * 6} />)}
    </svg>
  );
}

// the letter as it will read, with the words that get filled in marked
function LetterPreview({ text }) {
  const paras = parseLetter(text);
  const words = (t) => String(t).split(/(\{\{[^}]+\}\})/).map((p, i) => (/^\{\{[^}]+\}\}$/.test(p) ? <mark key={i} className="lt-ph">{p}</mark> : p));
  if (!paras.length) return <div className="lt-paper" style={{ color: '#94a3b8' }}>Nothing written yet.</div>;
  return (
    <div className="lt-paper">
      {paras.map((blk, i) => (
        <div key={i} className="lt-para">
          {blk.map((ln, j) => (
            <div key={j} className={`lt-ln ${ln.kind}`} style={{ textAlign: ln.align }}>
              {ln.label && <span className="lt-lab">{ln.label}</span>}
              {ln.runs.map((r, k) => <span key={k} style={{ fontWeight: r.bold ? 700 : undefined, fontStyle: r.italic ? 'italic' : undefined, textDecoration: r.underline ? 'underline' : undefined }}>{words(r.text)}</span>)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const LT_CSS = `
.lt-wrap { display:grid; grid-template-columns:220px minmax(0,1fr); gap:14px; align-items:start; }
.lt-list { background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:8px; display:flex; flex-direction:column; gap:3px; position:sticky; top:12px; }
.lt-list-h { display:flex; justify-content:space-between; align-items:center; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; padding:6px 10px 4px; }
.lt-list-h span { background:var(--brand-soft-2,#f4ede7); color:var(--brand-dark); border-radius:20px; padding:0 8px; font-size:.68rem; }
.lt-item { text-align:left; border:1px solid transparent; background:transparent; border-radius:9px; padding:8px 10px; cursor:pointer; font-family:inherit; display:flex; flex-direction:column; gap:1px; }
.lt-item b { font-size:.84rem; color:#334155; font-weight:600; }
.lt-item small { font-size:.7rem; color:#94a3b8; }
.lt-item:hover { background:var(--brand-soft,#f4ede7); }
.lt-item.on { background:var(--brand-soft,#f4ede7); border-color:var(--brand-line,#d9c5b3); }
.lt-item.on b { color:var(--brand-dark); }
.lt-add { margin-top:4px; border:1px dashed #cbd5e1; background:transparent; color:#475569; border-radius:9px; padding:8px 10px; font-size:.8rem; font-weight:600; cursor:pointer; font-family:inherit; }
.lt-add:hover, .lt-add.on { border-color:var(--brand); color:var(--brand-dark); background:var(--brand-soft,#f4ede7); }
.lt-main { background:#fff; border:1px solid #eadfd5; border-radius:12px; min-width:0; }
.lt-head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 16px; border-bottom:1px solid #f1e8df; }
.lt-title { display:flex; flex-direction:column; gap:2px; min-width:0; flex:1 1 240px; }
.lt-title h3 { margin:0; font-size:1.02rem; }
.lt-title small, .lt-title label { font-size:.72rem; color:#94a3b8; }
.lt-title label { font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
.lt-name { border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; font-size:.9rem; font-family:inherit; max-width:380px; width:100%; background:#fff; }
.lt-name:focus, .lt-text:focus, .lt-search:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.lt-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.lt-actions .btn-o, .lt-actions .btn-premium { height:32px; padding:0 14px; font-size:.8rem; }
.lt-actions .btn-premium:disabled { opacity:.45; cursor:default; }
.lt-del { color:#b91c1c !important; }
.lt-del:hover { background:#fef2f2 !important; border-color:#fecaca !important; }
.lt-dirty { font-size:.72rem; font-weight:700; color:#b45309; background:#fef3c7; border-radius:20px; padding:3px 10px; }
.lt-bar { display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:8px 16px; border-bottom:1px solid #f1e8df; background:#fcfaf8; }
.lt-bar button { border:1px solid #e2e8f0; background:#fff; border-radius:7px; height:26px; padding:0 10px; font-size:.74rem; font-weight:600; color:#475569; cursor:pointer; font-family:inherit; }
.lt-bar button:hover { border-color:var(--brand-line); color:var(--brand-dark); background:var(--brand-soft); }
.lt-bar .lt-tb { min-width:28px; padding:0 7px; display:inline-flex; align-items:center; justify-content:center; font-size:.8rem; }
.lt-bar .lt-tb.wide { padding:0 10px; font-size:.74rem; }
.lt-bar .lt-tb:disabled { opacity:.4; cursor:default; }
.lt-bar .lt-sep { width:1px; height:18px; background:#e2e8f0; margin:0 4px; }
.lt-tabs { display:inline-flex; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
.lt-tabs button { border:none !important; border-radius:0 !important; height:26px; background:#fff; }
.lt-tabs button.on { background:var(--brand) !important; color:#fff !important; }
.lt-paper { min-height:440px; border:1px solid #e2e8f0; border-radius:10px; padding:26px 32px; background:#fff; color:#1e293b; font-family:Arial, Helvetica, sans-serif; font-size:.88rem; line-height:1.6; }
.lt-para { margin-bottom:12px; }
.lt-ln.heading { font-size:1.05rem; margin:6px 0; }
.lt-ln.bullet, .lt-ln.number { padding-left:14px; }
.lt-lab { display:inline-block; min-width:22px; }
.lt-ph { background:var(--brand-soft-2, #ebdfd3); color:var(--brand-dark); border-radius:4px; padding:0 3px; font-family:monospace; font-size:.8em; }
.lt-edit { display:grid; grid-template-columns:minmax(0,1fr) 270px; }
.lt-pane { padding:14px 16px; min-width:0; }
.lt-text { width:100%; box-sizing:border-box; min-height:440px; resize:vertical; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; font-size:.9rem; line-height:1.65; font-family:inherit; color:#1e293b; background:#fff; }
.lt-count { text-align:right; font-size:.7rem; color:#94a3b8; margin-top:4px; }
.lt-words { border-left:1px solid #f1e8df; padding:14px 14px; display:flex; flex-direction:column; gap:8px; min-width:0; }
.lt-words-h { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; }
.lt-search { border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; font-size:.82rem; font-family:inherit; background:#fff; width:100%; box-sizing:border-box; }
.lt-words p { margin:0; font-size:.72rem; color:#94a3b8; line-height:1.45; }
.lt-chips { display:flex; flex-wrap:wrap; gap:5px; max-height:430px; overflow:auto; }
.lt-chips button { background:var(--brand-soft); color:var(--brand-dark); border:1px solid var(--brand-line); border-radius:6px; padding:2px 8px; font-family:monospace; font-size:.74rem; cursor:pointer; }
.lt-chips button:hover { background:var(--brand-soft-2,#ebdfd3); }
.lt-chips button.used { background:var(--brand); color:#fff; border-color:var(--brand); }
.lt-none { font-size:.78rem; color:#94a3b8; }
.lt-text { min-height:440px; }
@media (max-width:900px) {
  .lt-wrap { grid-template-columns:1fr; }
  .lt-list { position:static; flex-direction:row; flex-wrap:wrap; }
  .lt-list-h { width:100%; }
  .lt-edit { grid-template-columns:1fr; }
  .lt-words { border-left:none; border-top:1px solid #f1e8df; }
  .lt-text { min-height:320px; }
}
`;

// How the letters get their header: the company header the app draws, HR's own letterhead picture behind every page, or none at all.
const LH_MODES = [
  ['company', 'Company header', 'The logo, company name and address from Settings > Company, with a line under them. Nothing to upload.'],
  ['image', 'My letterhead image', 'Upload your own letterhead design as a picture. It is placed behind every page and the text is written inside it.'],
  ['none', 'No header (printed paper)', 'Leaves the top of the page empty so the letter can be printed on paper that already has the letterhead.'],
];

function Letterhead() {
  const [saved, setSaved] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [ratio, setRatio] = useState(0); // width / height of the chosen picture
  const picture = f ? f.image : '';
  useEffect(() => {
    if (!picture) { setRatio(0); return; }
    const im = new Image();
    im.onload = () => setRatio(im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0);
    im.src = picture;
  }, [picture]);
  const load = () => fetch(`${API}/letters/letterhead`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
    .then(d => { setSaved(d); setF({ mode: d.mode, image: d.image || '', placement: d.placement || 'auto', top_mm: d.top_mm, bottom_mm: d.bottom_mm }); }).catch(e => Swal.fire({ icon: 'error', title: 'Error', text: e.message }));
  useEffect(() => { load(); }, []);
  if (!f) return <div style={{ padding: 20, color: '#94a3b8' }}>Loading...</div>;

  const dirty = f.mode !== saved.mode || (f.image || '') !== (saved.image || '') || f.placement !== (saved.placement || 'auto') || Number(f.top_mm) !== saved.top_mm || Number(f.bottom_mm) !== saved.bottom_mm;
  const spaced = f.mode !== 'company';
  const pickFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { Swal.fire({ icon: 'warning', title: 'PNG or JPG only', text: 'Save the letterhead as a PNG or JPG picture and choose it again.' }); return; }
    if (file.size > 3 * 1024 * 1024) { Swal.fire({ icon: 'warning', title: 'The picture is too big', text: 'Keep it under 3 MB. A4 size (2480 x 3508 pixels) is enough.' }); return; }
    const rd = new FileReader();
    rd.onload = () => setF(x => ({ ...x, image: rd.result }));
    rd.readAsDataURL(file);
  };
  const body = () => ({ mode: f.mode, placement: f.placement, top_mm: Number(f.top_mm), bottom_mm: Number(f.bottom_mm), image: f.image || '' });
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/letterhead`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body()) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      Swal.fire({ icon: 'success', title: d.message, timer: 1500, showConfirmButton: false });
      await load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };
  // the sample is drawn with what is on the screen, so it can be looked at before saving
  const preview = async () => {
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/letterhead/preview`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body()) });
      if (!res.ok) { let m = 'Could not make the preview'; try { m = (await res.json()).detail || m; } catch { /* not json */ } throw new Error(m); }
      const url = URL.createObjectURL(await res.blob());
      if (tab) tab.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { if (tab) tab.close(); Swal.fire({ icon: 'error', title: 'No preview', text: e.message }); }
    finally { setBusy(false); }
  };

  // the same rule as the PDF: a picture of A4 shape fills the page, a wide strip goes on top; a strip also moves the text past itself
  const hasPic = f.mode === 'image' && !!f.image && ratio > 0;
  const where = !hasPic ? 'none' : f.placement !== 'auto' ? f.placement : (ratio >= 0.55 && ratio <= 0.9 ? 'full' : 'top');
  const stripMm = hasPic && (where === 'top' || where === 'bottom') ? 210 / ratio : 0;
  const topMm = Math.max(Number(f.top_mm) || 0, hasPic && where === 'top' ? stripMm + 5 : 0);
  const botMm = Math.max(Number(f.bottom_mm) || 0, hasPic && where === 'bottom' ? stripMm + 4 : 0);
  const topPct = Math.min(100, topMm / 297 * 100), botPct = Math.min(100, botMm / 297 * 100);
  const imgStyle = where === 'top' ? { top: 0, left: 0, width: '100%' } : where === 'bottom' ? { bottom: 0, left: 0, width: '100%' } : { inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
  return (
    <div className="lh-wrap">
      <style>{LH_CSS}</style>
      <div className="lh-main">
        <h3>Header of the letters</h3>
        <p className="lh-sub">Choose how every letter you make looks at the top. It applies to the PDF you open, the PDF you email, and the Full and Final statement.</p>
        <div className="lh-modes" role="radiogroup" aria-label="Header of the letters">
          {LH_MODES.map(([k, t, d]) => (
            <button key={k} type="button" role="radio" aria-checked={f.mode === k} className={`lh-mode${f.mode === k ? ' on' : ''}`} onClick={() => setF({ ...f, mode: k })}>
              <span className="lh-dot" /><span><b>{t}</b><small>{d}</small></span>
            </button>
          ))}
        </div>

        {f.mode === 'image' && (
          <div className="lh-block">
            <label className="lh-label">Letterhead picture</label>
            <div className="lh-row">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={pickFile} style={{ display: 'none' }} />
              <button type="button" className="btn-o" onClick={() => fileRef.current && fileRef.current.click()}>{f.image ? 'Choose another picture' : 'Choose the picture'}</button>
              {f.image && <button type="button" className="btn-o lh-rm" onClick={() => setF({ ...f, image: '' })}>Remove</button>}
              <span className="lh-hint">PNG or JPG, under 3 MB. It can be a whole A4 page (2480 x 3508 pixels) or a strip across the top or the bottom. The picture is never stretched.</span>
            </div>
            {f.image && (
              <div style={{ marginTop: 12 }}>
                <label className="lh-small" htmlFor="lh-place">Where the picture goes</label>
                <select id="lh-place" className="lh-sel" value={f.placement} onChange={e => setF({ ...f, placement: e.target.value })}>
                  <option value="auto">Automatic{ratio ? ` (${where === 'full' ? 'whole page' : 'a strip at the top'})` : ''}</option>
                  <option value="top">A strip at the top of every page</option>
                  <option value="bottom">A strip at the bottom of every page</option>
                  <option value="full">The whole page</option>
                </select>
              </div>
            )}
          </div>
        )}

        {spaced && (
          <div className="lh-block">
            <label className="lh-label">Space for the text</label>
            <div className="lh-row">
              <div><label className="lh-small" htmlFor="lh-top">Keep empty at the top (mm)</label><input id="lh-top" type="number" min="0" max="120" className="lh-num" value={f.top_mm} onChange={e => setF({ ...f, top_mm: e.target.value })} /></div>
              <div><label className="lh-small" htmlFor="lh-bot">Keep empty at the bottom (mm)</label><input id="lh-bot" type="number" min="0" max="80" className="lh-num" value={f.bottom_mm} onChange={e => setF({ ...f, bottom_mm: e.target.value })} /></div>
              <span className="lh-hint">The text starts below the top space and stops above the bottom space. A strip pushes the text past itself by itself, so these only need to be set for extra room.</span>
            </div>
          </div>
        )}
        {f.mode === 'company' && <p className="lh-note">To change the logo, name or address in this header, go to Settings &gt; Company.</p>}

        <div className="lh-actions">
          <button className="btn-premium" onClick={save} disabled={busy || !dirty}>{busy ? 'Working...' : 'Save'}</button>
          <button className="btn-o" onClick={preview} disabled={busy || (f.mode === 'image' && !f.image)}>Preview a sample letter</button>
          {dirty && <span className="lh-dirty">Unsaved changes</span>}
          {saved.updated_at && !dirty && <span className="lh-hint">Last saved {when(saved.updated_at)}{saved.updated_by ? ` by ${String(saved.updated_by).split('@')[0]}` : ''}</span>}
        </div>
      </div>

      <div className="lh-side">
        <div className="lh-page" aria-label="Page preview">
          {hasPic && <img src={f.image} alt="Letterhead" style={imgStyle} />}
          {f.mode === 'company' && <div className="lh-co"><i /><b>Company name</b><span>logo, name and address</span></div>}
          {spaced && <div className="lh-zone top" style={{ height: topPct + '%' }}><span>{f.mode === 'none' ? 'left empty' : 'letterhead area'}</span></div>}
          <div className="lh-lines" style={{ top: (f.mode === 'company' ? 17 : topPct) + '%', bottom: (spaced ? botPct : 8) + '%' }}>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <u key={i} style={{ width: (i % 4 === 3 ? 60 : 100) + '%' }} />)}</div>
          {spaced && <div className="lh-zone bottom" style={{ height: botPct + '%' }} />}
        </div>
        <small className="lh-hint" style={{ textAlign: 'center' }}>Where the text will be written</small>
      </div>
    </div>
  );
}

const LH_CSS = `
.lh-wrap { display:grid; grid-template-columns:minmax(0,1fr) 250px; gap:16px; align-items:start; background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:18px; }
.lh-main h3 { margin:0 0 2px; font-size:1.02rem; } .lh-sub { margin:0 0 14px; font-size:.82rem; color:#64748b; }
.lh-modes { display:grid; gap:8px; }
.lh-mode { display:flex; gap:12px; align-items:flex-start; text-align:left; border:1px solid #e2e8f0; background:#fff; border-radius:11px; padding:11px 14px; cursor:pointer; font-family:inherit; }
.lh-mode b { display:block; font-size:.88rem; color:#1e293b; } .lh-mode small { display:block; font-size:.76rem; color:#64748b; margin-top:2px; line-height:1.4; }
.lh-mode:hover { border-color:var(--brand-line); background:var(--brand-soft); }
.lh-mode.on { border-color:var(--brand); background:var(--brand-soft); box-shadow:0 0 0 3px rgba(111,78,55,.1); }
.lh-dot { width:16px; height:16px; border-radius:50%; border:2px solid #cbd5e1; flex-shrink:0; margin-top:2px; box-sizing:border-box; }
.lh-mode.on .lh-dot { border-color:var(--brand); background:radial-gradient(var(--brand) 45%, transparent 50%); }
.lh-block { margin-top:16px; }
.lh-label { display:block; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#64748b; margin-bottom:6px; }
.lh-small { display:block; font-size:.74rem; color:#64748b; margin-bottom:3px; }
.lh-row { display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; }
.lh-num { width:130px; border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; font-size:.88rem; font-family:inherit; background:#fff; }
.lh-num:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.lh-hint { font-size:.74rem; color:#94a3b8; line-height:1.45; max-width:420px; }
.lh-note { margin:14px 0 0; font-size:.8rem; color:#64748b; }
.lh-rm { color:#b91c1c !important; }
.lh-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:18px; padding-top:14px; border-top:1px solid #f1e8df; }
.lh-actions .btn-premium:disabled { opacity:.45; cursor:default; }
.lh-dirty { font-size:.72rem; font-weight:700; color:#b45309; background:#fef3c7; border-radius:20px; padding:3px 10px; }
.lh-side { display:flex; flex-direction:column; gap:6px; align-items:center; }
.lh-page { position:relative; width:210px; aspect-ratio:210/297; background:#fff; border:1px solid #d8cdc2; border-radius:4px; box-shadow:0 8px 24px -12px rgba(78,54,38,.4); overflow:hidden; }
.lh-page img { position:absolute; display:block; }
.lh-sel { border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; font-size:.86rem; font-family:inherit; background:#fff; min-width:260px; max-width:100%; }
.lh-sel:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.lh-zone { position:absolute; left:0; right:0; background:repeating-linear-gradient(135deg, rgba(111,78,55,.12) 0 6px, transparent 6px 12px); display:flex; align-items:flex-end; justify-content:center; }
.lh-zone.top { top:0; border-bottom:1px dashed var(--brand); } .lh-zone.bottom { bottom:0; border-top:1px dashed var(--brand); }
.lh-zone span { font-size:.6rem; color:var(--brand-dark); background:rgba(255,255,255,.85); padding:0 6px; border-radius:4px 4px 0 0; }
.lh-co { position:absolute; left:8%; right:8%; top:5%; display:flex; flex-direction:column; align-items:flex-end; border-bottom:2px solid #2563eb; padding-bottom:5px; height:9%; }
.lh-co i { position:absolute; left:0; top:0; width:26%; height:60%; background:#e2e8f0; border-radius:3px; } .lh-co b { font-size:.62rem; color:#0f172a; } .lh-co span { font-size:.5rem; color:#94a3b8; }
.lh-lines { position:absolute; left:11%; right:11%; padding-top:6%; display:flex; flex-direction:column; gap:8px; overflow:hidden; }
.lh-lines u { display:block; height:4px; background:#cbd5e1; border-radius:2px; text-decoration:none; }
@media (max-width:820px) { .lh-wrap { grid-template-columns:1fr; } }
`;

// The words of the letters. Every word can be added, changed and removed. A word is filled from a piece of data (the employee's profile,
// the company settings, the salary...), from a fixed text, or typed in each time a letter is made.
function Words() {
  const [data, setData] = useState({ words: [], sources: [] });
  const [f, setF] = useState({ label: '', key: '', kind: 'field', value: '' });
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const load = () => fetch(`${API}/letters/variables`, { headers: auth() }).then(r => r.json()).then(d => { if (d.words) setData(d); }).catch(() => {});
  useEffect(() => { load(); }, []);
  const send = async (method, body, qs = '') => {
    const res = await fetch(`${API}/letters/variables${qs}`, { method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || 'Failed');
    return d;
  };
  const srcName = (id) => (data.sources.find(x => x[0] === id) || [id, id])[1];
  const how = (v) => v.kind === 'ask' ? 'Typed each time a letter is made' : v.kind === 'field' ? 'From: ' + srcName(v.value) : v.value;
  const add = async () => {
    setBusy(true);
    try { await send('POST', f); setF({ label: '', key: '', kind: f.kind, value: '' }); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not added', text: e.message }); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try { await send('PUT', edit); setEdit(null); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };
  const remove = async (v) => {
    const c = await Swal.fire({ icon: 'warning', title: `Remove {{${v.key}}}?`, text: 'Letter texts that still use it will show a gap where it was.', showCancelButton: true, confirmButtonText: 'Remove', confirmButtonColor: '#dc2626' });
    if (!c.isConfirmed) return;
    try {
      const d = await send('DELETE', null, `?key=${encodeURIComponent(v.key)}`);
      if (d.still_used_in && d.still_used_in.length) Swal.fire({ icon: 'info', title: 'Removed', text: 'Still written in: ' + d.still_used_in.join(', ') + '. Take it out of those texts.' });
      load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not removed', text: e.message }); }
  };
  const restore = async () => {
    try { const d = await send('POST', { action: 'restore_standard' }); Swal.fire({ icon: 'success', title: d.message, timer: 1600, showConfirmButton: false }); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Failed', text: e.message }); }
  };
  const th = { padding: '8px 10px', textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 600 };
  const td = { padding: '8px 10px', fontSize: 13, borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
  const valueInput = (o, set) => o.kind === 'field'
    ? <select style={input} value={o.value} onChange={e => set({ ...o, value: e.target.value })}><option value="">Pick the data...</option>{data.sources.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
    : o.kind === 'text' ? <input style={input} value={o.value} onChange={e => set({ ...o, value: e.target.value })} placeholder="For example +91 98765 43210" /> : <span style={{ color: '#94a3b8', fontSize: 13 }}>typed when the letter is made</span>;
  const kindSelect = (o, set) => <select style={input} value={o.kind} onChange={e => set({ ...o, kind: e.target.value, value: '' })}><option value="field">From employee / company data</option><option value="text">A fixed text</option><option value="ask">Typed each time</option></select>;
  const shown = data.words.filter(v => !q.trim() || (v.key + ' ' + v.label).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Add a word</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>A word is written in a letter text as <code>{'{{word}}'}</code> and replaced when the letter is made. It can come from <b>data</b> (the employee's profile, the company, the salary), be a <b>fixed text</b> (an HR phone number, the notice period), or be <b>typed each time</b> a letter is made (a bonus amount, a reason).</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div><label style={label}>Name (what HR sees)</label><input style={input} value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder="For example HR phone" /></div>
          <div><label style={label}>Word (optional)</label><input style={input} value={f.key} onChange={e => setF({ ...f, key: e.target.value })} placeholder="made from the name, e.g. hr_phone" /></div>
          <div><label style={label}>Filled in</label>{kindSelect(f, setF)}</div>
          {f.kind !== 'ask' && <div><label style={label}>{f.kind === 'field' ? 'Data' : 'The text'}</label>{valueInput(f, setF)}</div>}
        </div>
        <div style={{ marginTop: 12 }}><button className="btn-premium" onClick={add} disabled={busy}>Add the word</button></div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', marginRight: 'auto' }}>Words ({data.words.length})</h3>
          <input style={{ ...input, width: 200 }} placeholder="Search words" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn-o" style={{ height: 34 }} onClick={restore} title="Puts back any of the standard words that were removed">Restore standard words</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>#</th><th style={th}>Word</th><th style={th}>Name</th><th style={th}>Filled in</th><th /></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>No words.</td></tr>}
              {shown.map((v, i) => edit && edit.key === v.key ? (
                <tr key={v.key}>
                  <td style={{ ...td, color: '#94a3b8' }}>{i + 1}</td>
                  <td style={td}><code>{`{{${v.key}}}`}</code></td>
                  <td style={td}><input style={input} value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} /></td>
                  <td style={td}><div style={{ display: 'grid', gap: 6 }}>{kindSelect(edit, setEdit)}{valueInput(edit, setEdit)}</div></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}><button className="btn-premium" style={{ padding: '5px 12px' }} onClick={save} disabled={busy}>Save</button> <button className="btn-o" style={{ height: 30 }} onClick={() => setEdit(null)}>Cancel</button></td>
                </tr>
              ) : (
                <tr key={v.key}>
                  <td style={{ ...td, color: '#94a3b8' }}>{i + 1}</td>
                  <td style={td}><code style={{ color: 'var(--brand-dark)' }}>{`{{${v.key}}}`}</code></td>
                  <td style={td}>{v.label}</td>
                  <td style={{ ...td, color: v.kind === 'text' ? '#334155' : '#64748b' }}>{how(v)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn-o" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setEdit({ key: v.key, label: v.label, kind: v.kind, value: v.value })}>Edit</button>{' '}
                    <button onClick={() => remove(v)} style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 6, height: 28, padding: '0 10px', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#94a3b8' }}>A word is not locked to its name: "Edit" can point it at other data, give it a fixed text, or make it typed each time. A word's own name (the part in braces) cannot be changed; add a new word and remove the old one for that.</p>
      </div>
    </div>
  );
}
