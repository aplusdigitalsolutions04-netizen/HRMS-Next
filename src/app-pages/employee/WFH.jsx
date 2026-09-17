import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';

const API = '/api';
const PAGE_SIZE = 10;
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const formatDT = (d) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return '\u2014'; }
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
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {c.text}
    </span>
  );
};

export default function WFH() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [teamRequests, setTeamRequests] = useState([]);
  const [teamActing, setTeamActing] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [requests.length]);
  const pageItems = paginate(requests, page, pageSize);

  const fetchTeamPending = () => {
    fetch(`${API}/wfh/team/pending`, { headers: auth() })
      .then(r => r.json())
      .then(d => setTeamRequests(d || []))
      .catch(() => {});
  };

  const fetchData = () => {
    setLoading(true);
    fetch(`${API}/wfh/my-requests`, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setRequests(d || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeamPending();
    fetchData();
  }, []);

  const actOnTeamRequest = async (id, action, reason) => {
    setTeamActing(id);
    try {
      const res = await fetch(`${API}/wfh/${id}/${action}`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ reason: reason || '' }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || `Failed to ${action}`);
      fetchTeamPending();
      setRejectingId(null);
      setRejectReason('');
      Swal.fire({ icon: 'success', title: 'Success', text: `WFH request ${action}ed`, timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setTeamActing(null);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    setFormErr('');
    if (!form.start_date || !form.end_date) { setFormErr('Please select start and end dates'); return; }
    if (!form.reason.trim()) { setFormErr('Please enter a reason'); return; }
    
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/wfh/apply`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Failed to submit');
      setShowModal(false);
      setForm({ start_date: '', end_date: '', reason: '' });
      fetchData();
      Swal.fire({ icon: 'success', title: 'WFH Applied!', text: 'Your request has been submitted to your manager.', timer: 2500, showConfirmButton: false });
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, borderRadius: 16, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        Loading WFH requests...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 0', minWidth: 300 }}>
        {/* Team Approvals */}
        {teamRequests.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 16, border: '1.5px solid #fde68a', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '14px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
              <h3 style={{ margin: 0, fontSize: 15, color: '#92400e' }}>Team WFH Requests Awaiting Your Approval</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#b45309' }}>These are pending on you as the reporting manager before HR reviews them.</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600, width: 40 }}>#</th>
                    <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>Employee</th>
                    <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>Date Range</th>
                    <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>Reason</th>
                    <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRequests.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0f172a' }}>{r.full_name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({r.emp_code})</span></td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{formatDT(r.start_date)} - {formatDT(r.end_date)}</td>
                      <td style={{ padding: '10px 14px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</td>
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
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Work From Home</h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>Apply for WFH and track the status of your requests.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}
            >
              Apply for WFH
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>My WFH Requests</h4>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ padding: '12px 20px', color: '#64748b', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0', width: 40 }}>#</th>
                  <th style={{ padding: '12px 20px', color: '#64748b', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Date Range</th>
                  <th style={{ padding: '12px 20px', color: '#64748b', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Reason</th>
                  <th style={{ padding: '12px 20px', color: '#64748b', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Applied On</th>
                  <th style={{ padding: '12px 20px', color: '#64748b', fontSize: 12, fontWeight: 600, borderBottom: '1px solid #e2e8f0' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan="5" style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No WFH requests found.</td></tr>
                ) : pageItems.map((req, idx) => (
                  <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#94a3b8' }}>{(page - 1) * pageSize + idx + 1}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#0f172a', fontWeight: 500 }}>
                      {formatDT(req.start_date)} - {formatDT(req.end_date)}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#475569', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.reason}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748b' }}>
                      {formatDT(req.applied_on)}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {statusBadge(req.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalItems={requests.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="requests" />
          </div>
        </div>

      </div>

      {/* Apply Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 450, borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Apply for WFH</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: 24 }}>
              {formErr && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, border: '1px solid #fecaca' }}>{formErr}</div>}
              
              <form onSubmit={handleApply}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Start Date</label>
                    <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>End Date</label>
                    <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                </div>
                
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Reason</label>
                  <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Why do you need WFH?" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, minHeight: 80, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} required />
                </div>
                
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
