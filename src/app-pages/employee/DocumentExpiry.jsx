import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Pagination from '../shared/Pagination';
import { appLocale } from '@/lib/app-config-client';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const day = (v) => { try { return new Date(v + 'T00:00:00').toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; } };

const Left = ({ n }) => {
  const [bg, color, text] = n < 0 ? ['#fef2f2', '#b91c1c', `Expired ${-n} day${-n === 1 ? '' : 's'} ago`]
    : n === 0 ? ['#fef2f2', '#b91c1c', 'Expires today']
    : n <= 30 ? ['#fffbeb', '#b45309', `${n} day${n === 1 ? '' : 's'} left`]
    : ['#f0fdf4', '#15803d', `${n} days left`];
  return <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>;
};

// Documents with an expiry date (passport, licence, certificates ...). The date is set on the Documents tab of the employee profile;
// the employee and HR are reminded 30 days before, 7 days before and when it expires.
export default function DocumentExpiry() {
  const [data, setData] = useState({ items: [], total: 0, summary: { expired: 0, within_30: 0, all: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [win, setWin] = useState('60');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = useRef(false);

  const load = useCallback((p = 1, o = {}) => {
    setLoading(true); setError('');
    const q = { win, search, perPage: pageSize, ...o };
    const params = new URLSearchParams({ page: p, per_page: q.perPage, window: q.win });
    if (q.search) params.set('search', q.search);
    fetch(`${API}/document-expiry?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setData(d); setPage(d.page || 1); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [win, search, pageSize]);

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [search]);

  const sendNow = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/document-expiry`, { method: 'POST', headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not send');
      Swal.fire({ icon: 'success', title: 'Done', text: d.message, timer: 2000, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(false); }
  };

  const chip = (key, label) => {
    const on = win === key;
    return <button key={key} onClick={() => { setWin(key); load(1, { win: key }); }} style={{ border: '1px solid ' + (on ? 'var(--brand)' : '#e2e8f0'), background: on ? 'var(--brand)' : '#fff', color: on ? '#fff' : '#475569', padding: '6px 14px', borderRadius: 20, fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' }}>{label}</button>;
  };
  const card = (label, value, color) => (
    <div style={{ flex: '1 1 130px', background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: '10px 14px' }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );
  const cell = { padding: '9px 12px' };

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Document Expiry</h1>
          <p>Documents that are about to expire or have expired. Set a date on the Documents tab of the employee profile (Valid till). The employee and HR are reminded 30 days before, 7 days before and on the day it expires.</p>
        </div>
        <div className="ph-actions"><button className="btn-premium" onClick={sendNow} disabled={busy}>{busy ? 'Sending...' : 'Send due reminders now'}</button></div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {card('Expired', data.summary.expired, data.summary.expired ? '#b91c1c' : '#15803d')}
        {card('Expire within 30 days', data.summary.within_30, data.summary.within_30 ? '#b45309' : '#15803d')}
        {card('Documents with a date', data.summary.all, '#0f172a')}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {chip('expired', 'Expired')}{chip('30', 'Within 30 days')}{chip('60', 'Within 60 days')}{chip('all', 'All')}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by employee..." style={{ flex: '1 1 200px', maxWidth: 300, padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.85rem', outline: 'none', fontFamily: 'inherit' }} />
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={cell}>Employee</th><th style={cell}>Document</th><th style={cell}>Valid till</th><th style={cell}>Status</th><th style={cell}></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : data.items.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No documents here. Nothing is about to expire.</td></tr>
                : data.items.map(r => (
                  <tr key={r.employee_id + r.document_type} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}><b>{r.full_name}</b> <span style={{ color: '#94a3b8' }}>({r.emp_code})</span></td>
                    <td style={cell}>{r.label}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{day(r.expiry_date)}</td>
                    <td style={cell}><Left n={r.days_left} /></td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}><Link to={`/employees/detail/${r.employee_id}?tab=documents`} style={{ color: 'var(--brand)', fontWeight: 600 }}>Open profile</Link></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={data.total} pageSize={pageSize} itemLabel="documents" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}
