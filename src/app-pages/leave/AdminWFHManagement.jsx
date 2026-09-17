import React, { useState, useEffect } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const formatDT = (d) => {
  if (!d) return '\u2014';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return '\u2014'; }
};

const statusBadge = (s) => {
  const m = { pending: { bg: '#fffbeb', color: '#d97706', text: 'Pending' }, approved: { bg: '#f0fdf4', color: '#16a34a', text: 'Approved' }, rejected: { bg: '#fef2f2', color: '#dc2626', text: 'Rejected' }, cancelled: { bg: '#f1f5f9', color: '#64748b', text: 'Cancelled' } };
  const c = m[(s || '').toLowerCase()] || { bg: '#f1f5f9', color: '#64748b', text: s };
  return <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color }}>{c.text}</span>;
};

export default function AdminWFHManagement() {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewReq, setReviewReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [processing, setProcessing] = useState(false);
  const perPage = 15;

  const fetchRequests = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: perPage });
    fetch(`${API}/wfh/admin/requests?${params}`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setRequests(d.data || []); setTotal(d.total || 0); setPage(d.page || 1); setLoading(false); })
      .catch(() => { setRequests([]); setTotal(0); setLoading(false); });
  };

  useEffect(() => { fetchRequests(1); }, []);

  const handleApprove = async (id) => {
    setProcessing(true);
    try { 
      const res = await fetch(`${API}/wfh/${id}/approve`, { method: 'PUT', headers: auth() }); 
      const d = await res.json(); 
      if (!res.ok) throw new Error(d.detail || d.message || 'Failed to approve'); 
      setReviewReq(null); 
      fetchRequests(page); 
    } catch (err) { 
      alert(err.message); 
    } finally { 
      setProcessing(false); 
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) { alert('Please provide a rejection reason'); return; }
    setProcessing(true);
    try { 
      const res = await fetch(`${API}/wfh/${id}/reject`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: rejectReason }) }); 
      const d = await res.json(); 
      if (!res.ok) throw new Error(d.detail || d.message || 'Failed to reject'); 
      setReviewReq(null); 
      setShowRejectInput(false); 
      setRejectReason(''); 
      fetchRequests(page); 
    } catch (err) { 
      alert(err.message); 
    } finally { 
      setProcessing(false); 
    }
  };

  const s = {
    container: { padding: '0 28px', maxWidth: 1400, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff' },
    btnPrimary: { padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#34d399)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnOutline: { padding: '8px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  };

  return (
    <div style={s.container}>
      <style>{`.alm-tw{overflow-x:auto}.alm-t{width:100%;border-collapse:collapse}.alm-t tbody tr:hover{background:#f8fafc}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#10b981,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <div><h4 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>WFH Management</h4><p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>Manage employee work from home requests and HR approvals.</p></div>
        </div>
      </div>

      <div style={s.card}>
        {loading ? (
          <div style={{ padding: 50 }}>{[1,2,3,4].map(i => <div key={i} style={{ height: 24, background: '#f1f5f9', borderRadius: 8, margin: '12px 0' }} />)}</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>No WFH requests found</div>
          </div>
        ) : (
          <>
            <div className="alm-tw">
              <table className="alm-t">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['#','Employee','Date Range','Reason','Applied','Status','Actions'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{(page - 1) * perPage + idx + 1}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>
                        <div style={{ fontWeight: 500, color: '#0f172a', fontSize: 14 }}>{r.full_name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.emp_code}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', color: '#475569' }}>{formatDT(r.start_date)} - {formatDT(r.end_date)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', color: '#475569' }}>{formatDT(r.applied_on)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{statusBadge(r.status)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {(r.status || '').toLowerCase() === 'pending' ? (
                          <button onClick={() => setReviewReq(r)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Review</button>
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
                  <button key={p} onClick={() => { setPage(p); fetchRequests(p); }} style={{ padding: '6px 12px', borderRadius: 6, border: p === page ? '2px solid #10b981' : '1px solid #e2e8f0', background: p === page ? '#ecfdf5' : '#fff', color: p === page ? '#10b981' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{p}</button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {reviewReq && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000 }} onClick={() => { setReviewReq(null); setShowRejectInput(false); setRejectReason(''); }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#fff', borderRadius: 20, padding: 32, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', zIndex: 1001, boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h4 style={{ margin: 0, fontSize: 19, color: '#0f172a', fontWeight: 700 }}>Review WFH Request</h4>
              <button onClick={() => { setReviewReq(null); setShowRejectInput(false); setRejectReason(''); }} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
            </div>
            <h5 style={{ fontSize: 13, color: '#10b981', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee Information</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc' }}>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Name</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.full_name}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Employee ID</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{reviewReq.emp_code}</div></div>
            </div>
            <h5 style={{ fontSize: 13, color: '#10b981', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Request Details</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc' }}>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>Start Date</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(reviewReq.start_date)}</div></div>
              <div><span style={{ color: '#64748b', fontSize: 12 }}>End Date</span><div style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{formatDT(reviewReq.end_date)}</div></div>
            </div>
            <h5 style={{ fontSize: 13, color: '#10b981', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</h5>
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc', fontSize: 13, color: '#0f172a', lineHeight: 1.5 }}>{reviewReq.reason || 'No reason provided.'}</div>
            
            {(reviewReq.status || '').toLowerCase() === 'pending' && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!showRejectInput ? (
                  <>
                    <button disabled={processing} onClick={() => handleApprove(reviewReq.id)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 1 }}>{processing ? 'Processing...' : 'Approve Request'}</button>
                    <button disabled={processing} onClick={() => setShowRejectInput(true)} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 1 }}>Reject Request</button>
                  </>
                ) : (
                  <div style={{ width: '100%' }}>
                    <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection (required)..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14, minHeight: 80, outline: 'none', marginBottom: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button disabled={processing} onClick={() => handleReject(reviewReq.id)} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 1 }}>{processing ? 'Processing...' : 'Confirm Reject'}</button>
                      <button disabled={processing} onClick={() => setShowRejectInput(false)} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer', flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
