import React, { useState, useEffect, useRef } from 'react';
import Pagination from '../shared/Pagination';
import { Tabs } from '@/lib/ui-motion';

const API = '/api';
import useLiveRefresh from '@/lib/live';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const formatDT = (d) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return '\u2014'; }
};

const statusBadge = (s) => {
  const m = { pending: { bg: '#fffbeb', color: '#d97706', text: 'Pending' }, approved: { bg: '#f0fdf4', color: '#16a34a', text: 'Approved' }, rejected: { bg: '#fef2f2', color: '#dc2626', text: 'Rejected' }, cancelled: { bg: '#f1f5f9', color: '#64748b', text: 'Cancelled' } };
  const c = m[(s || '').toLowerCase()] || { bg: '#f1f5f9', color: '#64748b', text: s };
  return <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{c.text}</span>;
};

const Icon = ({ name, size = 18, color = 'currentColor' }) => {
  const p = { calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2 M16 2v4M8 2v4M3 10h18', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8M16 17H8M10 9H8', check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12', eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3', refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' };
  const d = p[name] || p.calendar;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d.split(/\s(?=M)/).map((seg, i) => <path key={i} d={seg} />)}</svg>;
};

export default function AdminLeaveManagement() {
  const [activeTab, setActiveTab] = useState('requests');
  const [leaveTypes, setLeaveTypes] = useState([]);
  useEffect(() => {
    fetch(`${API}/leave-types`, { headers: auth() }).then(r => r.json()).then(d => setLeaveTypes(d.all || d.types || [])).catch(() => {});
  }, []);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, on_leave_today: 0 });
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [search, setSearch] = useState('');
  const [calType, setCalType] = useState('');
  const searchReady = useRef(false);
  const [reviewReq, setReviewReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calLeaves, setCalLeaves] = useState([]);
  const [perPage, setPerPage] = useState(15);
  const perPageRef = useRef(15);

  useLiveRefresh(() => { fetchStats(); fetchRequests(page, { silent: true }); });
  const fetchStats = () => { fetch(`${API}/leave/admin/stats`, { headers: auth() }).then(r => r.json()).then(d => setStats(d)).catch(() => {}); };
  const fetchRequests = (p = 1, o = {}) => {
    if (!o.silent) setLoading(true);
    const val = (k, cur) => (o[k] !== undefined ? o[k] : cur);
    const params = new URLSearchParams({ page: p, per_page: perPageRef.current });
    if (val('status', filterStatus)) params.set('status', val('status', filterStatus));
    if (val('type', filterType)) params.set('type', val('type', filterType));
    if (val('from', filterFrom)) params.set('date_from', val('from', filterFrom));
    if (val('to', filterTo)) params.set('date_to', val('to', filterTo));
    if (val('search', search).trim()) params.set('search', val('search', search).trim());
    fetch(`${API}/leave/admin/requests?${params}`, { headers: auth() }).then(r => r.json()).then(d => { setRequests(d.requests || []); setTotal(d.total || 0); setPage(d.page || 1); setLoading(false); }).catch(() => { setRequests([]); setTotal(0); setLoading(false); });
  };
  const fetchCalendar = (m, y) => { fetch(`${API}/leave/calendar?month=${m}&year=${y}`, { headers: auth() }).then(r => r.json()).then(d => setCalLeaves(Array.isArray(d) ? d : [])).catch(() => setCalLeaves([])); };

  useEffect(() => { fetchStats(); fetchRequests(1); }, []);
  useEffect(() => { if (activeTab === 'calendar') fetchCalendar(calMonth, calYear); }, [activeTab, calMonth, calYear]);

  const applyFilters = () => { setPage(1); fetchRequests(1); };

  // typing in the search box filters after a short pause
  useEffect(() => {
    if (!searchReady.current) { searchReady.current = true; return; }
    const t = setTimeout(() => { setPage(1); fetchRequests(1, { search }); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const setFilter = (key, setter, value) => { setter(value); setPage(1); fetchRequests(1, { [key]: value }); };
  const resetFilters = () => { setFilterType(''); setFilterStatus(''); setFilterFrom(''); setFilterTo(''); setSearch(''); setPage(1); fetchRequests(1, { type: '', status: '', from: '', to: '', search: '' }); };
  const pickTab = (v) => {
    if (v === 'calendar') { setActiveTab('calendar'); return; }
    setActiveTab('requests');
    const st = v === 'all' ? '' : v;
    setFilterStatus(st); setPage(1); fetchRequests(1, { status: st });
  };
  const tabValue = activeTab === 'calendar' ? 'calendar' : (['pending', 'approved', 'rejected'].includes(filterStatus.toLowerCase()) ? filterStatus.toLowerCase() : (filterStatus ? '' : 'all'));

  const handleApprove = async (id) => {
    setProcessing(true);
    try { const res = await fetch(`${API}/leave/${id}/approve`, { method: 'PUT', headers: auth() }); const d = await res.json(); if (!res.ok) throw new Error(d.detail || 'Failed'); setReviewReq(null); fetchStats(); fetchRequests(page); } catch (err) { alert(err.message); } finally { setProcessing(false); }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) { alert('Please provide a rejection reason'); return; }
    setProcessing(true);
    try { const res = await fetch(`${API}/leave/${id}/reject`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectReason }) }); const d = await res.json(); if (!res.ok) throw new Error(d.detail || 'Failed'); setReviewReq(null); setShowRejectInput(false); setRejectReason(''); fetchStats(); fetchRequests(page); } catch (err) { alert(err.message); } finally { setProcessing(false); }
  };

  const calByDate = {};
  const toKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  calLeaves.filter(l => !calType || l.leave_type === calType).forEach(l => {
    const a = l.start_date ? new Date(String(l.start_date).split('T')[0] + 'T00:00:00') : null;
    if (!a || isNaN(a)) return;
    const bRaw = l.end_date ? new Date(String(l.end_date).split('T')[0] + 'T00:00:00') : a;
    const b = isNaN(bRaw) ? a : bRaw;
    for (let d = new Date(a), n = 0; d <= b && n < 62; d.setDate(d.getDate() + 1), n++) {
      const k = toKey(d);
      if (!calByDate[k]) calByDate[k] = [];
      calByDate[k].push(l);
    }
  });
  // leave types come from Masters > Leave Types; each one gets a colour from this palette by its position
  const CHIP_PALETTE = [['#dcfce7', '#15803d'], ['#fee2e2', '#b91c1c'], ['#dbeafe', '#1d4ed8'], ['#fef3c7', '#b45309'], ['#ede9fe', '#6d28d9'], ['#cffafe', '#0e7490'], ['#fce7f3', '#be185d']];
  const LEAVE_CHIP = Object.fromEntries(leaveTypes.map((t, i) => [t, CHIP_PALETTE[i % CHIP_PALETTE.length]]));
  const todayKey = toKey(new Date());

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const daysInMonth = (m, y) => new Date(y, m, 0).getDate();
  const firstDayOfMonth = (m, y) => new Date(y, m - 1, 1).getDay();

  const s = {
    container: { padding: '0 21px', maxWidth: 1400, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e8f0ff' },
    btnPrimary: { padding: '9px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnOutline: { padding: '8px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  };

  return (
    <div style={s.container}>
      <style>{`.alm-r{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px}.alm-c{flex:1;min-width:160px}.alm-f{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:16px}.alm-tw{overflow-x:auto}.alm-t{width:100%;border-collapse:collapse}.alm-t tbody tr:hover{background:#f8fafc}`}</style>

      <div className="ph">
        <div>
          <h1>Leave Management</h1>
          <p>Manage employee leave requests, approvals and balances.</p>
        </div>
        <div className="ph-actions">
          <button onClick={() => { fetchStats(); fetchRequests(page); }} className="btn-o"><Icon name="refresh" size={14} /> Refresh</button>
        </div>
      </div>

      <div className="tabs-bar">
        <Tabs id="leave-tabs" value={tabValue} onChange={pickTab} tabs={[
          { id: 'all', label: <>All Requests ({stats.total || 0})</> },
          { id: 'pending', label: <>Pending Approval ({stats.pending || 0})</> },
          { id: 'approved', label: <>Approved ({stats.approved || 0})</> },
          { id: 'rejected', label: <>Rejected ({stats.rejected || 0})</> },
          { id: 'calendar', label: 'Calendar View' },
        ]} />
      </div>

      {activeTab === 'requests' && (
        <>
          <div className="filters">
            <div className="f-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search by employee name or ID..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={filterType} onChange={e => setFilter('type', setFilterType, e.target.value)} aria-label="Leave type">
              <option value="">All Types</option>
              {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilter('status', setFilterStatus, e.target.value)} aria-label="Status">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilter('from', setFilterFrom, e.target.value)} aria-label="From date" />
            <input type="date" value={filterTo} onChange={e => setFilter('to', setFilterTo, e.target.value)} aria-label="To date" />
            <button className="btn-reset" onClick={resetFilters}>Reset</button>
          </div>

          <div style={s.card}>
            {loading ? (
              <div style={{ padding: 38 }}>{[1,2,3,4].map(i => <div key={i} style={{ height: 24, background: '#f1f5f9', borderRadius: 8, margin: '12px 0' }} />)}</div>
            ) : requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 14 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No leave requests found</div><div style={{ fontSize: 13 }}>Try adjusting your filters or check back later.</div>
              </div>
            ) : (
              <>
                <div className="alm-tw">
                  <table className="alm-t">
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {['#','Employee','Leave Type','Date Range','Duration','Applied','Status','Actions'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r, idx) => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{(page - 1) * perPage + idx + 1}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13 }}>
                            <div style={{ fontWeight: 500, color: '#0f172a', fontSize: 14 }}>{r.emp_name || r.employee_name}</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.emp_code || r.employee_code}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', color: '#0f172a' }}>{r.leave_type}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', color: '#475569' }}>{formatDT(r.start_date)} - {formatDT(r.end_date)}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', color: '#475569' }}>{r.duration} day{r.duration > 1 ? 's' : ''}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', color: '#475569' }}>{formatDT(r.applied_on)}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13 }}>{statusBadge(r.status)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {(r.status || '').toLowerCase() === 'pending' ? (
                              <button onClick={() => setReviewReq(r)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Review</button>
                            ) : (
                              <button onClick={() => setReviewReq(r)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>View</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination onPageSizeChange={n => { perPageRef.current = n; setPerPage(n); setPage(1); fetchRequests(1); }} page={page} totalItems={total} pageSize={perPage} itemLabel="requests" onPageChange={p => { setPage(p); fetchRequests(p); }} />
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'calendar' && (
        <div className="lc">
          <style>{`
            .lc { background:#fff; border:1px solid #e8edf6; border-radius:12px; padding:14px 16px; }
            .lc-top { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
            .lc-top h3 { margin:0; font-size:1rem; font-weight:700; color:#0f172a; }
            .lc-ctl { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
            .lc-ctl select { height:34px; padding:0 26px 0 10px; border:1px solid #e2e8f0; border-radius:9px; font-size:.8rem; color:#334155; background:#fff; outline:none; }
            .lc-nav { width:34px; height:34px; border:1px solid #e2e8f0; border-radius:9px; background:#fff; cursor:pointer; color:#334155; font-size:1rem; line-height:1; }
            .lc-nav:hover { background:#f1f6ff; border-color:#bfdbfe; color:#1d4ed8; }
            .lc-grid { display:grid; grid-template-columns:repeat(7,1fr); border-top:1px solid #eef2f7; border-left:1px solid #eef2f7; }
            .lc-dow { padding:8px 0; text-align:center; font-size:.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase; background:#f8fafc; border-right:1px solid #eef2f7; border-bottom:1px solid #eef2f7; }
            .lc-cell { min-height:78px; padding:5px 6px; border-right:1px solid #eef2f7; border-bottom:1px solid #eef2f7; }
            .lc-cell.empty { background:#fafbfd; }
            .lc-day { font-size:.76rem; font-weight:600; color:#64748b; margin-bottom:3px; display:inline-flex; width:22px; height:22px; align-items:center; justify-content:center; border-radius:50%; }
            .lc-cell.today .lc-day { background:#2563eb; color:#fff; }
            .lc-chip { font-size:.66rem; font-weight:600; border-radius:4px; padding:2px 5px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .lc-more { font-size:.64rem; color:#2563eb; font-weight:700; }
          `}</style>
          <div className="lc-top">
            <h3>Leave Calendar</h3>
            <div className="lc-ctl">
              <select value={calMonth} onChange={e => setCalMonth(Number(e.target.value))} aria-label="Month">
                {monthNames.map((m, i) => <option key={m} value={i + 1}>{m} {calYear}</option>)}
              </select>
              <button className="btn-o" style={{ height: 34 }} onClick={() => { const t = new Date(); setCalMonth(t.getMonth() + 1); setCalYear(t.getFullYear()); }}>Today</button>
              <button className="lc-nav" aria-label="Previous month" onClick={() => { const d = new Date(calYear, calMonth - 2); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()); }}>&lsaquo;</button>
              <button className="lc-nav" aria-label="Next month" onClick={() => { const d = new Date(calYear, calMonth); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()); }}>&rsaquo;</button>
              <select value={calType} onChange={e => setCalType(e.target.value)} aria-label="Leave type">
                <option value="">All Leave Types</option>
                {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="lc-grid">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="lc-dow">{d}</div>)}
            {Array.from({ length: firstDayOfMonth(calMonth, calYear) }, (_, i) => <div key={`e${i}`} className="lc-cell empty" />)}
            {Array.from({ length: daysInMonth(calMonth, calYear) }, (_, i) => {
              const day = i + 1;
              const key = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const leaves = calByDate[key] || [];
              return (
                <div key={day} className={`lc-cell${key === todayKey ? ' today' : ''}`}>
                  <span className="lc-day">{day}</span>
                  {leaves.slice(0, 2).map((l, j) => {
                    const c = LEAVE_CHIP[l.leave_type] || ['#eef2ff', '#3730a3'];
                    return <div key={j} className="lc-chip" style={{ background: c[0], color: c[1] }} title={(l.emp_full_name || l.employee_name) + (l.leave_type ? ' - ' + l.leave_type : '')}>{l.emp_full_name || l.employee_name}</div>;
                  })}
                  {leaves.length > 2 && <div className="lc-more">+{leaves.length - 2} more</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviewReq && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }} onClick={() => { setReviewReq(null); setShowRejectInput(false); setRejectReason(''); }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 14, padding: 24, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', zIndex: 1001, boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h4 style={{ margin: 0, fontSize: 19, color: '#0f172a', fontWeight: 700 }}>Review Leave Request</h4>
              <button onClick={() => { setReviewReq(null); setShowRejectInput(false); setRejectReason(''); }} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
            </div>
            <h5 style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee Information</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc' }}>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Name</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.emp_name || reviewReq.employee_name}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Employee ID</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.emp_code || reviewReq.employee_code}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Designation</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.designation || '\u2014'}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Department</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.emp_dept || '\u2014'}</div></div>
            </div>
            <h5 style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave Information</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc' }}>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Leave Type</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.leave_type}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Duration</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.duration} day{reviewReq.duration > 1 ? 's' : ''}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Start Date</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(reviewReq.start_date)}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>End Date</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(reviewReq.end_date)}</div></div>
            </div>
            <h5 style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</h5>
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc', fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{reviewReq.reason || 'No reason provided.'}{reviewReq.supporting_doc && (<div style={{ marginTop: 10 }}><a href="#" onClick={async (e) => { e.preventDefault(); try { const res = await fetch(`${API}/leave/${reviewReq.id}/document`, { headers: auth() }); if (!res.ok) throw new Error((await res.json()).detail || 'Could not open the document'); window.open(URL.createObjectURL(await res.blob()), '_blank'); } catch (err) { alert(err.message); } }} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>View supporting document &darr;</a></div>)}</div>
            {(reviewReq.status || '').toLowerCase() === 'pending' && (
              <>
                <h5 style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave Balance</h5>
                <BalanceView employeeId={reviewReq.employee_id} />
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => handleApprove(reviewReq.id)} disabled={processing} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: processing ? '#93c5fd' : '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', minWidth: 120 }}>{processing ? 'Processing...' : 'Approve Leave'}</button>
                  <button onClick={() => setShowRejectInput(true)} disabled={processing} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: processing ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', minWidth: 120 }}>{processing ? 'Processing...' : 'Reject Leave'}</button>
                </div>
                {showRejectInput && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: '#fef2f2' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 6, display: 'block' }}>Rejection Reason *</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Insufficient balance, Project deadline conflict, ..." style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #fecaca', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                    <button onClick={() => handleReject(reviewReq.id)} disabled={processing || !rejectReason.trim()} style={{ marginTop: 8, padding: '9px 14px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Confirm Reject</button>
                  </div>
                )}
              </>
            )}
            {reviewReq.status !== 'pending' && (
              <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                This request has been {reviewReq.status}.{reviewReq.rejection_reason && <div style={{ marginTop: 4, color: '#dc2626' }}>Reason: {reviewReq.rejection_reason}</div>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BalanceView({ employeeId }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/leave/employee/${employeeId}/balance`, { headers: auth() }).then(r => r.json()).then(d => setBalances(d.balances || [])).catch(() => {}).finally(() => setLoading(false));
  }, [employeeId]);
  if (loading) return <div style={{ padding: 8, color: '#94a3b8', fontSize: 13 }}>Loading...</div>;
  return (
    <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: '#f0fdf4' }}>
      {balances.map(b => (
        <div key={b.leave_type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#065f46', padding: '4px 0' }}>
          <span>{b.leave_type}</span>
          <span style={{ fontWeight: 600 }}>{b.remaining !== undefined ? b.remaining : ((b.total_days || 0) - (b.used_days || 0))} days remaining</span>
        </div>
      ))}
    </div>
  );
}
