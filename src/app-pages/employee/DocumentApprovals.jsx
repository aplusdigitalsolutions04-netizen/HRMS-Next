import React, { useState, useEffect } from 'react';
import Pagination, { paginate } from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });
const PAGE_SIZE = 10;

export default function DocumentApprovals() {
  const [tab, setTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const pageItems = paginate(items, page, pageSize);

  const fetchItems = () => {
    setLoading(true);
    fetch(`${API}/document-approvals?status=${tab}`, { headers: auth() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setItems(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); setPage(1); }, [tab]);

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this document?')) return;
    try {
      const res = await fetch(`${API}/document-approvals/${id}/approve`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { alert(data.detail || 'Failed'); return; }
      fetchItems();
    } catch { alert('Failed to approve'); }
  };

  const handleDeny = async (id) => {
    if (!window.confirm('Deny this document request?')) return;
    try {
      const res = await fetch(`${API}/document-approvals/${id}/deny`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) { alert(data.detail || 'Failed'); return; }
      fetchItems();
    } catch { alert('Failed to deny'); }
  };

  const previewFile = async (item) => {
    setPreview(item);
    setTimeout(async () => {
      try {
        const r = await fetch(`/api/documents/${item.id}/serve`, { headers: auth() });
        if (!r.ok) return;
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const body = document.getElementById('preview-body');
        if (!body) return;
        body.innerHTML = '';
        if (blob.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = url;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          img.style.objectFit = 'contain';
          img.style.borderRadius = '8px';
          body.appendChild(img);
        } else {
          const iframe = document.createElement('iframe');
          iframe.src = url;
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          iframe.style.borderRadius = '8px';
          body.appendChild(iframe);
        }
      } catch {}
    }, 50);
  };

  const tabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'denied', label: 'Denied' },
  ];

  return (
    <div style={{ maxWidth: '100%', padding: '0 24px' }}>
      <style>{`
        .da-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .da-header h1 { font-size: 24px; font-weight: 700; color: #0f172a; font-family: 'Outfit', sans-serif; margin: 0; }
        .da-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; }
        .da-tab { padding: 8px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; background: none; color: #64748b; font-family: inherit; }
        .da-tab:hover { color: #0f172a; }
        .da-tab.active { background: #fff; color: #6366f1; box-shadow: 0 1px 3px rgba(0,0,0,0.06); font-weight: 600; }
        .da-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
        .da-table th { padding: 12px 16px; text-align: left; font-weight: 600; color: #64748b; font-size: 13px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        .da-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: #0f172a; }
        .da-table tr:hover td { background: #f8fafc; }
        .da-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .da-badge.pending { background: #fffbeb; color: #d97706; }
        .da-badge.approved { background: #ecfdf5; color: #059669; }
        .da-badge.denied { background: #fef2f2; color: #dc2626; }
        .da-btn { padding: 6px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
        .da-btn.approve { background: #059669; color: #fff; }
        .da-btn.approve:hover { background: #047857; }
        .da-btn.deny { background: #dc2626; color: #fff; }
        .da-btn.deny:hover { background: #b91c1c; }
        .da-btn.preview { background: #6366f1; color: #fff; margin-right: 6px; }
        .da-btn.preview:hover { background: #4f46e5; }
        .da-overlay { position: fixed; top: 3%; left: 3%; right: 3%; bottom: 3%; background: #fff; border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); z-index: 1000; display: flex; flex-direction: column; overflow: hidden; animation: daFadeIn 0.2s ease; }
        @keyframes daFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .da-overlay-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .da-overlay-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: #0f172a; }
        .da-overlay-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8; padding: 4px 8px; border-radius: 6px; line-height: 1; }
        .da-overlay-close:hover { background: #e2e8f0; color: #0f172a; }
        .da-overlay-body { flex: 1; padding: 24px; overflow: auto; display: flex; align-items: center; justify-content: center; background: #f1f5f9; }
        .da-overlay-body iframe { width: 100%; height: 100%; border: none; border-radius: 8px; }
        .da-overlay-body img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .da-empty { text-align: center; padding: 60px 20px; color: #94a3b8; }
        .da-empty svg { margin-bottom: 12px; }
        .da-empty h3 { font-size: 16px; font-weight: 600; color: #64748b; margin: 0 0 4px; }
        .da-empty p { font-size: 13px; margin: 0; }
      `}</style>

      <div className="da-header">
        <h1>Document Approvals</h1>
      </div>

      <div className="da-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`da-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="da-empty"><p>Loading...</p></div>
      ) : items.length === 0 ? (
        <div className="da-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h3>No {tab} document requests</h3>
          <p>When employees upload documents, they will appear here for review.</p>
        </div>
      ) : (
        <>
        <table className="da-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Employee</th>
              <th>Document</th>
              <th>Type</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ color: '#94a3b8', fontSize: 13 }}>{(page - 1) * pageSize + idx + 1}</td>
                <td>
                  <div style={{ fontWeight: 500, color: '#0f172a' }}>{item.emp_name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{item.emp_code}</div>
                </td>
                <td>{item.original_filename || item.document_type}</td>
                <td>
                  <span className={`da-badge ${item.is_replacement ? 'approved' : 'pending'}`}>
                    {item.is_replacement ? 'Replace' : 'New'}
                  </span>
                </td>
                <td style={{ fontSize: 13, color: '#64748b' }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td>
                  <span className={`da-badge ${item.action}`}>
                    {item.action.charAt(0).toUpperCase() + item.action.slice(1)}
                  </span>
                </td>
                <td>
                  <button className="da-btn preview" onClick={() => previewFile(item)}>Preview</button>
                  {item.action === 'pending' && (
                    <>
                      <button className="da-btn approve" onClick={() => handleApprove(item.id)}>Approve</button>
                      {' '}
                      <button className="da-btn deny" onClick={() => handleDeny(item.id)}>Deny</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} totalItems={items.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="requests" />
        </>
      )}

      {preview && (
        <div className="da-overlay">
          <div className="da-overlay-header">
            <h3>{preview.original_filename || preview.document_type} — {preview.emp_name}</h3>
            <button className="da-overlay-close" onClick={() => setPreview(null)}>&times;</button>
          </div>
          <div className="da-overlay-body" id="preview-body">
          </div>
        </div>
      )}
    </div>
  );
}
