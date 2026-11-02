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
  const [shown, setShown] = useState({});
  // the password is fetched only when the eye is pressed (each look is recorded in the Audit Log)
  const toggleReveal = async (r) => {
    if (revealedId === r.id) { setRevealedId(null); return; }
    if (shown[r.id] === undefined) {
      try {
        const res = await fetch(`${API}/employee-credentials?reveal=${r.id}`, { headers: auth() });
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || 'Could not show the password');
        setShown(s => ({ ...s, [r.id]: d.password || '' }));
      } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); return; }
    }
    setRevealedId(r.id);
  };
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
      confirmButtonColor: '#1e40af',
    }).then(res => {
      if (!res.isConfirmed) return;
      setResendingId(row.id);
      fetch(`${API}/employee-credentials/${row.id}/resend`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' } })
        .then(async r => ({ ok: r.ok, data: await r.json() }))
        .then(({ ok, data }) => {
          Swal.fire({ icon: ok ? 'success' : 'error', title: ok ? 'Sent!' : 'Failed', text: ok ? (data.message || '') : (data.detail || 'Could not resend.'), timer: ok && !data.own_password ? 1500 : undefined, showConfirmButton: !ok || !!data.own_password });
          if (ok) fetchRows();
        })
        .catch(() => Swal.fire({ icon: 'error', title: 'Error', text: 'Could not resend.' }))
        .finally(() => setResendingId(null));
    });
  };

  // HR/Admin sets a new password for the employee of this row; they must choose their own at the next login
  const resetPassword = (row) => {
    Swal.fire({
      title: `Change password of ${row.employee_name}`,
      html: `<div style="text-align:left;font-size:.88rem;color:#475569">
        <label style="display:block;font-weight:600;margin-bottom:4px">New password</label>
        <input id="rp-pass" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box" placeholder="Leave empty to generate one" autocomplete="off">
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px"><input id="rp-mail" type="checkbox" checked> Email the new password to ${row.email}</label>
        <div style="margin-top:10px;color:#64748b">The employee must set their own password at the next login. Their current password stops working now.</div>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'Change password',
      confirmButtonColor: '#1e40af',
      focusConfirm: false,
      preConfirm: () => {
        const password = document.getElementById('rp-pass').value.trim();
        if (password && password.length < 8) { Swal.showValidationMessage('The password must be at least 8 characters'); return false; }
        return { password, send_email: document.getElementById('rp-mail').checked };
      },
    }).then(result => {
      if (!result.isConfirmed) return;
      fetch(`${API}/employee/${row.employee_id}/set-password`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(result.value) })
        .then(async r => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.detail || 'Could not change the password');
          const shown = String(data.password).replace(/&/g, '&amp;').replace(/</g, '&lt;');
          fetchRows();
          Swal.fire({
            icon: data.email_sent === false && result.value.send_email ? 'warning' : 'success',
            title: 'Password changed',
            html: `<div style="font-size:.9rem;color:#475569">${data.message}<br/><br/>New password: <b style="font-family:monospace;user-select:all">${shown}</b></div>`,
          });
        })
        .catch(err => Swal.fire({ icon: 'error', title: 'Not changed', text: err.message }));
    });
  };

  return (
    <div>
      <h2 className="page-title">Employee Credentials {!loading && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>({rows.length})</span>}</h2>
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
          <span style={{ fontSize: '1.6rem' }}>🔐</span>
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
                  <td style={{ whiteSpace: 'nowrap' }}>{r.emp_code || '—'}</td>
                  <td>{r.email}</td>
                  <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {!r.has_password && r.password !== '(own password)' ? <span style={{ fontFamily: 'inherit', fontSize: '.78rem', color: '#94a3b8' }} title="This password was set before passwords were kept here. It shows again after the next password change.">Not available</span> : r.password === '(own password)' ? <span style={{ fontFamily: 'inherit', fontSize: '.78rem', color: '#94a3b8' }}>Own password</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {revealedId === r.id ? shown[r.id] : '•'.repeat(10)}
                      <button
                        onClick={() => toggleReveal(r)}
                        title={revealedId === r.id ? 'Hide' : 'Show'}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#2563eb', fontSize: 13 }}
                      >
                        {revealedId === r.id ? '🙈' : '👁️'}
                      </button>
                    </span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{statusBadge(r.status)}</td>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{r.status === 'sent' ? formatDate(r.sent_at) : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="tbl-action tbl-view"
                      onClick={() => resend(r)}
                      disabled={resendingId === r.id}
                    >
                      {resendingId === r.id ? 'Sending...' : (r.status === 'sent' ? '📤 Resend' : '📤 Send')}
                    </button>
                    <button
                      className="tbl-action tbl-view"
                      style={{ marginLeft: 6, whiteSpace: 'nowrap' }}
                      onClick={() => resetPassword(r)}
                      title="Set a new password for this employee"
                    >
                      🔒 Password
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
