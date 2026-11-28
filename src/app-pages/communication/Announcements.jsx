import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { textToHtml, localYmd } from '@/lib/rich-text';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const JH = () => ({ ...auth(), 'Content-Type': 'application/json' });
const EMPTY = { id: null, title: '', body: '', is_pinned: false, starts_on: '', expires_on: '' };

// HR posts a notice here; every employee sees it on the home page until its end date.
export default function Announcements() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const today = localYmd(new Date()); // today on this computer's calendar (not the UTC date)

  const load = useCallback(() => {
    fetch(`${API}/announcements?all=1`, { headers: auth() }).then(r => r.json()).then(d => setRows(d.announcements || [])).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (url, method, body, ok) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: JH(), body: body ? JSON.stringify(body) : undefined });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon: 'success', title: ok, timer: 1200, showConfirmButton: false });
      load();
      return true;
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); return false; }
    finally { setBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    const body = { title: f.title, body: f.body, is_pinned: f.is_pinned, starts_on: f.starts_on || null, expires_on: f.expires_on || null };
    const done = f.id
      ? await call(`${API}/announcements/${f.id}`, 'PUT', body, 'Announcement updated')
      : await call(`${API}/announcements`, 'POST', body, 'Announcement posted');
    if (done) setF(EMPTY);
  };
  const edit = (n) => { setF({ id: n.id, title: n.title, body: n.body || '', is_pinned: !!n.is_pinned, starts_on: n.starts_on || '', expires_on: n.expires_on || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (n) => {
    const x = await Swal.fire({ icon: 'warning', title: `Remove "${n.title}"?`, text: 'Employees will no longer see it.', showCancelButton: true, confirmButtonText: 'Remove', confirmButtonColor: '#dc2626' });
    if (x.isConfirmed) { await call(`${API}/announcements/${n.id}`, 'DELETE', null, 'Removed'); if (f.id === n.id) setF(EMPTY); }
  };
  const state = (n) => (n.starts_on && n.starts_on > today ? ['Scheduled', '#1d4ed8', '#dbeafe'] : n.expires_on && n.expires_on < today ? ['Ended', '#64748b', '#f1f5f9'] : ['Live', '#15803d', '#dcfce7']);

  return (
    <div>
      <style>{`
        .an-box { background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:14px 16px; margin-bottom:14px; }
        .an-box label { display:block; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#64748b; margin-bottom:4px; }
        .an-box input[type=text], .an-box input[type=date], .an-box textarea { width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; font-size:.86rem; font-family:inherit; background:#fff; }
        .an-grid { display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px; margin-bottom:10px; }
        .an-item { background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:12px 16px; margin-bottom:10px; display:flex; gap:14px; align-items:flex-start; }
        .an-item h4 { margin:0 0 3px; font-size:.92rem; } .an-item p { margin:0; color:#64748b; font-size:.84rem; white-space:pre-wrap; }
        .an-meta { font-size:.74rem; color:#94a3b8; margin-top:6px; }
        .an-pill { font-size:.66rem; font-weight:700; padding:2px 8px; border-radius:20px; margin-left:8px; vertical-align:middle; }
        .an-b { height:28px; padding:0 11px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; }
        .an-b:hover:not(:disabled) { border-color:var(--brand-line); color:var(--brand-dark); background:var(--brand-soft); }
        .an-b.del:hover:not(:disabled) { border-color:#fecaca; color:#b91c1c; background:#fef2f2; }
        @media (max-width:700px) { .an-grid { grid-template-columns:1fr; } }
      `}</style>
      <div className="ph">
        <div>
          <h1>Announcements</h1>
          <p>Post a notice for all employees. It shows on their home page between the start and end date you choose.</p>
        </div>
      </div>

      <form onSubmit={save} className="an-box">
        <div className="an-grid">
          <div><label htmlFor="an-title">Title</label><input id="an-title" type="text" maxLength={150} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Office closed on Friday" /></div>
          <div><label htmlFor="an-start">Show from (optional)</label><input id="an-start" type="date" value={f.starts_on} onChange={e => setF({ ...f, starts_on: e.target.value })} /></div>
          <div><label htmlFor="an-end">Show until (optional)</label><input id="an-end" type="date" value={f.expires_on} onChange={e => setF({ ...f, expires_on: e.target.value })} /></div>
        </div>
        <label htmlFor="an-body">Details (optional)</label>
        <textarea id="an-body" rows={4} maxLength={5000} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} placeholder={'Write the details. A web address becomes a link. For a link with your own words write [Open the form](https://example.com)'} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, textTransform: 'none', fontSize: '.84rem', color: '#334155', fontWeight: 500 }}>
            <input type="checkbox" checked={f.is_pinned} onChange={e => setF({ ...f, is_pinned: e.target.checked })} /> Pin to the top
          </label>
          <span style={{ flex: 1 }} />
          {f.id && <button type="button" className="btn-o" onClick={() => setF(EMPTY)}>Cancel edit</button>}
          <button type="submit" className="btn-p" disabled={busy || !f.title.trim()}>{f.id ? 'Save changes' : 'Post announcement'}</button>
        </div>
      </form>

      {loading ? <div style={{ color: '#94a3b8', padding: 20 }}>Loading...</div>
        : rows.length === 0 ? <div style={{ color: '#94a3b8', padding: 20, textAlign: 'center' }}>No announcements yet.</div>
        : rows.map(n => {
          const [label, color, bg] = state(n);
          return (
            <div key={n.id} className="an-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4>{n.title}{n.is_pinned ? <span className="an-pill" style={{ background: 'var(--brand)', color: '#fff' }}>Pinned</span> : null}<span className="an-pill" style={{ background: bg, color }}>{label}</span></h4>
                {n.body && <p dangerouslySetInnerHTML={{ __html: textToHtml(n.body) }} />}
                <div className="an-meta">Posted by {n.created_by || 'HR'} &middot; {localYmd(n.created_at)}{n.starts_on ? ` · from ${n.starts_on}` : ''}{n.expires_on ? ` · until ${n.expires_on}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="an-b" disabled={busy} onClick={() => edit(n)}>Edit</button>
                <button className="an-b del" disabled={busy} onClick={() => remove(n)}>Remove</button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
