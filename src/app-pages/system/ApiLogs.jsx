import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import Pagination from '../shared/Pagination';
import { appLocale } from '@/lib/app-config-client';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const when = (v) => { try { return new Date(v).toLocaleString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return v; } };

const statusTone = (l) => {
  if (l.source === 'browser') return ['#faf5ff', '#7e22ce'];
  if (l.status >= 500) return ['#fef2f2', '#b91c1c'];
  if (l.status >= 400) return ['#fffbeb', '#b45309'];
  return ['#f0fdf4', '#15803d'];
};
const METHOD_COLOR = { GET: 'var(--brand-dark)', POST: '#15803d', PUT: '#b45309', PATCH: '#b45309', DELETE: '#b91c1c' };
const SOURCE_LABEL = { server: 'Server', proxy: 'Refused', browser: 'Browser' };

function Detail({ l }) {
  const row = (label, v) => (v ? <div style={{ display: 'flex', gap: 10, padding: '3px 0' }}><span style={{ minWidth: 110, color: '#64748b', fontWeight: 600 }}>{label}</span><span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{v}</span></div> : null);
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: '.78rem', color: '#334155' }}>
      {row('Reference', l.ref)}
      {row('Where from', SOURCE_LABEL[l.source] || l.source)}
      {row('URL', l.path + (l.query_string ? '?' + l.query_string : ''))}
      {row('Person', l.user_email ? `${l.user_email} (${l.user_type || '-'})` : '')}
      {row('IP address', l.ip)}
      {row('Browser', l.user_agent)}
      {row('Sent data', l.request_body)}
      {row('Error', l.error_message)}
      {l.error_detail ? <div style={{ marginTop: 6 }}><div style={{ color: '#64748b', fontWeight: 600, marginBottom: 3 }}>Details</div><pre style={{ margin: 0, maxHeight: 220, overflow: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, fontSize: '.72rem' }}>{l.error_detail}</pre></div> : null}
    </div>
  );
}

export default function ApiLogs() {
  const today = ymd(new Date());
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [slowMs, setSlowMs] = useState(0);
  const [summary, setSummary] = useState({ total: 0, errors: 0, slow: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ search: '', outcome: '', method: '', source: '', from: '', to: '' });
  const [settings, setSettings] = useState({ retention_days: '30', log_get_success: 1, entries: 0, oldest: null });
  const [saving, setSaving] = useState(false);
  const ready = useRef(false);

  const load = useCallback((p = 1, o = {}, quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    const q = { ...f, ...o };
    const params = new URLSearchParams({ page: p, per_page: o.perPage || pageSize });
    ['search', 'outcome', 'method', 'source', 'from', 'to'].forEach(k => { if (q[k]) params.set(k, q[k]); });
    fetch(`${API}/api-logs?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setLogs(d.logs || []); setTotal(d.total || 0); setSlowMs(d.slow_ms || 0); setPage(d.page || 1); setSummary(d.last_24h || { total: 0, errors: 0, slow: 0 }); })
      .catch(e => { setLogs([]); setTotal(0); setError(e.message); }).finally(() => setLoading(false));
  }, [f, pageSize]);

  const loadSettings = () => fetch(`${API}/api-logs/settings`, { headers: auth() }).then(r => r.json())
    .then(d => { if (d && d.retention_days !== undefined) setSettings({ ...d, retention_days: String(d.retention_days) }); }).catch(() => {});

  useEffect(() => { load(1); loadSettings(); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [f.search]);
  // new calls show up by themselves (only while the first page is open)
  useEffect(() => {
    const t = setInterval(() => { if (page === 1 && !document.hidden) load(1, {}, true); }, 15000);
    return () => clearInterval(t);
  }, [load, page]);

  const setFilter = (k, v) => { setF(x => ({ ...x, [k]: v })); load(1, { [k]: v }); };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api-logs/settings`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ retention_days: settings.retention_days, log_get_success: settings.log_get_success }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      Swal.fire({ icon: 'success', title: 'Saved', text: d.message, timer: 1800, showConfirmButton: false });
      loadSettings(); load(1);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setSaving(false); }
  };

  const clearNow = async () => {
    const r = await Swal.fire({
      icon: 'warning', title: 'Delete log entries', input: 'select',
      inputOptions: { 7: 'Older than 7 days', 30: 'Older than 30 days', 90: 'Older than 90 days', all: 'Everything' },
      inputPlaceholder: 'What to delete', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626',
      inputValidator: v => (!v ? 'Choose what to delete' : null),
    });
    if (!r.isConfirmed) return;
    try {
      const res = await fetch(`${API}/api-logs?${r.value === 'all' ? 'all=1' : 'older_than_days=' + r.value}`, { method: 'DELETE', headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not delete');
      Swal.fire({ icon: 'success', title: 'Done', text: d.message, timer: 1800, showConfirmButton: false });
      loadSettings(); load(1);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
  };

  const P = [{ l: 'Today', f: today, t: today }, { l: 'Last 7 days', f: ymd(new Date(Date.now() - 6 * 864e5)), t: today }];
  const card = (label, value, color) => (
    <div style={{ flex: '1 1 130px', background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: '10px 14px' }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );

  return (
    <div>
      <style>{`
        .ap-t { width:100%; border-collapse:collapse; }
        .ap-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #eadfd5; text-align:left; white-space:nowrap; }
        .ap-t td { padding:8px 12px; font-size:.8rem; color:#334155; border-bottom:1px solid #f4f6fa; vertical-align:top; }
        .ap-t tr.ap-row { cursor:pointer; }
        .ap-t tr.ap-row:hover td { background:#f8fafc; }
        .ap-chip { border:1px solid #e2e8f0; background:#fff; color:#475569; font-size:.76rem; font-weight:600; padding:5px 11px; border-radius:20px; cursor:pointer; }
        .ap-chip:hover { border-color:var(--brand-line); color:var(--brand-dark); }
        .ap-set { display:flex; flex-wrap:wrap; gap:14px; align-items:flex-end; }
        .ap-set label { display:block; font-size:.72rem; font-weight:700; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:.3px; }
        .ap-set input[type=number], .ap-set select { padding:7px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:.85rem; background:#fff; }
        @media (max-width: 700px) { .ap-hide-sm { display:none; } }
      `}</style>
      <div className="ph">
        <div>
          <h1>API Logs</h1>
          <p>Every call the app makes to the server: who made it, what it was, how it ended and how long it took. Errors keep the real reason here, while the person only sees a plain message with a reference number.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {card('Calls (last 24 h)', summary.total, '#0f172a')}
        {card('Errors (last 24 h)', summary.errors, summary.errors ? '#b91c1c' : '#15803d')}
        {card(`Slow, ${slowMs} ms or more`, summary.slow, summary.slow ? '#b45309' : '#15803d')}
        {card('Entries kept', settings.entries, '#0f172a')}
      </div>

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '.9rem' }}>When the logs are deleted</div>
        <div className="ap-set">
          <div>
            <label>Keep logs for (days)</label>
            <input type="number" min="0" max="3650" value={settings.retention_days} onChange={e => setSettings(s => ({ ...s, retention_days: e.target.value }))} style={{ width: 110 }} />
          </div>
          <div>
            <label>What to keep</label>
            <select value={settings.log_get_success ? '1' : '0'} onChange={e => setSettings(s => ({ ...s, log_get_success: e.target.value === '1' ? 1 : 0 }))}>
              <option value="1">Every call</option>
              <option value="0">Only changes and errors (smaller)</option>
            </select>
          </div>
          <button className="btn-premium" onClick={saveSettings} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="btn-premium" style={{ background: '#ef4444' }} onClick={clearNow}>Delete entries now</button>
        </div>
        <div style={{ fontSize: '.75rem', color: '#64748b', marginTop: 8 }}>
          Entries older than the days above are removed automatically every hour. 0 keeps them for ever.
          {settings.oldest ? <> Oldest entry now: <b>{when(settings.oldest)}</b>.</> : null}
        </div>
      </div>

      <div className="filters">
        <div className="f-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by URL, person, error or reference..." value={f.search} onChange={e => setF(x => ({ ...x, search: e.target.value }))} />
        </div>
        <select value={f.outcome} onChange={e => setFilter('outcome', e.target.value)} aria-label="Result">
          <option value="">All calls</option><option value="error">Errors only</option><option value="ok">Successful</option><option value="slow">Slow ({slowMs} ms or more)</option>
        </select>
        <select value={f.method} onChange={e => setFilter('method', e.target.value)} aria-label="Method">
          <option value="">All methods</option>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={f.source} onChange={e => setFilter('source', e.target.value)} aria-label="Where from">
          <option value="">Everywhere</option><option value="server">Server</option><option value="proxy">Refused before reaching a page</option><option value="browser">Browser</option>
        </select>
        <input type="date" value={f.from} onChange={e => setFilter('from', e.target.value)} aria-label="From" />
        <input type="date" value={f.to} onChange={e => setFilter('to', e.target.value)} aria-label="To" />
        {P.map(p => <button key={p.l} className="ap-chip" onClick={() => { setF(x => ({ ...x, from: p.f, to: p.t })); load(1, { from: p.f, to: p.t }); }}>{p.l}</button>)}
        <button className="btn-reset" onClick={() => { const z = { search: '', outcome: '', method: '', source: '', from: '', to: '' }; setF(z); load(1, z); }}>Reset</button>
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ap-t">
            <thead><tr><th>When</th><th>Method</th><th>URL</th><th>Result</th><th className="ap-hide-sm">Time</th><th className="ap-hide-sm">Person</th><th>Error</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : logs.length === 0 ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No entries for these filters.</td></tr>
                : logs.map(l => {
                  const tone = statusTone(l);
                  return (
                    <React.Fragment key={l.id}>
                      <tr className="ap-row" onClick={() => setOpen(open === l.id ? null : l.id)}>
                        <td style={{ whiteSpace: 'nowrap' }}>{when(l.created_at)}</td>
                        <td style={{ fontWeight: 700, color: METHOD_COLOR[l.method] || '#475569' }}>{l.method || '-'}</td>
                        <td style={{ wordBreak: 'break-all', maxWidth: 360 }}>{l.path}</td>
                        <td><span style={{ background: tone[0], color: tone[1], padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.source === 'browser' ? 'Browser' : l.status}</span></td>
                        <td className="ap-hide-sm" style={{ whiteSpace: 'nowrap', color: l.duration_ms >= (slowMs || Infinity) ? '#b45309' : '#64748b' }}>{l.duration_ms != null ? `${l.duration_ms} ms` : '-'}</td>
                        <td className="ap-hide-sm" style={{ whiteSpace: 'nowrap' }}>{l.user_email || '-'}</td>
                        <td style={{ color: '#b91c1c', maxWidth: 360, wordBreak: 'break-word' }}>{l.error_message ? String(l.error_message).slice(0, 120) : ''}</td>
                      </tr>
                      {open === l.id && <tr><td colSpan="7" style={{ background: '#fff' }}><Detail l={l} /></td></tr>}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={total} pageSize={pageSize} itemLabel="calls" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }}  />
        </div>
      </div>
    </div>
  );
}
