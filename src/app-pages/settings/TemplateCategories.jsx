import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const JH = () => ({ ...auth(), 'Content-Type': 'application/json' });

// Master list of email template categories: what a template is for. A category can be linked to one request mail
// (Leave, Work From Home, Missed punch, Late coming); Settings > Request Mails then offers only its templates.
export default function TemplateCategories() {
  const [rows, setRows] = useState([]);
  const [kinds, setKinds] = useState({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/template-categories`, { headers: auth() }).then(r => r.json()).then(d => { setRows(d.categories || []); setKinds(d.kinds || {}); }).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (url, method, body, ok) => {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: JH(), body: body ? JSON.stringify(body) : undefined });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      if (ok) Swal.fire({ icon: 'success', title: ok, timer: 1200, showConfirmButton: false });
      load();
      return true;
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); return false; }
    finally { setBusy(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await call(`${API}/template-categories`, 'POST', { name, request_kind: kind }, 'Category added')) { setName(''); setKind(''); }
  };
  const rename = async (c) => {
    const x = await Swal.fire({ title: 'Rename category', input: 'text', inputValue: c.name, showCancelButton: true, confirmButtonText: 'Save', inputValidator: v => (!v || !v.trim() ? 'Enter a name' : null) });
    if (x.isConfirmed) call(`${API}/template-categories`, 'PUT', { id: c.id, name: x.value }, c.templates ? `Renamed - ${c.templates} template(s) updated` : 'Renamed');
  };
  const remove = async (c) => {
    const x = await Swal.fire({ icon: 'warning', title: `Delete "${c.name}"?`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (x.isConfirmed) call(`${API}/template-categories?id=${c.id}`, 'DELETE', null, 'Deleted');
  };

  const sel = { height: 32, padding: '0 8px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '.8rem', background: '#fff' };

  return (
    <div>
      <style>{`
        .tc-t { width:100%; border-collapse:collapse; }
        .tc-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; }
        .tc-t td { padding:9px 12px; font-size:.84rem; color:#334155; border-bottom:1px solid #f4f6fa; vertical-align:middle; }
        .tc-b { height:28px; padding:0 11px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; }
        .tc-b:hover:not(:disabled) { border-color:#93c5fd; color:#1d4ed8; background:#f1f6ff; }
        .tc-b.del:hover:not(:disabled) { border-color:#fecaca; color:#b91c1c; background:#fef2f2; }
        .tc-b:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
      <div className="ph">
        <div>
          <h1>Email Template Categories</h1>
          <p>What an email template is for. Pick a category when you make a template. Link a category to a request (Leave, Work From Home, ...) and Settings &gt; Request Mails will offer only the templates of that category for it.</p>
        </div>
        <div className="ph-actions"><Link to="/settings/templates" className="btn-o">&larr; Back to Email Templates</Link></div>
      </div>

      <form onSubmit={add} className="filters" style={{ marginBottom: 12 }}>
        <div className="f-search" style={{ minWidth: 220, flex: 1 }}>
          <input type="text" placeholder="New category, e.g. Offer Letter" value={name} onChange={e => setName(e.target.value)} style={{ paddingLeft: 12 }} aria-label="New category" />
        </div>
        <select value={kind} onChange={e => setKind(e.target.value)} style={{ ...sel, height: 38 }} aria-label="Used for">
          <option value="">Not linked to a request mail</option>
          {Object.entries(kinds).map(([k, l]) => <option key={k} value={k}>Used for {l} mails</option>)}
        </select>
        <button type="submit" className="btn-p" disabled={busy || !name.trim()}>+ Add category</button>
      </form>

      <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tc-t">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Category</th><th>Used for request mails</th><th>Templates</th><th style={{ width: 180 }}>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Loading...</td></tr>
                : rows.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>No categories yet.</td></tr>
                : rows.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                    <td>
                      <select style={sel} disabled={busy} value={c.request_kind || ''} onChange={e => call(`${API}/template-categories`, 'PUT', { id: c.id, request_kind: e.target.value })}>
                        <option value="">Not linked</option>
                        {Object.entries(kinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td>{c.templates}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="tc-b" disabled={busy} onClick={() => rename(c)}>Rename</button>
                        <button className="tc-b del" disabled={busy || c.templates > 0} title={c.templates > 0 ? 'Templates use it - move them first' : ''} onClick={() => remove(c)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
