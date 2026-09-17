import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const PAGE_SIZE = 10;

const DraftManagement = () => {
  const [drafts, setDrafts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [viewingDraft, setViewingDraft] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const fetchDrafts = () => {
    setLoading(true);
    fetch(`${API}/email/drafts`, { headers: auth() })
      .then(r => r.json())
      .then(d => setDrafts(Array.isArray(d) ? d : []))
      .catch(() => setDrafts([]))
      .finally(() => setLoading(false));
  };

  const fetchTemplates = () => {
    fetch(`${API}/templates`, { headers: auth() })
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  useEffect(() => { 
    fetchDrafts(); 
    fetchTemplates();
  }, []);

  const filtered = filter
    ? drafts.filter(d =>
        (d.candidate_name || '').toLowerCase().includes(filter.toLowerCase()) ||
        (d.to_email || '').toLowerCase().includes(filter.toLowerCase()) ||
        (d.subject || '').toLowerCase().includes(filter.toLowerCase()) ||
        (d.template_name || '').toLowerCase().includes(filter.toLowerCase())
      )
    : drafts;

  useEffect(() => { setPage(1); }, [filter, drafts.length]);
  const pageItems = paginate(filtered, page, pageSize);

  const sendDraft = async (draft) => {
    // 1. Detect custom variables in subject and body
    const textToScan = (draft.subject || '') + ' ' + (draft.body || '');
    const matches = textToScan.match(/\{{1,2}[A-Za-z0-9_]+\}{1,2}/gi) || [];
    
    // Ignore known standard variables handled elsewhere or manually
    const standardVars = ['{candidate_name}', '{{candidate_name}}', '{name}', '{{name}}', '{{email}}', '{{password}}', '{{official_email}}', '{{official_no}}', '{{login_url}}', '{{official_details_section}}', '{position}', '{interview_date}', '{interview_mode}', '{round}', '{company_name}'];
    
    const customVarsFound = [...new Set(matches)].filter(m => !standardVars.includes(m.toLowerCase()));

    let updatedSubject = draft.subject;
    let updatedBody = draft.body;

    if (customVarsFound.length > 0) {
      const htmlInputs = customVarsFound.map(v => 
        `<div style="margin-bottom: 12px; text-align: left;">
          <label style="font-size: .85rem; font-weight: 600; color: #475569;">Value for <strong>${v}</strong></label>
          <input id="swal-input-${v}" class="premium-input swal-custom-var-input" style="width: 100%; box-sizing: border-box;" placeholder="Enter value...">
        </div>`
      ).join('');

      const result = await Swal.fire({
        title: 'Provide Variable Values',
        html: `<p style="font-size: .9rem; color: #64748b; margin-bottom: 16px;">This template contains custom variables that need to be filled before sending.</p>` + htmlInputs,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Continue to Send',
        confirmButtonColor: '#6366f1',
        preConfirm: () => {
          const values = {};
          for (const v of customVarsFound) {
            const el = document.getElementById(`swal-input-${v}`);
            if (!el || !el.value) {
              Swal.showValidationMessage(`Please provide a value for ${v}`);
              return false;
            }
            values[v] = el.value;
          }
          return values;
        }
      });

      if (!result.isConfirmed) return;
      
      const varValues = result.value;
      // Replace variables in subject and body
      for (const [v, val] of Object.entries(varValues)) {
        const regex = new RegExp(v.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"), 'gi');
        updatedSubject = updatedSubject.replace(regex, val);
        updatedBody = updatedBody.replace(regex, val);
      }

      // Automatically save the draft with the updated body before sending
      await fetch(`${API}/email/drafts/${draft.id}`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, subject: updatedSubject, body: updatedBody })
      });
      fetchDrafts(); // To update list silently
    }

    Swal.fire({
      title: 'Send Draft?',
      html: `
        <p style="margin-bottom:16px;color:#475569;font-size:1.05rem;">Send email to <strong>${draft.candidate_name || draft.to_email}</strong>?</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '📤 Send',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4338ca',
      preConfirm: () => {
        return {};
      },
    }).then(result => {
      if (!result.isConfirmed) return;
      const { sender_email, sender_password } = result.value || {};
      fetch(`${API}/email/drafts/${draft.id}/send`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_email, sender_password }),
      })
        .then(async r => ({ ok: r.ok, data: await r.json() }))
        .then(({ ok, data }) => {
          if (ok) {
            Swal.fire({ icon: 'success', title: 'Sent!', text: data.message || 'Email sent successfully.', timer: 2000, showConfirmButton: false });
            fetchDrafts();
          } else {
            Swal.fire({ icon: 'error', title: 'Failed', text: data.detail || 'Sending failed' });
          }
        })
        .catch(() => Swal.fire('Error', 'An error occurred', 'error'));
    });
  };

  const deleteDraft = (draft) => {
    Swal.fire({
      title: 'Delete Draft?',
      text: `Delete draft for ${draft.candidate_name || draft.to_email}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
    }).then(result => {
      if (!result.isConfirmed) return;
      fetch(`${API}/email/drafts/${draft.id}`, {
        method: 'DELETE',
        headers: auth(),
      })
        .then(async r => ({ ok: r.ok, data: await r.json() }))
        .then(({ ok, data }) => {
          if (ok) {
            Swal.fire('Deleted!', 'Draft has been deleted.', 'success');
            fetchDrafts();
          } else {
            Swal.fire('Error!', data.detail || 'Could not delete draft.', 'error');
          }
        })
        .catch(() => Swal.fire('Error', 'An error occurred.', 'error'));
    });
  };

  const saveDraft = () => {
    fetch(`${API}/email/drafts/${viewingDraft.id}`, {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(viewingDraft)
    })
    .then(async r => {
        if (!r.ok) throw new Error('Save failed');
        Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
        setIsEditing(false);
        fetchDrafts();
    })
    .catch(() => Swal.fire('Error', 'Failed to save draft.', 'error'));
  };

  const applyTemplate = (e) => {
    const tplId = e.target.value;
    if (!tplId) return;
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    
    let subject = tpl.subject || '';
    let body = tpl.body || '';
    
    // Simple replacement for candidate name
    const cName = viewingDraft.candidate_name || '';
    subject = subject.replace(/\{{1,2}(name|candidate_name)\}{1,2}/gi, cName);
    body = body.replace(/\{{1,2}(name|candidate_name)\}{1,2}/gi, cName);

    setViewingDraft({ ...viewingDraft, subject, body, template_name: tpl.name });
  };

const formatEmailBody = (body) => {
  if (!body) return '\u2014';
  const htmlRegex = /<\/?[a-z][\s\S]*>/i;
  if (htmlRegex.test(body)) return body;
  return body.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('');
};

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const statusBadge = (status) => {
    const map = {
      DRAFT: { bg: '#fef3c7', color: '#b45309', label: 'Draft' },
      SENT: { bg: '#dcfce7', color: '#15803d', label: 'Sent' },
      CANCELLED: { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
    };
    // DB stores status lowercase ('draft'/'sent') - normalize before lookup.
    const s = map[(status || '').toUpperCase()] || { bg: '#f1f5f9', color: '#64748b', label: status };
    return <span className="badge-premium" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div>
      <style>{`
        .el-view-page { animation:elFadeIn .25s ease both; }
        @keyframes elFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .el-view-back { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border:1.5px solid #e2e8f0; border-radius:10px; background:#fff; color:#475569; font-size:.85rem; font-weight:600; cursor:pointer; transition:all .2s; font-family:'Outfit',sans-serif; margin-bottom:20px; }
        .el-view-back:hover { background:#f8fafc; border-color:#cbd5e1; }
        .el-view-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; margin-bottom:20px; }
        .el-view-field { background:#f8fafc; border-radius:10px; padding:12px 14px; }
        .el-view-field.full { grid-column:1 / -1; }
        .el-view-field-label { font-size:.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
        .el-view-field-value { font-size:.88rem; color:#0f172a; line-height:1.4; word-break:break-word; }
        .el-view-body-box { background:#fff; border-radius:10px; padding:20px 24px; font-size:.88rem; color:#334155; line-height:1.8; border:1px solid #e2e8f0; font-family:'Segoe UI',Arial,sans-serif; }
        .el-view-body-box p { margin:0 0 12px; }
        .el-view-body-box p:last-child { margin-bottom:0; }
        .el-view-body-box br { display:block; content:''; margin:8px 0; }
        .draft-icon-btn { background:transparent; border:none; padding:6px; cursor:pointer; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; transition:all 0.2s; }
        .draft-icon-btn:hover { background:#f1f5f9; transform:scale(1.05); }
      `}</style>
      {viewingDraft ? (
        <div className="el-view-page">
          <button className="el-view-back" onClick={() => setViewingDraft(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Drafts
          </button>
          <div style={{ background:'#fff', borderRadius:14, border:'1px solid #f1f5f9', padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingBottom:16, borderBottom:'1px solid #f1f5f9' }}>
              <h3 style={{ margin:0, fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.15rem', color:'#0f172a' }}>{viewingDraft.candidate_name || 'Draft'} — Email Details</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {(viewingDraft.status || '').toUpperCase() === 'DRAFT' && (
                    isEditing ? (
                        <button className="btn-premium" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={saveDraft}>💾 Save Draft</button>
                    ) : (
                        <button className="btn-premium-outline" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => setIsEditing(true)}>✏️ Edit Draft</button>
                    )
                )}
                {statusBadge(viewingDraft.status)}
              </div>
            </div>
            <div className="el-view-grid">
              <div className="el-view-field">
                <div className="el-view-field-label">To</div>
                {isEditing ? (
                    <input className="premium-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }} value={viewingDraft.to_email || ''} onChange={e => setViewingDraft({...viewingDraft, to_email: e.target.value})} />
                ) : (
                    <div className="el-view-field-value" style={{color:'#4338ca'}}>{viewingDraft.to_email}</div>
                )}
              </div>
              {viewingDraft.cc && (
                <div className="el-view-field">
                  <div className="el-view-field-label">CC</div>
                  <div className="el-view-field-value">{viewingDraft.cc}</div>
                </div>
              )}
              {viewingDraft.bcc && (
                <div className="el-view-field">
                  <div className="el-view-field-label">BCC</div>
                  <div className="el-view-field-value">{viewingDraft.bcc}</div>
                </div>
              )}
              <div className="el-view-field">
                <div className="el-view-field-label">Candidate</div>
                <div className="el-view-field-value">{viewingDraft.candidate_name || '—'}</div>
              </div>
              <div className="el-view-field">
                <div className="el-view-field-label">Template</div>
                {isEditing ? (
                    <select className="premium-input" style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }} onChange={applyTemplate}>
                        <option value="">-- Apply Template --</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                ) : (
                    <div className="el-view-field-value">{viewingDraft.template_name || '—'}</div>
                )}
              </div>
              <div className="el-view-field">
                <div className="el-view-field-label">Created On</div>
                <div className="el-view-field-value">{formatDate(viewingDraft.created_at)}</div>
              </div>
              {viewingDraft.job_role && (
                <div className="el-view-field">
                  <div className="el-view-field-label">Job Role</div>
                  <div className="el-view-field-value">{viewingDraft.job_role}</div>
                </div>
              )}
              {viewingDraft.interview_date && (
                <div className="el-view-field">
                  <div className="el-view-field-label">Interview Date</div>
                  <div className="el-view-field-value">{new Date(viewingDraft.interview_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</div>
                </div>
              )}
              <div className="el-view-field full">
                <div className="el-view-field-label">Subject</div>
                {isEditing ? (
                    <input className="premium-input" style={{ width: '100%', padding: '8px 12px', fontSize: '0.9rem' }} value={viewingDraft.subject || ''} onChange={e => setViewingDraft({...viewingDraft, subject: e.target.value})} />
                ) : (
                    <div className="el-view-field-value" style={{ fontWeight:600 }}>{viewingDraft.subject || '—'}</div>
                )}
              </div>
            </div>
            <div className="el-view-field-label" style={{ marginBottom:8 }}>Body</div>
            {isEditing ? (
                <textarea 
                    className="premium-input" 
                    style={{ width: '100%', minHeight: '300px', padding: '16px', fontSize: '0.9rem', lineHeight: '1.6' }} 
                    value={viewingDraft.body || ''} 
                    onChange={e => setViewingDraft({...viewingDraft, body: e.target.value})}
                />
            ) : (
                <div className="el-view-body-box" dangerouslySetInnerHTML={{ __html: formatEmailBody(viewingDraft.body) }} />
            )}
          </div>
        </div>
      ) : (
        <>
      <h2 className="page-title">📧 Draft Emails</h2>
      <p className="page-subtitle">Manage and send your saved email drafts</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <input
          className="premium-input"
          style={{ maxWidth: 360 }}
          placeholder="Search drafts..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button className="btn-premium" onClick={fetchDrafts}>🔄 Refresh</button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {filtered.length} of {drafts.length} drafts
        </span>
      </div>

      {loading ? (
        <div className="notif-loading" />
      ) : filtered.length === 0 ? (
        <div className="notif-empty">
          <span style={{ fontSize: '2rem' }}>📭</span>
          <p>{drafts.length === 0 ? 'No email drafts saved yet. Save a draft from Candidate Pool to see it here.' : 'No drafts match your search.'}</p>
        </div>
      ) : (
        <div className="premium-table-wrapper">
          <table className="premium-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Candidate</th>
                <th>Email</th>
                <th>Template</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Created On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d, i) => (
                <tr key={d.id}>
                  <td>{(page - 1) * pageSize + i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{d.candidate_name || '—'}</td>
                  <td>{d.to_email}</td>
                  <td>{d.template_name || '—'}</td>
                  <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.subject}>
                    {d.subject || '—'}
                  </td>
                  <td>{statusBadge(d.status)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{formatDate(d.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="draft-icon-btn" style={{ color: '#6366f1' }} title="View" onClick={() => setViewingDraft(d)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      {(d.status || '').toUpperCase() !== 'SENT' && (
                        <>
                          <button className="draft-icon-btn" style={{ color: '#10b981' }} title="Send" onClick={() => sendDraft(d)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                          </button>
                          <button className="draft-icon-btn" style={{ color: '#ef4444' }} title="Delete" onClick={() => deleteDraft(d)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="drafts" />
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default DraftManagement;