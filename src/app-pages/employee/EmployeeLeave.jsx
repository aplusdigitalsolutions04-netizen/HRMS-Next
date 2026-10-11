import React, { useState, useEffect, useRef } from 'react';
import Pagination from '../shared/Pagination';
import LeaveApplyPage from './LeaveApplyPage';

const API = '/api';
import useLiveRefresh from '@/lib/live';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const formatDT = (d) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return '\u2014'; }
};

// <input type="date"> value from a date that came back from the API (local parts, so the day never shifts)
const toInputDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '';
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};

const statusBadge = (s) => {
  const m = {
    pending: { bg: '#fffbeb', color: '#d97706', text: 'Pending' },
    approved: { bg: '#f0fdf4', color: '#16a34a', text: 'Approved' },
    rejected: { bg: '#fef2f2', color: '#dc2626', text: 'Rejected' },
    cancelled: { bg: '#f1f5f9', color: '#64748b', text: 'Cancelled' },
  };
  const c = m[(s || '').toLowerCase()] || { bg: '#f1f5f9', color: '#64748b', text: s };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {c.text}
    </span>
  );
};

const Icon = ({ name, size = 18, color = 'currentColor' }) => {
  const paths = {
    calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2 M16 2v4M8 2v4M3 10h18',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8M16 17H8M10 9H8',
    plus: 'M12 5v14M5 12h14',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    chevronDown: 'M6 9l6 6 6-6',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    barChart: 'M12 20V10M18 20V4M6 20v-4',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  };
  const d = paths[name] || paths.calendar;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d.split(/\s(?=M)/).map((seg, i) => <path key={i} d={seg} />)}
    </svg>
  );
};

export default function EmployeeLeave() {
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('all');
  const [requests, setRequests] = useState([]);
  const [reqTotal, setReqTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 });
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  useEffect(() => {
    fetch(`${API}/leave-types`, { headers: auth() }).then(r => r.json()).then(d => setLeaveTypes(d.types || [])).catch(() => {});
  }, []);
  const [form, setForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '', file: null, cc: '', bcc: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [selectedReq, setSelectedReq] = useState(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const perPageRef = useRef(10);
  const [teamRequests, setTeamRequests] = useState([]);
  const [teamActing, setTeamActing] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchTeamPending = () => {
    fetch(`${API}/leave/team/pending`, { headers: auth() })
      .then(r => r.json())
      .then(d => setTeamRequests(d.requests || []))
      .catch(() => {});
  };

  useEffect(() => { fetchTeamPending(); }, []);

  const actOnTeamRequest = async (id, action, reason) => {
    setTeamActing(id);
    try {
      const res = await fetch(`${API}/leave/${id}/${action}`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ reason: reason || '' }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Failed to ${action}`);
      fetchTeamPending();
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      alert(err.message);
    } finally {
      setTeamActing(null);
    }
  };

  const fetchData = (statusFilter, p = 1) => {
    const h = auth();
    const s = statusFilter && statusFilter !== 'all' ? statusFilter : '';
    Promise.all([
      fetch(`${API}/profile`, { headers: h }).then(r => r.json()).catch(() => null),
      fetch(`${API}/leave/my-requests?status=${s}&page=${p}&per_page=${perPageRef.current}`, { headers: h }).then(r => r.json()).catch(() => ({ requests: [], total: 0 })),
      fetch(`${API}/leave/my-balance`, { headers: h }).then(r => r.json()).catch(() => ({ balances: [] })),
      fetch(`${API}/leave/my-stats`, { headers: h }).then(r => r.json()).catch(() => ({ total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 })),
    ]).then(([prof, reqData, balData, statsData]) => {
      if (prof) setProfile(prof);
      setRequests(reqData.requests || []);
      setReqTotal(reqData.total || 0);
      setBalances(balData.balances || []);
      setStats(statsData);
      setLoading(false);
    });
  };

  useEffect(() => { setPage(1); fetchData(tab, 1); }, [tab]);
  useLiveRefresh(() => { fetchData(tab, page); fetchTeamPending(); });

  const totalPages = Math.ceil(reqTotal / perPage);

  const handleTab = (t) => { setTab(t); setPage(1); };

  const calcDuration = (s, e) => {
    if (!s || !e) return 0;
    const sd = new Date(s), ed = new Date(e);
    if (ed < sd) return 0;
    return Math.floor((ed - sd) / (86400000)) + 1;
  };

  const openNew = () => { setEditingId(null); setFormErr(''); setForm({ leave_type: leaveTypes[0] || '', start_date: '', end_date: '', reason: '', file: null, cc: '', bcc: '' }); setShowModal(true); };
  const openEdit = (r) => {
    setEditingId(r.id); setFormErr('');
    setForm({ leave_type: r.leave_type, start_date: toInputDate(r.start_date), end_date: toInputDate(r.end_date), reason: r.reason || '', file: null, cc: '', bcc: '' });
    setShowModal(true);
  };

  const handleApply = async (mail = {}) => {
    setFormErr('');
    if (!form.start_date || !form.end_date) { setFormErr('Please select start and end dates'); return; }
    if (!form.reason.trim()) { setFormErr('Please enter a reason'); return; }
    const dur = calcDuration(form.start_date, form.end_date);
    if (dur <= 0) { setFormErr('End date must be after start date'); return; }
    const bal = balances.find(b => b.leave_type === form.leave_type);
    if (!editingId && bal && dur > (bal.remaining || 0)) { setFormErr(`Insufficient ${form.leave_type} balance. Available: ${(bal.remaining || 0).toFixed(0)} days`); return; }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('leave_type', form.leave_type);
    fd.append('start_date', form.start_date);
    fd.append('end_date', form.end_date);
    fd.append('reason', form.reason);
    if (form.file) fd.append('supporting_doc', form.file);
    if (mail.mail_subject) fd.append('mail_subject', mail.mail_subject);
    if (mail.mail_message) fd.append('mail_message', mail.mail_message);
    if (mail.from_account_id) fd.append('from_account_id', mail.from_account_id);
    if (form.cc) fd.append('cc', form.cc);
    if (form.bcc) fd.append('bcc', form.bcc);
    try {
      const res = editingId
        ? await fetch(`${API}/leave/${editingId}`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ leave_type: form.leave_type, start_date: form.start_date, end_date: form.end_date, reason: form.reason, mail_message: mail.mail_message }) })
        : await fetch(`${API}/leave/apply`, { method: 'POST', headers: auth(), body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit');
      const wasEdit = editingId;
      const noMail = data.mail_sent === false;
      setEditingId(null);
      setShowModal(false);
      setForm({ leave_type: '', start_date: '', end_date: '', reason: '', file: null, cc: '', bcc: '' });
      fetchData(tab, 1);
      import('sweetalert2').then(Swal => Swal.default.fire({ icon: 'success', title: wasEdit ? 'Leave Updated!' : 'Leave Submitted!', text: noMail ? 'Your request is submitted and your manager can see it in the app. No email was sent because your email is not connected (My Mail).' : wasEdit ? 'Your changes were sent to the person who is reviewing it.' : 'Your leave request has been sent to your reporting manager.', timer: 2500, showConfirmButton: false }));
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      const res = await fetch(`${API}/leave/${id}/cancel`, { method: 'PUT', headers: auth() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Failed to cancel'); }
      fetchData(tab, page);
    } catch (err) {
      alert(err.message);
    }
  };

  const dur = calcDuration(form.start_date, form.end_date);

  if (loading) {
    return (
      <div style={{ padding: 30, borderRadius: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e8f0ff' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 20, background: '#e2e8f0', borderRadius: 8, margin: '8px 0' }} />
        ))}
      </div>
    );
  }

  if (showModal) {
    return (
      <LeaveApplyPage
        form={form} setForm={setForm} editing={!!editingId} onBack={() => setShowModal(false)} onSubmit={handleApply}
        leaveTypes={leaveTypes} submitting={submitting} formErr={formErr} dur={dur} profile={profile} balance={balances.find(b => b.leave_type === form.leave_type)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 0', minWidth: 300 }}>

        {/* Team Approvals (visible only if this employee is someone's reporting manager) */}
        {teamRequests.length > 0 && (
          <div className="el-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16, border: '1.5px solid #fde68a' }}>
            <div style={{ padding: '14px 15px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
              <h3 style={{ margin: 0, fontSize: 15, color: '#92400e' }}>Team Leave Requests Awaiting Your Approval</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#b45309' }}>These are pending on you as the reporting manager before HR reviews them.</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#', 'Employee', 'Leave Type', 'Duration', 'Date Range', 'Reason', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamRequests.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap' }}>{r.emp_name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({r.emp_code})</span></td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{r.leave_type}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{r.duration} day{r.duration > 1 ? 's' : ''}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{formatDT(r.start_date)} - {formatDT(r.end_date)}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {rejectingId === r.id ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason" style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #e2e8f0', width: 110 }} />
                            <button disabled={teamActing === r.id} onClick={() => actOnTeamRequest(r.id, 'reject', rejectReason)} style={{ border: 'none', background: '#fef2f2', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>Confirm</button>
                            <button onClick={() => { setRejectingId(null); setRejectReason(''); }} style={{ border: 'none', background: '#f1f5f9', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#475569' }}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button disabled={teamActing === r.id} onClick={() => actOnTeamRequest(r.id, 'approve')} style={{ border: 'none', background: '#f0fdf4', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Approve</button>
                            <button disabled={teamActing === r.id} onClick={() => setRejectingId(r.id)} style={{ border: 'none', background: '#fef2f2', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="el-card" style={{ padding: '15px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="3" />
                  <line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="2" y1="10" x2="22" y2="10" />
                  <path d="M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01M17 18h.01" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Leave Requests</h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>Apply for leave and track the status of your requests.</p>
              </div>
            </div>
            <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Icon name="plus" size={16} color="#fff" /> Apply Leave
            </button>
            <style>{`.el-card{border-radius:16px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid #e8f0ff}`}</style>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Total Requests', value: stats.total, color: '#2563eb', bg: '#eff6ff' },
            { label: 'Pending', value: stats.pending, color: '#d97706', bg: '#fffbeb' },
            { label: 'Approved', value: stats.approved, color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Rejected', value: stats.rejected, color: '#dc2626', bg: '#fef2f2' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 16, padding: '16px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 0, flexWrap: 'wrap' }}>
          {['all', 'pending', 'approved', 'rejected', 'cancelled'].map(t => (
            <button key={t} onClick={() => handleTab(t)} style={{ padding: '8px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: tab === t ? '#2563eb' : '#94a3b8', cursor: 'pointer', borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent', textTransform: 'capitalize' }}>
              {t === 'all' ? 'All Requests' : t}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="el-card" style={{ padding: 0, overflow: 'hidden' }}>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 45, color: '#94a3b8' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No leave requests found</div>
              <div style={{ fontSize: 13 }}>Your submitted leave requests will appear here.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#', 'Leave Type', 'Duration', 'Date Range', 'Reason', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{(page - 1) * perPage + idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap' }}>{r.leave_type}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{r.duration} day{r.duration > 1 ? 's' : ''}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{formatDT(r.start_date)} - {formatDT(r.end_date)}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                      <td style={{ padding: '10px 14px' }}>{statusBadge(r.status)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setSelectedReq(r)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#475569' }} title="View Details">View</button>
                          {Number(r.can_edit) === 1 && (
                            <button onClick={() => openEdit(r)} style={{ border: 'none', background: '#eff6ff', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#2563eb' }} title="Change this request">Edit</button>
                          )}
                          {(r.status || '').toLowerCase() === 'pending' && (
                            <button onClick={() => handleCancel(r.id)} style={{ border: 'none', background: '#fef2f2', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#dc2626' }} title="Cancel">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination onPageSizeChange={n => { perPageRef.current = n; setPerPage(n); setPage(1); fetchData(tab, 1); }} page={page} totalItems={reqTotal} pageSize={perPage} itemLabel="requests" onPageChange={p => { setPage(p); fetchData(tab, p); }} />
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
        {/* Leave Balance Card */}
        <div className="el-card" style={{ padding: '15px' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
            </svg>
            Leave Balance
          </h4>
          {balances.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 15 }}>No leave balance data</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {balances.map((b, idx) => {
                const used = b.used_days || 0;
                const total = b.total_days || 0;
                const remaining = Math.max(0, b.remaining);
                const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
                const fmtNum = (n) => Number.isInteger(n) ? n.toString() : n.toFixed(1);
                const barColor = remaining <= 2 ? '#ef4444' : remaining <= 5 ? '#f59e0b' : '#2563eb';
                return (
                  <div key={b.id ?? idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{b.leave_type}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: remaining <= 2 ? '#ef4444' : '#0f172a' }}>{fmtNum(remaining)}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'flex-end', marginBottom: 2 }}>
                        {fmtNum(used)} used of {fmtNum(total)}
                      </span>
                    </div>
                    <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 6, transition: 'width 0.4s ease' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, textAlign: 'right' }}>
                      {fmtNum(remaining)} day{remaining !== 1 ? 's' : ''} remaining
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* View Detail Modal */}
      {selectedReq && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} onClick={() => setSelectedReq(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 16, padding: 32, width: '96%', maxWidth: 820, zIndex: 1001, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>Leave Details</h3>
              <button onClick={() => setSelectedReq(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 13 }}>Leave Type</span><span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{selectedReq.leave_type}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 13 }}>Duration</span><span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{selectedReq.duration} day{selectedReq.duration > 1 ? 's' : ''}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 13 }}>Date Range</span><span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(selectedReq.start_date)} - {formatDT(selectedReq.end_date)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 13 }}>Reason</span><span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{selectedReq.reason}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 13 }}>Status</span><span>{statusBadge(selectedReq.status)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 13 }}>Applied On</span><span style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(selectedReq.applied_on)}</span></div>
              {selectedReq.rejection_reason && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b', fontSize: 13 }}>Rejection Reason</span><span style={{ color: '#dc2626', fontSize: 13, fontWeight: 500 }}>{selectedReq.rejection_reason}</span></div>
              )}
              {selectedReq.supporting_doc && (
                <div style={{ padding: '8px 0' }}>
                  <a href="#" onClick={async (e) => { e.preventDefault(); try { const res = await fetch(`${API}/leave/${selectedReq.id}/document`, { headers: auth() }); if (!res.ok) throw new Error((await res.json()).detail || 'Could not open the document'); window.open(URL.createObjectURL(await res.blob()), '_blank'); } catch (err) { alert(err.message); } }} style={{ color: '#2563eb', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>View Supporting Document &darr;</a>
                </div>
              )}
            </div>
            {/* Timeline */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0f172a' }}>Status Timeline</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
                {[
                  { label: 'Submitted', done: true },
                  { label: 'Under Review', done: ['pending','approved','rejected'].includes((selectedReq.status || '').toLowerCase()), active: (selectedReq.status || '').toLowerCase() === 'pending' },
                  { label: (selectedReq.status || '').toLowerCase() === 'approved' ? 'Approved' : (selectedReq.status || '').toLowerCase() === 'rejected' ? 'Rejected' : 'Approved / Rejected', done: ['approved','rejected'].includes((selectedReq.status || '').toLowerCase()), active: false, isRejected: (selectedReq.status || '').toLowerCase() === 'rejected' },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < 2 ? 20 : 0, position: 'relative' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: step.done ? (step.isRejected ? '#dc2626' : '#2563eb') : '#e2e8f0', flexShrink: 0, marginTop: 3, boxShadow: step.active ? '0 0 0 4px #eff6ff' : 'none' }} />
                    {i < 2 && <div style={{ position: 'absolute', left: 4, top: 13, width: 2, height: 28, background: step.done ? '#2563eb' : '#e2e8f0' }} />}
                    <div style={{ fontSize: 13, color: step.done ? '#0f172a' : '#94a3b8', fontWeight: step.active ? 600 : step.done ? 500 : 400 }}>{step.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
