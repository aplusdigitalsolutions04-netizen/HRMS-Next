import React, { useState, useEffect, useCallback, useRef } from 'react';
import Pagination from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const COLORS = ['var(--brand)', '#7c3aed', '#0d9488', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#b45309'];
const colorOf = (s) => COLORS[[...String(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const Avatar = ({ name }) => <span style={{ width: 32, height: 32, borderRadius: '50%', background: colorOf(name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{initials(name)}</span>;

// Who works here (work details only) and the birthdays and work anniversaries of the month.
export default function Directory() {
  const [tab, setTab] = useState('people');
  return (
    <div>
      <div className="ph">
        <div>
          <h1>Directory</h1>
          <p>Your colleagues, their role and how to reach them at work, and who has a birthday or a work anniversary.</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['people', 'People'], ['celebrations', 'Birthdays & Anniversaries']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ border: '1px solid ' + (tab === k ? 'var(--brand)' : '#e2e8f0'), background: tab === k ? 'var(--brand)' : '#fff', color: tab === k ? '#fff' : '#475569', padding: '7px 16px', borderRadius: 20, fontWeight: 600, fontSize: '.82rem', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      {tab === 'people' ? <People /> : <Celebrations />}
    </div>
  );
}

function People() {
  const [data, setData] = useState({ people: [], total: 0, designations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [designation, setDesignation] = useState('');
  const ready = useRef(false);

  const load = useCallback((p = 1, o = {}) => {
    setLoading(true); setError('');
    const q = { search, designation, perPage: pageSize, ...o };
    const params = new URLSearchParams({ page: p, per_page: q.perPage });
    if (q.search) params.set('search', q.search);
    if (q.designation) params.set('designation', q.designation);
    fetch(`${API}/directory?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setData(d); setPage(d.page || 1); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [search, designation, pageSize]);

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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, role, email or location..." style={{ flex: '1 1 240px', maxWidth: 380, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', outline: 'none', fontFamily: 'inherit' }} />
        <select value={designation} onChange={e => { setDesignation(e.target.value); load(1, { designation: e.target.value }); }} style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', background: '#fff', fontFamily: 'inherit' }}>
          <option value="">All roles</option>{data.designations.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}
      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={cell}>Name</th><th style={cell}>Role</th><th style={cell}>Location</th><th style={cell}>Work email</th><th style={cell}>Work phone</th><th style={cell}>Reports to</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : data.people.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Nobody matches.</td></tr>
                : data.people.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Avatar name={p.full_name} /><b>{p.full_name}</b></span></td>
                    <td style={cell}>{p.designation || '-'}</td>
                    <td style={cell}>{p.location || '-'}</td>
                    <td style={cell}>{p.official_email ? <a href={`mailto:${p.official_email}`} style={{ color: 'var(--brand)' }}>{p.official_email}</a> : '-'}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{p.official_no ? <a href={`tel:${p.official_no}`} style={{ color: 'var(--brand)' }}>{p.official_no}</a> : '-'}</td>
                    <td style={cell}>{p.manager_name || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={data.total} pageSize={pageSize} itemLabel="people" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}

function Celebrations() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    fetch(`${API}/directory/celebrations?month=${month}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(setData).catch(e => setError(e.message));
  }, [month]);

  const isToday = (day) => data && month === data.today.month && day === data.today.day;
  const step = (n) => setMonth(m => ((m - 1 + n + 12) % 12) + 1);

  const Block = ({ title, icon, rows, note }) => (
    <div style={{ flex: '1 1 320px', background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', fontWeight: 700, borderBottom: '1px solid #eef2f7', background: '#f8fafc' }}>{icon} {title} <span style={{ color: '#94a3b8', fontWeight: 600 }}>({rows.length})</span></div>
      {rows.length === 0 ? <div style={{ padding: 22, textAlign: 'center', color: '#94a3b8', fontSize: '.85rem' }}>Nobody this month.</div>
        : rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderTop: i ? '1px solid #f4f6fa' : 'none', background: isToday(r.day) ? '#fefce8' : 'transparent' }}>
            <span style={{ minWidth: 44, textAlign: 'center', background: isToday(r.day) ? '#fde68a' : 'var(--brand-soft)', color: isToday(r.day) ? '#92400e' : 'var(--brand-dark)', borderRadius: 8, padding: '3px 0', fontWeight: 700, fontSize: '.8rem' }}>{r.day} {MONTHS[month - 1].slice(0, 3)}</span>
            <Avatar name={r.full_name} />
            <span style={{ flex: 1, minWidth: 0 }}><b style={{ wordBreak: 'break-word' }}>{r.full_name}</b>{isToday(r.day) ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#b45309' }}>Today</span> : null}<br /><span style={{ color: '#64748b', fontSize: '.78rem' }}>{r.designation || ''}{note(r)}</span></span>
          </div>
        ))}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button className="btn-premium" onClick={() => step(-1)} aria-label="Previous month">&lsaquo;</button>
        <b style={{ minWidth: 120, textAlign: 'center' }}>{MONTHS[month - 1]}</b>
        <button className="btn-premium" onClick={() => step(1)} aria-label="Next month">&rsaquo;</button>
        {month !== now.getMonth() + 1 && <button className="btn-premium" style={{ background: '#64748b' }} onClick={() => setMonth(now.getMonth() + 1)}>This month</button>}
      </div>
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}
      {!data && !error ? <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading...</div> : data && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Block title="Birthdays" icon="🎂" rows={data.birthdays} note={() => ''} />
          <Block title="Work anniversaries" icon="🎉" rows={data.anniversaries} note={(r) => ` · ${r.years} year${r.years === 1 ? '' : 's'} with the company`} />
        </div>
      )}
    </div>
  );
}
