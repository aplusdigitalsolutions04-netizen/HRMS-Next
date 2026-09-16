import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};

const avatarColors = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#a78bfa,#c084fc)',
  'linear-gradient(135deg,#818cf8,#6366f1)',
  'linear-gradient(135deg,#c084fc,#e879f9)',
  'linear-gradient(135deg,#7c3aed,#6d28d9)',
];

const PendingEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approvingId, setApprovingId] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    fetch(`${API}/employee/pending`, { headers: auth() })
      .then(r => {
        if (r.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
        return r.json();
      })
      .then(data => { setEmployees(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setEmployees([]); setLoading(false); });

    fetch(`${API}/templates`, { headers: auth() })
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      (e.full_name || '').toLowerCase().includes(q) ||
      (e.email_id || '').toLowerCase().includes(q) ||
      (e.mobile_no || '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [search]);

  const approveEmployee = (id) => {
    let optionsHtml = '<option value="">-- No Email Draft (Only Approve) --</option>';
    templates.forEach(t => {
      optionsHtml += `<option value="${t.id}">${t.name}</option>`;
    });

    Swal.fire({
      title: 'Approve Employee',
      html: `
        <p style="margin-bottom:16px;color:#475569">Select an email template to draft for this employee:</p>
        <select id="swal-template-select" class="swal2-input" style="width:100%;box-sizing:border-box">
          ${optionsHtml}
        </select>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4338ca',
      preConfirm: () => {
        return document.getElementById('swal-template-select').value;
      }
    }).then(result => {
      if (!result.isConfirmed) return;
      const templateId = result.value;

      setApprovingId(id);
      fetch(`${API}/employee/approve/${id}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ template_id: templateId || null })
      })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => {
        if (data.message) {
          setEmployees(prev => prev.filter(e => e.id !== id));
          let msg = 'Employee approved successfully.';
          if (templateId) {
            msg += ' A welcome email draft has been created. Check Draft Emails to review and send.';
          } else {
            msg += ` No email draft created.`;
          }
          Swal.fire({ icon: 'success', title: 'Approved!', text: msg, timer: 5000, showConfirmButton: true });
        }
        setApprovingId(null);
      })
      .catch(() => { Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to approve employee' }); setApprovingId(null); });
    });
  };

  const sendBackEmployee = (id) => {
    Swal.fire({
      title: 'Send Back for Correction',
      input: 'textarea',
      inputLabel: 'Tell the employee what needs to be fixed - they\'ll see this when they log back in.',
      inputPlaceholder: 'e.g. Please re-upload a clearer photo of your PAN card.',
      showCancelButton: true,
      confirmButtonText: 'Send Back',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) => !value.trim() && 'Please describe what needs to be corrected',
    }).then(result => {
      if (!result.isConfirmed) return;
      fetch(`${API}/employee/send-back/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ remarks: result.value }),
      })
        .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
        .then(() => {
          setEmployees(prev => prev.filter(e => e.id !== id));
          Swal.fire({ icon: 'success', title: 'Sent back', text: 'The employee can log in and see your remarks.', timer: 3000, showConfirmButton: false });
        })
        .catch(() => Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to send back' }));
    });
  };

  return (
    <>
      <style>{`
        .pe-page { animation:peFade .35s ease both; }
        @keyframes peFade { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes peSlideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes peShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pePulse { 0%,100%{opacity:1} 50%{opacity:.5} }

        .pe-bg-lavender { background: linear-gradient(135deg, #f5f4ff 0%, #efeafe 50%, #f8f7ff 100%); }

        .pe-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
        .pe-hdr-l { display:flex; align-items:center; gap:14px; }
        .pe-hdr-icon { width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; box-shadow:0 4px 12px rgba(99,102,241,.3); }
        .pe-hdr-txt h1 { margin:0; font-family:'Outfit',sans-serif; font-weight:800; font-size:1.45rem; color:#0f172a; letter-spacing:-0.3px; }
        .pe-hdr-txt p { margin:2px 0 0; font-size:.82rem; color:#6b7280; }

        .pe-back-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; background:#fff; color:#6b7280; border:1.5px solid #e5e7eb; border-radius:10px; font-weight:600; font-size:.82rem; text-decoration:none; transition:all .2s; cursor:pointer; }
        .pe-back-btn:hover { border-color:#6366f1; color:#6366f1; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.06); }

        .pe-stat-card { background:#fff; border-radius:14px; padding:16px 20px; border:1px solid #efeafe; margin-bottom:16px; display:flex; align-items:center; gap:16px; box-shadow:0 2px 8px rgba(99,102,241,.06); transition:all .2s; }
        .pe-stat-card:hover { border-color:#ddd6fe; box-shadow:0 4px 16px rgba(99,102,241,.1); }
        .pe-stat-icon { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#eef2ff,#f5f4ff); display:flex; align-items:center; justify-content:center; color:#6366f1; flex-shrink:0; }
        .pe-stat-info { flex:1; }
        .pe-stat-label { font-size:.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; }
        .pe-stat-count { font-family:'Outfit',sans-serif; font-weight:700; font-size:1.8rem; color:#0f172a; line-height:1.1; }
        .pe-stat-sub { font-size:.75rem; color:#6b7280; margin-top:2px; }

        .pe-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
        .pe-search { flex:1; min-width:200px; position:relative; }
        .pe-search input { width:100%; padding:9px 14px 9px 38px; border:1.5px solid #e5e7eb; border-radius:10px; font-size:.82rem; outline:none; background:#fff; color:#1f2937; transition:all .2s; }
        .pe-search input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
        .pe-search .pe-si { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9ca3af; pointer-events:none; }

        .pe-table-wrap { background:#fff; border-radius:14px; border:1px solid #efeafe; overflow:hidden; box-shadow:0 2px 8px rgba(99,102,241,.04); }
        .pe-table { width:100%; border-collapse:collapse; }
        .pe-table thead { position:sticky; top:0; z-index:2; }
        .pe-table th { padding:12px 16px; font-size:.72rem; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; text-align:left; background:#f5f4ff; border-bottom:1.5px solid #efeafe; }
        .pe-table td { padding:12px 16px; font-size:.82rem; color:#1f2937; border-bottom:1px solid #f3f4f6; vertical-align:middle; }
        .pe-table tr:last-child td { border-bottom:none; }
        .pe-table tbody tr { transition:all .15s; cursor:pointer; }
        .pe-table tbody tr:hover { background:#faf9ff; box-shadow:0 2px 8px rgba(99,102,241,.04); }
        .pe-table tbody tr:nth-child(even) { background:#fcfcff; }
        .pe-table tbody tr:nth-child(even):hover { background:#faf9ff; }

        .pe-avatar { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.8rem; color:#fff; flex-shrink:0; }
        .pe-name-cell { display:flex; align-items:center; gap:12px; }
        .pe-name-cell .pe-name { font-weight:600; color:#1f2937; font-size:.85rem; }

        .pe-email { color:#6b7280; font-size:.78rem; }
        .pe-mobile { color:#6b7280; font-size:.82rem; font-weight:500; }

        .pe-actions { display:flex; gap:5px; flex-wrap:nowrap; }
        .pe-btn-view { display:inline-flex; align-items:center; gap:4px; padding:5px 10px; background:#fff; color:#6366f1; border:1.5px solid #ddd6fe; border-radius:7px; font-weight:600; font-size:.7rem; text-decoration:none; transition:all .2s; white-space:nowrap; }
        .pe-btn-view:hover { background:#f5f4ff; border-color:#6366f1; transform:translateY(-1px); }
        .pe-btn-approve { display:inline-flex; align-items:center; gap:4px; padding:5px 11px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:7px; font-weight:600; font-size:.7rem; cursor:pointer; transition:all .2s; white-space:nowrap; position:relative; overflow:hidden; }
        .pe-btn-approve:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 4px 14px rgba(99,102,241,.35); }
        .pe-btn-approve:disabled { opacity:.7; cursor:default; }

        .pe-pagination { display:flex; align-items:center; justify-content:flex-end; gap:6px; padding:12px 16px; border-top:1px solid #f3f4f6; }
        .pe-page-btn { display:inline-flex; align-items:center; justify-content:center; min-width:34px; height:34px; border-radius:9px; border:1.5px solid #e5e7eb; background:#fff; color:#6b7280; font-size:.78rem; font-weight:600; cursor:pointer; transition:all .15s; padding:0 10px; }
        .pe-page-btn:hover:not(:disabled):not(.active) { border-color:#6366f1; color:#6366f1; }
        .pe-page-btn.active { background:#6366f1; border-color:#6366f1; color:#fff; }
        .pe-page-btn:disabled { opacity:.4; cursor:default; }
        .pe-page-info { font-size:.78rem; color:#9ca3af; margin-right:12px; }

        .pe-empty { text-align:center; padding:56px 20px; }
        .pe-empty svg { width:64px; height:64px; margin-bottom:14px; opacity:.3; }
        .pe-empty h3 { font-size:1.05rem; font-weight:600; color:#6b7280; margin:0 0 4px; }
        .pe-empty p { font-size:.82rem; color:#9ca3af; margin:0 0 16px; }
        .pe-empty-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; background:#f5f4ff; color:#6366f1; border:1.5px solid #ddd6fe; border-radius:9px; font-weight:600; font-size:.8rem; cursor:pointer; transition:all .2s; }
        .pe-empty-btn:hover { background:#eef2ff; border-color:#6366f1; }

        .pe-skeleton { display:flex; flex-direction:column; gap:8px; padding:12px 16px; }
        .pe-sk-row { display:flex; align-items:center; gap:12px; }
        .pe-sk-avatar { width:38px; height:38px; border-radius:50%; background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:peShimmer 1.2s infinite; }
        .pe-sk-line { height:14px; border-radius:6px; background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:peShimmer 1.2s infinite; }
      `}</style>

      <div className="pe-page pe-bg-lavender" style={{padding:'4px 0'}}>
        <div className="pe-hdr">
          <div className="pe-hdr-l">
            <div className="pe-hdr-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="pe-hdr-txt">
              <h1>Pending Approvals</h1>
              <p>Review and approve user registrations</p>
            </div>
          </div>
          <Link to="/" className="pe-back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="pe-stat-card">
          <div className="pe-stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              <line x1="16" y1="11" x2="22" y2="11"/>
            </svg>
          </div>
          <div className="pe-stat-info">
            <div className="pe-stat-label">Total Pending Approvals</div>
            <div className="pe-stat-count">{loading ? '\u2014' : employees.length}</div>
            <div className="pe-stat-sub">{employees.length === 0 ? 'No pending registrations' : `${employees.length} employee${employees.length !== 1 ? 's' : ''} awaiting review`}</div>
          </div>
        </div>

        {!loading && employees.length > 0 && (
          <div className="pe-toolbar">
            <div className="pe-search">
              <svg className="pe-si" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="text" placeholder="Search by name, email or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        )}

        <div className="pe-table-wrap">
          <table className="pe-table">
            <thead>
              <tr>
                <th style={{width:40, color:'#94a3b8', fontWeight:600}}>#</th>
                <th style={{width:'32%'}}>Name</th>
                <th style={{width:'25%'}}>Email</th>
                <th style={{width:'18%'}}>Mobile</th>
                <th style={{width:'25%', textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5">
                    <div className="pe-skeleton">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="pe-sk-row">
                          <div className="pe-sk-avatar" />
                          <div className="pe-sk-line" style={{width:`${40 + i * 8}%`}} />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="pe-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        <line x1="16" y1="11" x2="22" y2="11"/>
                      </svg>
                      <h3>{search ? 'No matching approvals found' : 'No pending approvals found'}</h3>
                      <p>{search ? 'Try adjusting your search term' : 'All registrations have been reviewed.'}</p>
                      {search && (
                        <button className="pe-empty-btn" onClick={() => setSearch('')}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                          </svg>
                          Clear Search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((e, idx) => (
                  <tr key={e.id}>
                    <td style={{color: '#64748b', fontSize: '0.85rem', fontWeight: 500}}>{(page - 1) * perPage + idx + 1}</td>
                    <td>
                      <div className="pe-name-cell">
                        <div className="pe-avatar" style={{background: avatarColors[idx % avatarColors.length]}}>
                          {initials(e.full_name)}
                        </div>
                        <span className="pe-name">{e.full_name}</span>
                      </div>
                    </td>
                    <td className="pe-email">{e.email_id}</td>
                    <td className="pe-mobile">{e.mobile_no}</td>
                    <td style={{textAlign:'right'}}>
                      <div className="pe-actions" style={{justifyContent:'flex-end'}}>
                        <Link to={`/employees/detail/${e.id}?fromPending=true`} className="pe-btn-view">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          View Details
                        </Link>
                        <button className="pe-btn-approve" onClick={() => approveEmployee(e.id)} disabled={approvingId === e.id}>
                          {approvingId === e.id ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'pePulse 1s infinite'}}>
                              <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                              <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                          {approvingId === e.id ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          className="pe-btn-view"
                          style={{ color: '#dc2626', borderColor: '#fecaca' }}
                          onClick={() => sendBackEmployee(e.id)}
                          disabled={approvingId === e.id}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                          </svg>
                          Send Back
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {!loading && totalPages > 1 && (
            <div className="pe-pagination">
              <span className="pe-page-info">Page {page} of {totalPages}</span>
              <button className="pe-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button key={p} className={`pe-page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                );
              })}
              <button className="pe-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PendingEmployees;
