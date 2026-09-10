import React, { useState, useEffect } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const formatDT = (d) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return '\u2014'; }
};

const statusBadge = (s) => {
  const m = { pending: { bg: '#fffbeb', color: '#d97706', text: 'Pending' }, approved: { bg: '#f0fdf4', color: '#16a34a', text: 'Approved' }, rejected: { bg: '#fef2f2', color: '#dc2626', text: 'Rejected' }, cancelled: { bg: '#f1f5f9', color: '#64748b', text: 'Cancelled' } };
  const c = m[(s || '').toLowerCase()] || { bg: '#f1f5f9', color: '#64748b', text: s };
  return <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{c.text}</span>;
};

const Icon = ({ name, size = 18, color = 'currentColor' }) => {
  const p = { calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2 M16 2v4M8 2v4M3 10h18', file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8M16 17H8M10 9H8', check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12', eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3', refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' };
  const d = p[name] || p.calendar;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d.split(' ').map((seg, i) => <path key={i} d={seg} />)}</svg>;
};

export default function AdminLeaveManagement() {
  const [activeTab, setActiveTab] = useState('requests');
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, on_leave_today: 0 });
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [reviewReq, setReviewReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calLeaves, setCalLeaves] = useState([]);
  const perPage = 15;

  const fetchStats = () => { fetch(`${API}/leave/admin/stats`, { headers: auth() }).then(r => r.json()).then(d => setStats(d)).catch(() => {}); };
  const fetchRequests = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: perPage });
    if (filterStatus) params.set('status', filterStatus);
    if (filterFrom) params.set('date_from', filterFrom);
    if (filterTo) params.set('date_to', filterTo);
    fetch(`${API}/leave/admin/requests?${params}`, { headers: auth() }).then(r => r.json()).then(d => { setRequests(d.requests || []); setTotal(d.total || 0); setPage(d.page || 1); setLoading(false); }).catch(() => { setRequests([]); setTotal(0); setLoading(false); });
  };
  const fetchCalendar = (m, y) => { fetch(`${API}/leave/calendar?month=${m}&year=${y}`, { headers: auth() }).then(r => r.json()).then(d => setCalLeaves(Array.isArray(d) ? d : [])).catch(() => setCalLeaves([])); };

  useEffect(() => { fetchStats(); fetchRequests(1); }, []);
  useEffect(() => { if (activeTab === 'calendar') fetchCalendar(calMonth, calYear); }, [activeTab, calMonth, calYear]);

  const applyFilters = () => { setPage(1); fetchRequests(1); };

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
  calLeaves.forEach(l => { const k = l.start_date ? l.start_date.split('T')[0] : ''; if (k) { if (!calByDate[k]) calByDate[k] = []; calByDate[k].push(l); } });

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const daysInMonth = (m, y) => new Date(y, m, 0).getDate();
  const firstDayOfMonth = (m, y) => new Date(y, m - 1, 1).getDay();

  const s = {
    container: { padding: '0 28px', maxWidth: 1400, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff' },
    btnPrimary: { padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnOutline: { padding: '8px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  };

  return (
    <div style={s.container}>
      <style>{`.alm-r{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:20px}.alm-c{flex:1;min-width:160px}.alm-f{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:16px}.alm-tw{overflow-x:auto}.alm-t{width:100%;border-collapse:collapse}.alm-t tbody tr:hover{background:#f8fafc}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div><h4 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Leave Management</h4><p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>Manage employee leave requests and approvals.</p></div>
        </div>
        <button onClick={fetchStats} style={s.btnOutline}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div className="alm-r">
        {[{label:'Total Requests',value:stats.total,color:'#6366f1',bg:'#efeafe'},{label:'Pending',value:stats.pending,color:'#d97706',bg:'#fffbeb'},{label:'Approved',value:stats.approved,color:'#16a34a',bg:'#f0fdf4'},{label:'Rejected',value:stats.rejected,color:'#dc2626',bg:'#fef2f2'}].map(stat => (
          <div key={stat.label} className="alm-c">
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff', height: '100%' }}>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ height: 4, width: '40%', borderRadius: 4, background: stat.bg, marginTop: 10 }}><div style={{ height: '100%', width: '60%', borderRadius: 4, background: stat.color }} /></div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
        {[{key:'requests',label:'Leave Requests'},{key:'calendar',label:'Calendar View'}].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: '10px 22px', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: activeTab === t.key ? '#6366f1' : '#94a3b8', cursor: 'pointer', borderBottom: activeTab === t.key ? '2px solid #6366f1' : '2px solid transparent' }}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'requests' && (
        <>
          <div className="alm-f">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}>
              <option value="">All Types</option>
              <option value="Annual Leave">Annual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Casual Leave">Casual Leave</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
            <button onClick={applyFilters} style={s.btnPrimary}>Apply Filters</button>
            {(filterStatus||filterType||filterFrom||filterTo) && <button onClick={() => { setFilterType('');setFilterStatus('');setFilterFrom('');setFilterTo('');fetchRequests(1); }} style={{ ...s.btnOutline, color: '#dc2626', borderColor: '#fecaca' }}>Clear</button>}
          </div>

          <div style={s.card}>
            {loading ? (
              <div style={{ padding: 50 }}>{[1,2,3,4].map(i => <div key={i} style={{ height: 24, background: '#f1f5f9', borderRadius: 8, margin: '12px 0' }} />)}</div>
            ) : requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
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
                              <button onClick={() => setReviewReq(r)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Review</button>
                            ) : (
                              <button onClick={() => setReviewReq(r)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>View</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {total > perPage && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '14px 0' }}>
                    {Array.from({ length: Math.ceil(total / perPage) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => { setPage(p); fetchRequests(p); }} style={{ padding: '6px 12px', borderRadius: 6, border: p === page ? '2px solid #6366f1' : '1px solid #e2e8f0', background: p === page ? '#efeafe' : '#fff', color: p === page ? '#6366f1' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{p}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'calendar' && (
        <div style={s.card}>
          <div style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <button onClick={() => { const d = new Date(calYear, calMonth - 2); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>&larr; Prev</button>
              <h5 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{monthNames[calMonth-1]} {calYear}</h5>
              <button onClick={() => { const d = new Date(calYear, calMonth); setCalMonth(d.getMonth() + 1); setCalYear(d.getFullYear()); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Next &rarr;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, padding: '10px 0', textAlign: 'center' }}>{d}</div>)}
              {Array.from({ length: firstDayOfMonth(calMonth, calYear) }, (_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth(calMonth, calYear) }, (_, i) => {
                const day = i + 1;
                const key = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const leaves = calByDate[key] || [];
                return (
                  <div key={day} style={{ padding: 6, borderRadius: 8, background: leaves.length ? '#f0fdf4' : 'transparent', minHeight: 72, border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: leaves.length ? '#16a34a' : '#64748b', marginBottom: 4 }}>{day}</div>
                    {leaves.slice(0, 2).map((l, j) => (
                      <div key={j} style={{ fontSize: 11, color: '#0f172a', lineHeight: 1.3, background: '#f8fafc', borderRadius: 4, padding: '2px 5px', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.emp_full_name || l.employee_name}</div>
                    ))}
                    {leaves.length > 2 && <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>+{leaves.length - 2} more</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {reviewReq && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }} onClick={() => { setReviewReq(null); setShowRejectInput(false); setRejectReason(''); }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 20, padding: 32, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', zIndex: 1001, boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h4 style={{ margin: 0, fontSize: 19, color: '#0f172a', fontWeight: 700 }}>Review Leave Request</h4>
              <button onClick={() => { setReviewReq(null); setShowRejectInput(false); setRejectReason(''); }} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
            </div>
            <h5 style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee Information</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc' }}>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Name</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.emp_name || reviewReq.employee_name}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Employee ID</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.emp_code || reviewReq.employee_code}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Designation</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.designation || '\u2014'}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Department</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.emp_dept || '\u2014'}</div></div>
            </div>
            <h5 style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave Information</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc' }}>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Leave Type</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.leave_type}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Duration</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.duration} day{reviewReq.duration > 1 ? 's' : ''}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Start Date</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(reviewReq.start_date)}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>End Date</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(reviewReq.end_date)}</div></div>
            </div>
            <h5 style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</h5>
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc', fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{reviewReq.reason || 'No reason provided.'}</div>
            {(reviewReq.status || '').toLowerCase() === 'pending' && (
              <>
                <h5 style={{ fontSize: 13, color: '#6366f1', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave Balance</h5>
                <BalanceView employeeId={reviewReq.employee_id} />
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => handleApprove(reviewReq.id)} disabled={processing} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: processing ? '#a5b4fc' : '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', minWidth: 120 }}>{processing ? 'Processing...' : 'Approve Leave'}</button>
                  <button onClick={() => setShowRejectInput(true)} disabled={processing} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: processing ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer', minWidth: 120 }}>{processing ? 'Processing...' : 'Reject Leave'}</button>
                </div>
                {showRejectInput && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: '#fef2f2' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 6, display: 'block' }}>Rejection Reason *</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} placeholder="Insufficient balance, Project deadline conflict, ..." style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #fecaca', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                    <button onClick={() => handleReject(reviewReq.id)} disabled={processing || !rejectReason.trim()} style={{ marginTop: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Confirm Reject</button>
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
