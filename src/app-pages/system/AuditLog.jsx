import React, { useState, useEffect, useCallback, useRef } from 'react';
import Pagination from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nice = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const when = (v) => { try { return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return v; } };

// readable one-line summary of the stored details
function summarize(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d;
  if (d.changes) return Object.entries(d.changes).map(([k, v]) => (v && typeof v === 'object' && 'from' in v ? `${k}: ${v.from ?? '-'} → ${v.to ?? '-'}` : `${k}: ${v}`)).join(', ');
  if (d.from && d.to && typeof d.from === 'object') return `${d.date ? d.date + ': ' : ''}${Object.entries(d.from).map(([k, v]) => `${k} ${v ?? '-'}`).join(', ')} → ${Object.entries(d.to).map(([k, v]) => `${k} ${v ?? '-'}`).join(', ')}`;
  return Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
}

const TONE = (a) => /deleted|removed|rejected|failed/.test(a) ? ['#fef2f2', '#b91c1c'] : /approved|verified|created|added|assigned|invited/.test(a) ? ['#f0fdf4', '#15803d'] : ['#eff6ff', '#1d4ed8'];

export default function AuditLog() {
  const P = [{ l: 'Today', f: ymd(new Date()), t: ymd(new Date()) }, { l: 'Last 7 days', f: ymd(new Date(Date.now() - 6 * 864e5)), t: ymd(new Date()) }, { l: 'Last 30 days', f: ymd(new Date(Date.now() - 29 * 864e5)), t: ymd(new Date()) }];
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState([]);
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [f, setF] = useState({ search: '', action: '', entity: '', from: '', to: '' });
  const ready = useRef(false);

  const load = useCallback((p = 1, o = {}) => {
    setLoading(true); setError('');
    const q = { ...f, ...o };
    const params = new URLSearchParams({ page: p, per_page: o.perPage || pageSize });
    ['search', 'action', 'entity', 'from', 'to'].forEach(k => { if (q[k]) params.set(k, q[k]); });
    fetch(`${API}/audit-log?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setLogs(d.logs || []); setTotal(d.total || 0); setActions(d.actions || []); setEntities(d.entities || []); setPage(d.page || 1); })
      .catch(e => { setLogs([]); setTotal(0); setError(e.message); }).finally(() => setLoading(false));
  }, [f, pageSize]);

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [f.search]);

  const setFilter = (k, v) => { setF(x => ({ ...x, [k]: v })); load(1, { [k]: v }); };

  return (
    <div>
      <style>{`
        .al-t { width:100%; border-collapse:collapse; }
        .al-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; white-space:nowrap; }
        .al-t td { padding:8px 12px; font-size:.8rem; color:#334155; border-bottom:1px solid #f4f6fa; vertical-align:top; }
        .al-chip { border:1px solid #e2e8f0; background:#fff; color:#475569; font-size:.76rem; font-weight:600; padding:5px 11px; border-radius:20px; cursor:pointer; }
        .al-chip:hover { border-color:#93c5fd; color:#1d4ed8; }
      `}</style>
      <div className="ph">
        <div>
          <h1>Audit Log</h1>
          <p>A record of who changed what, and when - salary, attendance, employee status, payslips, settings and more.</p>
        </div>
      </div>

      <div className="filters">
        <div className="f-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by person, employee or detail..." value={f.search} onChange={e => setF(x => ({ ...x, search: e.target.value }))} />
        </div>
        <select value={f.action} onChange={e => setFilter('action', e.target.value)} aria-label="Action"><option value="">All actions</option>{actions.map(a => <option key={a} value={a}>{nice(a)}</option>)}</select>
        <select value={f.entity} onChange={e => setFilter('entity', e.target.value)} aria-label="Area"><option value="">All areas</option>{entities.map(a => <option key={a} value={a}>{nice(a)}</option>)}</select>
        <input type="date" value={f.from} onChange={e => setFilter('from', e.target.value)} aria-label="From" />
        <input type="date" value={f.to} onChange={e => setFilter('to', e.target.value)} aria-label="To" />
        {P.map(p => <button key={p.l} className="al-chip" onClick={() => { setF(x => ({ ...x, from: p.f, to: p.t })); load(1, { from: p.f, to: p.t }); }}>{p.l}</button>)}
        <button className="btn-reset" onClick={() => { const z = { search: '', action: '', entity: '', from: '', to: '' }; setF(z); load(1, z); }}>Reset</button>
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="al-t">
            <thead><tr><th style={{ width: 40 }}>#</th><th>When</th><th>Who</th><th>Action</th><th>On</th><th>Details</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : logs.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No entries for these filters.</td></tr>
                : logs.map((l, i) => {
                  const tone = TONE(l.action);
                  return (
                    <tr key={l.id}>
                      <td style={{ color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{when(l.created_on)}</td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{l.performed_by_email || 'System'}</td>
                      <td><span style={{ background: tone[0], color: tone[1], padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{nice(l.action)}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{nice(l.entity_type)}{l.entity_name ? <> · <b>{l.entity_name}</b> <span style={{ color: '#94a3b8' }}>({l.entity_code})</span></> : l.entity_id ? <span style={{ color: '#94a3b8' }}> · {String(l.entity_id).slice(0, 18)}</span> : null}</td>
                      <td style={{ color: '#475569', maxWidth: 520, wordBreak: 'break-word' }}>{summarize(l.details) || '-'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={total} pageSize={pageSize} itemLabel="entries" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} pageSizeOptions={[10, 25, 50, 100]} />
        </div>
      </div>
    </div>
  );
}
