import React, { useState, useEffect, useCallback, useRef } from 'react';
import Pagination from '../shared/Pagination';
import { appLocale, currencySymbol } from '@/lib/app-config-client';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const day = (v) => { try { return new Date(v + 'T00:00:00').toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; } };
const money = (v) => (v == null ? '-' : currencySymbol() + ' ' + Number(v).toLocaleString(appLocale(), { maximumFractionDigits: 2 }));
const REASON_COLOR = { Joining: ['#ecfeff', '#0e7490'], Appraisal: ['#f0fdf4', '#15803d'], Promotion: ['#faf5ff', '#7e22ce'], Correction: ['#fffbeb', '#b45309'], Other: ['#f1f5f9', '#475569'] };
const LABELS = { basic_pay: 'Basic Pay', hra: 'HRA', conveyance_allowance: 'Conveyance', food_vouchers: 'Food Vouchers', medical_insurance: 'Medical Insurance', other_deductions: 'Other Deductions', incentives: 'Incentives', el_encashment: 'EL Encashment' };

// What changed in the structure, one line per changed part
function Diff({ r }) {
  const rows = [];
  const o = r.old || {}, n = r.new || {};
  for (const k of Object.keys(LABELS)) if ((o[k] || 0) !== (n[k] || 0)) rows.push([LABELS[k], o[k] || 0, n[k] || 0]);
  const key = (x) => x.key + ':' + x.label;
  const oe = Object.fromEntries((o.extra_components || []).map(x => [key(x), x])), ne = Object.fromEntries((n.extra_components || []).map(x => [key(x), x]));
  for (const k of new Set([...Object.keys(oe), ...Object.keys(ne)])) if ((oe[k]?.amount || 0) !== (ne[k]?.amount || 0)) rows.push([(ne[k] || oe[k]).label, oe[k]?.amount || 0, ne[k]?.amount || 0]);
  if (!r.old) return <div style={{ fontSize: '.78rem', color: '#64748b' }}>The first salary structure of this employee ({money(r.new_total)} a month).</div>;
  return (
    <table style={{ width: 'auto', borderCollapse: 'collapse', fontSize: '.78rem' }}>
      <thead><tr><th style={{ textAlign: 'left', padding: '3px 14px 3px 0' }}>Part</th><th style={{ textAlign: 'right', padding: '3px 14px' }}>Before</th><th style={{ textAlign: 'right', padding: '3px 0 3px 14px' }}>After</th></tr></thead>
      <tbody>{rows.map(([l, a, b]) => <tr key={l}><td style={{ padding: '2px 14px 2px 0' }}>{l}</td><td style={{ textAlign: 'right', padding: '2px 14px' }}>{money(a)}</td><td style={{ textAlign: 'right', padding: '2px 0 2px 14px', fontWeight: 700, color: b > a ? '#15803d' : '#b91c1c' }}>{money(b)}</td></tr>)}</tbody>
    </table>
  );
}

// Every change of a salary structure: from which date, why, and what it was before and after.
export default function SalaryRevisions() {
  const initial = new URLSearchParams(window.location.search).get('emp') || '';
  const [data, setData] = useState({ revisions: [], total: 0, reasons: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState(initial);
  const [open, setOpen] = useState(null);
  const ready = useRef(false);

  const load = useCallback((p = 1, o = {}) => {
    setLoading(true); setError('');
    const q = { reason, search, perPage: pageSize, ...o };
    const params = new URLSearchParams({ page: p, per_page: q.perPage });
    if (q.reason) params.set('reason', q.reason);
    if (q.search) params.set('search', q.search);
    fetch(`${API}/payroll/salary-revisions?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setData(d); setPage(d.page || 1); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [reason, search, pageSize]);

  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [search]);

  const cell = { padding: '9px 12px' };
  return (
    <div>
      <div className="ph">
        <div>
          <h1>Salary Revisions</h1>
          <p>The history of every salary change: from which date it applies, why, and the pay before and after. A month's salary is always worked out with the structure that was valid in that month.</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by employee name or ID..." style={{ flex: '1 1 220px', maxWidth: 340, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', outline: 'none', fontFamily: 'inherit' }} />
        <select value={reason} onChange={e => { setReason(e.target.value); load(1, { reason: e.target.value }); }} style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', background: '#fff', fontFamily: 'inherit' }}>
          <option value="">All reasons</option>{data.reasons.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}
      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={cell}>Employee</th><th style={cell}>From</th><th style={cell}>Reason</th><th style={{ ...cell, textAlign: 'right' }}>Monthly pay before</th><th style={{ ...cell, textAlign: 'right' }}>After</th><th style={{ ...cell, textAlign: 'right' }}>Change</th><th style={cell}>Done by</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : data.revisions.length === 0 ? <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No salary changes yet. Every change made in Salary Structures is listed here.</td></tr>
                : data.revisions.map(r => {
                  const c = REASON_COLOR[r.reason] || REASON_COLOR.Other;
                  return (
                    <React.Fragment key={r.id}>
                      <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}><b>{r.full_name || r.emp_code}</b> <span style={{ color: '#94a3b8' }}>({r.emp_code})</span></td>
                        <td style={{ ...cell, whiteSpace: 'nowrap' }}>{day(r.effective_from)}</td>
                        <td style={cell}><span style={{ background: c[0], color: c[1], padding: '2px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{r.reason}</span></td>
                        <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(r.old_total)}</td>
                        <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{money(r.new_total)}</td>
                        <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: r.change > 0 ? '#15803d' : r.change < 0 ? '#b91c1c' : '#64748b' }}>{r.change == null ? '-' : (r.change > 0 ? '+' : '') + r.change + '%'}</td>
                        <td style={{ ...cell, whiteSpace: 'nowrap', color: '#64748b' }}>{String(r.revised_by || '').split('@')[0]}</td>
                      </tr>
                      {open === r.id && <tr><td colSpan="7" style={{ background: '#f8fafc', padding: '10px 14px' }}>{r.note ? <div style={{ marginBottom: 8, fontSize: '.8rem' }}><b>Note:</b> {r.note}</div> : null}<Diff r={r} /></td></tr>}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={data.total} pageSize={pageSize} itemLabel="revisions" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}
