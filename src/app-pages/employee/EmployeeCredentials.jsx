import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const PAGE_SIZE = 10;

const statusBadge = (status) => {
  const s = (status || '').toUpperCase();
  const map = {
    DRAFT: { bg: '#fef3c7', color: '#b45309', label: 'Not Sent' },
    SENT: { bg: '#dcfce7', color: '#15803d', label: 'Sent' },
  };
  const c = map[s] || { bg: '#f1f5f9', color: '#64748b', label: status };
  return <span className="badge-premium" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

const EmployeeCredentials = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [revealedId, setRevealedId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [resendingId, setResendingId] = useState(null);

  const fetchRows = () => {
    setLoading(true);
    fetch(`${API}/employee-credentials`, { headers: auth() })
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = filter
    ? rows.filter(r =>
        (r.employee_name || '').toLowerCase().includes(filter.toLowerCase()) ||
        (r.emp_code || '').toLowerCase().includes(filter.toLowerCase()) ||
        (r.email || '').toLowerCase().includes(filter.toLowerCase())
      )
    : rows;

  useEffect(() => { setPage(1); }, [filter, rows.length]);
  const pageItems = paginate(filtered, page, pageSize);

  const resend = (row) => {
    Swal.fire({
      title: 'Resend Credentials?',
      text: `Resend login details to ${row.email}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Resend',
      confirmButtonColor: '#4338ca',
    }).then(res => {
      if (!res.isConfirmed) return;
      setResendingId(row.id);
      fetch(`${API}/email/drafts/${row.draft_id}/send`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' } })
        .then(async r => ({ ok: r.ok, data: await r.json() }))
        .then(({ ok, data }) => {
          Swal.fire({ icon: ok ? 'success' : 'error', title: ok ? 'Sent!' : 'Failed', text: ok ? '' : (data.detail || 'Could not resend.'), timer: ok ? 1500 : undefined, showConfirmButton: !ok });
          if (ok) fetchRows();
        })
        .catch(() => Swal.fire({ icon: 'error', title: 'Error', text: 'Could not resend.' }))
        .finally(() => setResendingId(null));
    });
  };

  return (
    <div>
      <h2 className="page-title">🔐 Employee Credentials {!loading && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>({rows.length})</span>}</h2>
      <p className="page-subtitle">Login details sent to newly approved employees</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <input
          className="premium-input"
          style={{ maxWidth: 360 }}
          placeholder="Search name, code, or email..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button className="btn-premium" onClick={fetchRows}>🔄 Refresh</button>
      </div>

      {loading ? (
        <div className="notif-loading" />
      ) : filtered.length === 0 ? (
        <div className="notif-empty">
          <span style={{ fontSize: '2rem' }}>🔐</span>
          <p>{rows.length === 0 ? 'No employee credentials sent yet. They appear here after approving a pending employee with a template.' : 'No records match your search.'}</p>
        </div>
      ) : (
        <div className="premium-table-wrapper">
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Employee</th>
                <th>Emp Code</th>
                <th>Email</th>
                <th>Password</th>
                <th>Status</th>
                <th>Sent On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r, i) => (
                <tr key={r.id}>
                  <td style={{ color: '#94a3b8', fontSize: '.85rem' }}>{(page - 1) * pageSize + i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.employee_name || '—'}</td>
                  <td>{r.emp_code || '—'}</td>
                  <td>{r.email}</td>
                  <td style={{ fontFamily: 'monospace' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {revealedId === r.id ? r.password : '•'.repeat(Math.max(6, (r.password || '').length))}
                      <button
                        onClick={() => setRevealedId(revealedId === r.id ? null : r.id)}
                        title={revealedId === r.id ? 'Hide' : 'Show'}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6366f1', fontSize: 13 }}
                      >
                        {revealedId === r.id ? '🙈' : '👁️'}
                      </button>
                    </span>
                  </td>
                  <td>{statusBadge(r.status)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{r.status === 'sent' ? formatDate(r.sent_at) : '—'}</td>
                  <td>
                    <button
                      className="tbl-action tbl-view"
                      onClick={() => resend(r)}
                      disabled={resendingId === r.id || !r.draft_id}
                    >
                      {resendingId === r.id ? 'Sending...' : (r.status === 'sent' ? '📤 Resend' : '📤 Send')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="records" />
        </div>
      )}
    </div>
  );
};

export default EmployeeCredentials;
