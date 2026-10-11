import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const JH = () => ({ ...auth(), 'Content-Type': 'application/json' });

// Master list of leave types. The apply form, the filters and the HR screens all read this list.
export default function LeaveTypes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/leave-types?manage=1`, { headers: auth() }).then(r => r.json()).then(d => setRows(d.types || [])).catch(() => setRows([])).finally(() => setLoading(false));
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
    if (await call(`${API}/leave-types`, 'POST', { name }, 'Leave type added')) setName('');
  };
  const rename = async (t) => {
    const x = await Swal.fire({ title: 'Rename leave type', input: 'text', inputValue: t.name, showCancelButton: true, confirmButtonText: 'Save', inputValidator: v => (!v || !v.trim() ? 'Enter a name' : null) });
    if (x.isConfirmed) call(`${API}/leave-types`, 'PUT', { id: t.id, name: x.value }, t.requests ? `Renamed - ${t.requests} request(s) updated` : 'Renamed');
  };
  const remove = async (t) => {
    const x = await Swal.fire({ icon: 'warning', title: `Delete "${t.name}"?`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626' });
    if (x.isConfirmed) call(`${API}/leave-types?id=${t.id}`, 'DELETE', null, 'Deleted');
  };

  return (
    <div>
      <style>{`
        .lt-t { width:100%; border-collapse:collapse; }
        .lt-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; }
        .lt-t td { padding:9px 12px; font-size:.84rem; color:#334155; border-bottom:1px solid #f4f6fa; vertical-align:middle; }
        .lt-b { height:28px; padding:0 11px; border-radius:7px; border:1px solid #e2e8f0; background:#fff; font-size:.75rem; font-weight:600; color:#475569; cursor:pointer; }
        .lt-b:hover:not(:disabled) { border-color:#93c5fd; color:#1d4ed8; background:#f1f6ff; }
        .lt-b.del:hover:not(:disabled) { border-color:#fecaca; color:#b91c1c; background:#fef2f2; }
        .lt-b:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
      <div className="ph">
        <div>
          <h1>Leave Types</h1>
          <p>The leave types an employee can apply for (for example Annual, Sick, Casual, Maternity). They appear in the leave form and in the HR leave screens.</p>
        </div>
        <div className="ph-actions"><Link to="/leave/manage" className="btn-o">&larr; Back to Leave Management</Link></div>
      </div>

      <form onSubmit={add} className="filters" style={{ marginBottom: 12 }}>
        <div className="f-search" style={{ minWidth: 220, flex: 1 }}>
          <input type="text" placeholder="New leave type, e.g. Maternity Leave" value={name} onChange={e => setName(e.target.value)} style={{ paddingLeft: 12 }} aria-label="New leave type" />
        </div>
        <button type="submit" className="btn-p" disabled={busy || !name.trim()}>+ Add leave type</button>
      </form>

      <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden' }}>
        <table className="lt-t">
          <thead><tr><th style={{ width: 40 }}>#</th><th>Leave type</th><th>Requests</th><th>Status</th><th style={{ width: 180 }}>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Loading...</td></tr>
              : rows.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>No leave types yet. Add the first one above.</td></tr>
              : rows.map((t, i) => (
                <tr key={t.id}>
                  <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{t.name}</td>
                  <td>{t.requests}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" role="switch" aria-checked={t.is_active} aria-label={`${t.name} active`} disabled={busy}
                        onClick={() => call(`${API}/leave-types`, 'PUT', { id: t.id, is_active: !t.is_active })}
                        style={{ display: 'block', flexShrink: 0, width: 40, height: 22, padding: 0, margin: 0, borderRadius: 20, border: 'none', background: t.is_active ? '#2563eb' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background-color .15s' }}>
                        <span style={{ position: 'absolute', top: 2, left: t.is_active ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .15s' }} />
                      </button>
                      <span style={{ fontSize: '.78rem', lineHeight: 1, color: t.is_active ? '#15803d' : '#94a3b8', fontWeight: 600 }}>{t.is_active ? 'Active' : 'Off'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="lt-b" disabled={busy} onClick={() => rename(t)}>Rename</button>
                      <button className="lt-b del" disabled={busy || t.requests > 0} title={t.requests > 0 ? 'In use - switch it off instead' : ''} onClick={() => remove(t)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
