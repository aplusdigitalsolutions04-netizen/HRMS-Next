import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import Pagination from '../shared/Pagination';
import { appLocale } from '@/lib/app-config-client';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token'), 'Content-Type': 'application/json' });
const when = (v) => { if (!v) return '-'; try { return new Date(v).toLocaleString(appLocale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return v; } };

export default function LoginActivity() {
  const [scope, setScope] = useState('mine');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ sessions: [], history: [], total: 0, current_sid: null, is_admin: false, failed_24h: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback((p = page, o = {}) => {
    setLoading(true); setError('');
    const q = { scope, status, search, perPage: pageSize, ...o };
    const params = new URLSearchParams({ scope: q.scope, page: p, per_page: q.perPage });
    if (q.status) params.set('status', q.status);
    if (q.search) params.set('search', q.search);
    fetch(`${API}/login-activity?${params}`, { headers: auth() })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => setData(d)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [scope, status, search, pageSize, page]);

  useEffect(() => { load(1); /* eslint-disable-next-line */ }, [scope, status]);

  const post = async (body, okText) => {
    const r = await fetch(`${API}/login-activity`, { method: 'POST', headers: auth(), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { Swal.fire({ icon: 'error', title: d.detail || 'Failed' }); return; }
    Swal.fire({ icon: 'success', title: d.message || okText, timer: 1400, showConfirmButton: false });
    load(page);
  };
  const endOne = async (s) => {
    const x = await Swal.fire({ icon: 'warning', title: `End this session?`, text: `${s.email} on ${s.device} will be signed out.`, showCancelButton: true, confirmButtonText: 'End session', confirmButtonColor: '#dc2626' });
    if (x.isConfirmed) post({ action: 'revoke', id: s.id });
  };
  const endOthers = async () => {
    const x = await Swal.fire({ icon: 'warning', title: 'Sign out everywhere else?', text: 'Every other open session of yours will be ended. This one stays.', showCancelButton: true, confirmButtonText: 'Sign out others', confirmButtonColor: '#dc2626' });
    if (x.isConfirmed) post({ action: 'revoke_others' });
  };

  const th = { padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' };
  const td = { padding: '9px 12px', fontSize: 13, color: '#334155' };
  const pill = (bg, color, text) => <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{text}</span>;
  const mine = scope === 'mine';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="ph">
        <div><h1>Login Activity</h1><p>Who signed in, from where, and which sessions are open. End a session to sign that device out at once.</p></div>
        <div className="ph-actions">
          {data.is_admin && (
            <select className="settings-input" style={{ height: 34, minWidth: 150 }} value={scope} onChange={e => { setScope(e.target.value); setPage(1); }} aria-label="Whose logins">
              <option value="mine">My logins</option><option value="all">Everyone</option>
            </select>
          )}
          {mine && <button className="btn-o" onClick={endOthers}>Sign out other devices</button>}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {data.failed_24h > 0 && <div style={{ background: '#fffbeb', color: '#b45309', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 13 }}>{data.failed_24h} failed sign-in attempt{data.failed_24h > 1 ? 's' : ''} in the last 24 hours{mine ? ' on your account' : ''}.</div>}

      <div className="premium-table-wrapper" style={{ marginBottom: 16 }}>
        <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 14 }}>Open sessions ({data.sessions.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid #e2e8f0' }}>{[!mine && 'Person', 'Device', 'IP address', 'Signed in', 'Last active', 'Expires', ''].filter(h => h !== false).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.sessions.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 20 }}>{loading ? 'Loading…' : 'No open sessions'}</td></tr>}
              {data.sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {!mine && <td style={td}>{s.email}<div style={{ fontSize: 11, color: '#94a3b8' }}>{s.user_type === 'admin' ? 'HR / Admin' : 'Employee'}</div></td>}
                  <td style={td}>{s.device} {s.sid && s.sid === data.current_sid && pill('#ecfdf5', '#15803d', 'This device')}</td>
                  <td style={td}>{s.ip || '-'}</td>
                  <td style={td}>{when(s.created_at)}</td>
                  <td style={td}>{when(s.last_seen || s.created_at)}</td>
                  <td style={td}>{when(s.expires_at)}</td>
                  <td style={td}>{!(s.sid && s.sid === data.current_sid) && <button onClick={() => endOne(s)} style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>End session</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="premium-table-wrapper">
        <div style={{ padding: '12px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14, marginRight: 'auto' }}>Sign-in history</span>
          <input className="settings-input" style={{ height: 34, width: 190 }} placeholder="Search email or IP" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1, { search: e.target.value }); } }} />
          <select className="settings-input" style={{ height: 34 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Result">
            <option value="">All results</option><option value="ok">Successful</option><option value="failed">Failed</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid #e2e8f0' }}>{['When', !mine && 'Email', 'Result', 'Device', 'IP address'].filter(h => h !== false).map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.history.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 20 }}>{loading ? 'Loading…' : 'Nothing to show'}</td></tr>}
              {data.history.map(h => (
                <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>{when(h.created_at)}</td>
                  {!mine && <td style={td}>{h.email}</td>}
                  <td style={td}>{h.ok ? (h.revoked_at ? pill('#f1f5f9', '#64748b', 'Signed out') : pill('#ecfdf5', '#15803d', 'Success')) : <>{pill('#fef2f2', '#b91c1c', 'Failed')} <span style={{ fontSize: 11, color: '#94a3b8' }}>{h.reason}</span></>}</td>
                  <td style={td}>{h.device}</td>
                  <td style={td}>{h.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={data.total} pageSize={pageSize} itemLabel="sign-ins" onPageChange={p => { setPage(p); load(p); }} onPageSizeChange={n => { setPageSize(n); setPage(1); load(1, { perPage: n }); }} />
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>History is kept for 90 days. A session also ends when you change your password, when it expires, or when you log out.</p>
    </div>
  );
}
