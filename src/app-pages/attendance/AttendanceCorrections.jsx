import React, { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import Pagination from '../shared/Pagination';
import useStatusMaster, { pillStyle } from '../shared/useStatusMaster';
import { Tabs } from '@/lib/ui-motion';

const API = '/api';
import useLiveRefresh from '@/lib/live';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const fmtDate = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

// HR side of "I forgot to punch": employees raise a request from their portal; approving it fixes
// that day's attendance (times, hours, status) straight away.
export default function AttendanceCorrections() {
  const sm = useStatusMaster();
  const [tab, setTab] = useState('Pending');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const ready = useRef(false);

  const load = useCallback((p = page, o = {}) => {
    if (!o.silent) setLoading(true);
    const st = o.status !== undefined ? o.status : tab;
    const q = o.search !== undefined ? o.search : search;
    const params = new URLSearchParams({ page: p, per_page: o.perPage || pageSize });
    if (st && st !== 'All') params.set('status', st);
    if (q.trim()) params.set('search', q.trim());
    fetch(`${API}/attendance/regularization?${params}`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setRows(d.requests || []); setTotal(d.total || 0); setCounts(d.counts || {}); setPage(d.page || 1); })
      .catch(() => { setRows([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, tab, search, pageSize]);

  useEffect(() => { load(1); }, []);
  useLiveRefresh(() => load(page, { silent: true }));
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1, { search }), 350);
    return () => clearTimeout(t);
  }, [search]);

  const decide = async (r, action) => {
    let note = '';
    if (action === 'reject') {
      const x = await Swal.fire({ title: 'Reject this request?', input: 'text', inputPlaceholder: 'Reason (the employee will see it)', showCancelButton: true, confirmButtonText: 'Reject', confirmButtonColor: '#dc2626', inputValidator: v => (!v || !v.trim() ? 'Please write a reason' : null) });
      if (!x.isConfirmed) return;
      note = x.value.trim();
    } else {
      const x = await Swal.fire({ icon: 'question', title: 'Approve?', html: r.request_type === 'Late coming' ? `Late coming of <b>${r.employee_name}</b> on <b>${fmtDate(r.attendance_date)}</b> (arrived ${r.in_time}) will be marked approved.` : `Attendance for <b>${r.employee_name}</b> on <b>${fmtDate(r.attendance_date)}</b> will be corrected to <b>${r.in_time} - ${r.out_time}</b>.`, showCancelButton: true, confirmButtonText: 'Approve', confirmButtonColor: '#2563eb' });
      if (!x.isConfirmed) return;
    }
    setBusy(r.id);
    try {
      const res = await fetch(`${API}/attendance/regularization/${r.id}`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed');
      Swal.fire({ icon: 'success', title: d.message, timer: 1500, showConfirmButton: false });
      load(page);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(''); }
  };

  const pill = (s) => {
    const m = { Pending: ['#fffbeb', '#b45309'], Approved: ['#f0fdf4', '#15803d'], Rejected: ['#fef2f2', '#b91c1c'] }[s] || ['#f1f5f9', '#475569'];
    return <span style={{ background: m[0], color: m[1], padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{s}</span>;
  };
  const all = (counts.Pending || 0) + (counts.Approved || 0) + (counts.Rejected || 0);

  return (
    <div>
      <style>{`
        .ac-t { width:100%; border-collapse:collapse; }
        .ac-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; white-space:nowrap; }
        .ac-t td { padding:9px 12px; font-size:.82rem; color:#334155; border-bottom:1px solid #f4f6fa; vertical-align:middle; }
        .ac-act { display:flex; gap:6px; }
        .ac-ok, .ac-no { height:30px; padding:0 12px; border-radius:7px; font-size:.78rem; font-weight:600; cursor:pointer; border:1px solid; background:#fff; }
        .ac-ok { color:#fff; background:#2563eb; border-color:#2563eb; } .ac-ok:hover:not(:disabled) { background:#1d4ed8; }
        .ac-no { color:#b91c1c; border-color:#fecaca; } .ac-no:hover:not(:disabled) { background:#fef2f2; }
        .ac-ok:disabled, .ac-no:disabled { opacity:.6; cursor:not-allowed; }
        .ac-card { background:#fff; border:1px solid #e8edf6; border-radius:12px; overflow:hidden; }
      `}</style>
      <div className="ph">
        <div>
          <h1>Attendance Corrections</h1>
          <p>Missed-punch and late-coming requests. The reporting manager approves first, then it comes here for HR. Approving a missed punch fixes that day&apos;s attendance straight away.</p>
        </div>
      </div>

      <div className="tabs-bar">
        <Tabs id="corr-tabs" value={tab} onChange={v => { setTab(v); setPage(1); load(1, { status: v }); }} tabs={[
          { id: 'Pending', label: <>Pending ({counts.Pending || 0})</> },
          { id: 'Approved', label: <>Approved ({counts.Approved || 0})</> },
          { id: 'Rejected', label: <>Rejected ({counts.Rejected || 0})</> },
          { id: 'All', label: <>All ({all})</> },
        ]} />
      </div>

      <div className="filters">
        <div className="f-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by employee name or code..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-reset" onClick={() => { setSearch(''); load(1, { search: '' }); }}>Reset</button>
      </div>

      <div className="ac-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="ac-t">
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th>Employee</th><th>Date</th><th>Type</th><th>Recorded now</th><th>Requested</th><th>Reason</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No {tab === 'All' ? '' : tab.toLowerCase() + ' '}correction requests.</td></tr>
              ) : rows.map((r, i) => {
                const st = r.cur_status ? sm.find('attendance', r.cur_status) : null;
                return (
                  <tr key={r.id}>
                    <td style={{ color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{r.employee_name || '-'}<div style={{ fontSize: '.7rem', color: '#94a3b8', fontWeight: 500 }}>{r.emp_code}</div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.attendance_date)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.request_type || 'Missed punch'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.cur_in || '--:--'} - {r.cur_out || '--:--'}{st && <> <span style={pillStyle(st.color)}>{st.label}</span></>}</td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.request_type === 'Late coming' ? `Arrived ${r.in_time}` : `${r.in_time} - ${r.out_time}`}</td>
                    <td style={{ maxWidth: 240 }} title={r.reason}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</div>{r.review_note && <div style={{ fontSize: '.7rem', color: '#94a3b8' }}>Note: {r.review_note}</div>}</td>
                    <td>{pill(r.status)}</td>
                    <td>
                      {r.status === 'Pending' && r.awaiting === 'MANAGER' ? (
                        <span style={{ fontSize: '.74rem', color: '#b45309', fontWeight: 600 }}>With manager{r.manager_name ? ` (${r.manager_name})` : ''}</span>
                      ) : r.status === 'Pending' ? (
                        <div className="ac-act">
                          <button className="ac-ok" disabled={busy === r.id} onClick={() => decide(r, 'approve')}>Approve</button>
                          <button className="ac-no" disabled={busy === r.id} onClick={() => decide(r, 'reject')}>Reject</button>
                        </div>
                      ) : <span style={{ fontSize: '.72rem', color: '#94a3b8' }}>{r.reviewed_by || ''}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={total} pageSize={pageSize} itemLabel="requests" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}
