import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const JH = () => ({ ...auth(), 'Content-Type': 'application/json' });

// Master list of request types (Leave, Work From Home, Missed punch, Late coming, ...). The "Used for request mails" choice on
// Email Template Categories and the lists in Settings > Request Mails come from here.
export default function RequestTypes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/request-types`, { headers: auth() }).then(r => r.json()).then(d => setRows(d.types || [])).catch(() => setRows([])).finally(() => setLoading(false));
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
    if (await call(`${API}/request-types`, 'POST', { name }, 'Request type added')) setName('');
  };
  const rename = async (t) => {
    const x = await Swal.fire({ title: 'Rename request type', input: 'text', inputValue: t.name, showCancelButton: true, confirmButtonText: 'Save', inputValidator: v => (!v || !v.trim() ? 'Enter a name' : null) });
    if (x.isConfirmed) call(`${API}/request-types`, 'PUT', { id: t.id, name: x.value }, 'Renamed');
  };
  const remove = async (t) => {
    const x = await Swal.fire({ icon: 'warning', title: `Delete "${t.name}"?`, text: t.categories ? `${t.categories} template categor${t.categories > 1 ? 'ies are' : 'y is'} linked to it. They will be unlinked, and the mail templates chosen for it in Request Mails will be cleared.` : undefined, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (x.isConfirmed) call(`${API}/request-types?id=${t.id}`, 'DELETE', null, 'Deleted');
  };

  return (
    <div>
      <style>{`
        .rt-t { width:100%; border-collapse:collapse; }
        .rt-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; }
        .rt-t td { padding:9px 12px; font-size:.84rem; color:#334155; border-bottom:1px solid #f4f6fa; vertical-align:middle; }
        .rt-b { height:28px; padding:0 11px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; }
        .rt-b:hover:not(:disabled) { border-color:#93c5fd; color:#1d4ed8; background:#f1f6ff; }
        .rt-b.del:hover:not(:disabled) { border-color:#fecaca; color:#b91c1c; background:#fef2f2; }
        .rt-b:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
      <div className="ph">
        <div>
          <h1>Request Types</h1>
          <p>The kinds of request a request mail can be for (Leave, Work From Home, ...). Link an email template category to one of them (Masters &gt; Template Categories) and choose its mail templates in Settings &gt; Request Mails. Any type can be renamed, switched off or deleted (deleting unlinks its template categories).</p>
        </div>
        <div className="ph-actions"><Link to="/masters/template-categories" className="btn-o">Template Categories &rarr;</Link></div>
      </div>

      <form onSubmit={add} className="filters" style={{ marginBottom: 12 }}>
        <div className="f-search" style={{ minWidth: 220, flex: 1 }}>
          <input type="text" placeholder="New request type, e.g. Expense claim" value={name} onChange={e => setName(e.target.value)} style={{ paddingLeft: 12 }} aria-label="New request type" />
        </div>
        <button type="submit" className="btn-p" disabled={busy || !name.trim()}>+ Add request type</button>
      </form>

      <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="rt-t">
            <thead><tr><th style={{ width: 40 }}>#</th><th>Request type</th><th>Template categories</th><th>Status</th><th style={{ width: 230 }}>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Loading...</td></tr>
                : rows.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>No request types yet.</td></tr>
                : rows.map((t, i) => (
                  <tr key={t.id} style={t.is_active ? undefined : { opacity: .6 }}>
                    <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{t.name}</td>
                    <td>{t.categories}</td>
                    <td>{t.is_active ? <span style={{ color: '#15803d', fontWeight: 600 }}>Active</span> : <span style={{ color: '#94a3b8', fontWeight: 600 }}>Off</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="rt-b" disabled={busy} onClick={() => rename(t)}>Rename</button>
                        <button className="rt-b" disabled={busy} onClick={() => call(`${API}/request-types`, 'PUT', { id: t.id, is_active: !t.is_active })}>{t.is_active ? 'Switch off' : 'Switch on'}</button>
                        <button className="rt-b del" disabled={busy} onClick={() => remove(t)}>Delete</button>
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
