import React, { useState, useEffect } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const months = [
  { value: 0, label: 'All Months' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: ['January','February','March','April','May','June','July','August','September','October','November','December'][i] })),
];

export default function PayrollPayslipHistory() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 15;
  const [viewPayslip, setViewPayslip] = useState(null);

  // Debounce searchInput into search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPayslips = () => {
    setLoading(true);
    let url = `${API}/payroll/payslips?page=${page}&per_page=${perPage}&search=${search}`;
    if (month) url += `&month=${month}`;
    if (year) url += `&year=${year}`;
    fetch(url, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setPayslips(d.payslips || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayslips(); }, [page, month, year, search]);

  const downloadPayslip = async (id) => {
    try {
      const res = await fetch(`${API}/payroll/payslips/${id}/download`, { headers: auth() });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?(.+?)"?$/);
      const name = match ? match[1] : `payslip.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    }
  };

  const [emailPreview, setEmailPreview] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const openEmailPreview = (p) => {
    if (p.email_sent_at) {
      if (!window.confirm(`Payslip was already emailed to ${p.employee_email} on ${new Date(p.email_sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Send again?`)) return;
    }
    const monthLabel = monthNames[p.month - 1] || p.month;
    setEmailPreview({
      id: p.id,
      to: p.employee_email,
      employeeName: p.employee_name,
      subject: `Payslip for ${monthLabel} ${p.year}`,
      month: monthLabel,
      year: p.year,
    });
  };

  const sendEmailPayslip = async () => {
    if (!emailPreview) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${API}/payroll/payslips/${emailPreview.id}/send-email`, { method: 'POST', headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed to send email');
      setPayslips(prev => prev.map(p => p.id === emailPreview.id ? { ...p, email_sent_at: d.email_sent_at } : p));
      setEmailPreview(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const deletePayslip = async (id, name) => {
    if (!window.confirm(`Delete payslip for ${name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/payroll/payslips/${id}`, { method: 'DELETE', headers: auth() });
      if (!res.ok) throw new Error('Delete failed');
      fetchPayslips();
    } catch (e) {
      alert(e.message);
    }
  };

  const viewDetails = async (id, name) => {
    try {
      const res = await fetch(`${API}/payroll/payslips/${id}/download`, { headers: auth() });
      if (!res.ok) throw new Error('Failed to load');
      const blob = await res.blob();
      const pdfUrl = window.URL.createObjectURL(blob);
      setViewPayslip({ id, pdfUrl, name });
    } catch (e) {
      alert(e.message);
    }
  };

  const closeView = () => {
    if (viewPayslip?.pdfUrl) {
      window.URL.revokeObjectURL(viewPayslip.pdfUrl);
    }
    setViewPayslip(null);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="pr-page">
      <style>{pgStyles}</style>
      <div className="pr-header">
        <div>
          <h2 className="pr-title">Payslip History</h2>
          <p className="pr-subtitle">View and download generated payslips</p>
        </div>
      </div>

      <div className="pr-card">
        <div className="pr-toolbar">
          <input className="pr-search" placeholder="Search by employee code..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          <select className="pr-filter-select" value={month} onChange={e => { setMonth(Number(e.target.value)); setPage(1); }}>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className="pr-filter-select" value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1); }}>
            <option value={0}>All Years</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>
        {loading ? (
          <div className="pr-loading">Loading...</div>
        ) : payslips.length === 0 ? (
          <div className="pr-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <p>No payslips found. Generate payslips to see them here.</p>
          </div>
        ) : (
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Employee</th>
                  <th>Month</th>
                  <th>Year</th>
                  <th>Gross Salary</th>
                  <th>Deductions</th>
                  <th>Adjustments</th>
                  <th>Net Salary</th>
                  <th>Generated Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p, idx) => (
                  <tr key={p.id}>
                    <td style={{ color: '#94a3b8', fontSize: '.85rem' }}>{(page - 1) * perPage + idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.employee_name} <span style={{ color: '#94a3b8', fontSize: 12 }}>({p.emp_code})</span></td>
                    <td>{months.find(m => m.value === p.month)?.label || p.month}</td>
                    <td>{p.year}</td>
                    <td>{formatNum(p.gross_salary)}</td>
                    <td style={{ color: '#dc2626' }}>{formatNum(p.total_deductions)}</td>
                    <td style={{ color: '#059669' }}>{formatNum(p.total_adjustments)}</td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{formatNum(p.net_salary)}</td>
                    <td style={{ fontSize: '.8rem', color: '#64748b' }}>{p.generated_at ? new Date(p.generated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="pr-action-btn" onClick={() => viewDetails(p.id, p.employee_name)} title="View">👁</button>
                        <button className="pr-action-btn" onClick={() => downloadPayslip(p.id)} title="Download">⬇</button>
                        <button className={`pr-action-btn ${p.email_sent_at ? 'pr-emailed' : ''}`} onClick={() => openEmailPreview(p)} title={p.email_sent_at ? `Sent: ${new Date(p.email_sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Send Email'}>{p.email_sent_at ? '✅' : '✉'}</button>
                        <button className="pr-action-btn" onClick={() => deletePayslip(p.id, p.employee_name)} title="Delete" style={{ color: '#dc2626' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="pr-pagination">
            <span style={{ fontSize: '.82rem', color: '#64748b' }}>Page {page} of {totalPages}</span>
            <div className="pr-page-btns">
              <button className="pr-page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
              <button className="pr-page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              <span className="pr-page-current">{page}</span>
              <button className="pr-page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              <button className="pr-page-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
            </div>
          </div>
        )}
      </div>

      {viewPayslip && (
        <div className="pr-modal-overlay" onClick={closeView}>
          <div className="pr-modal pr-modal-pdf" onClick={e => e.stopPropagation()}>
            <div className="pr-modal-header">
              <h3>Payslip - {viewPayslip.name}</h3>
              <button className="pr-modal-close" onClick={closeView}>✕</button>
            </div>
            <div className="pr-modal-body" style={{ padding: 0 }}>
              <iframe src={viewPayslip.pdfUrl} style={{ width: '100%', height: '70vh', border: 'none' }} title="Payslip PDF" />
            </div>
            <div className="pr-modal-footer">
              <button className="pr-btn pr-btn-secondary" onClick={closeView}>Close</button>
              <button className="pr-btn pr-btn-primary" onClick={() => downloadPayslip(viewPayslip.id)}>Download PDF</button>
            </div>
          </div>
        </div>
      )}

      {emailPreview && (
        <div className="pr-modal-overlay" onClick={() => setEmailPreview(null)}>
          <div className="pr-modal" onClick={e => e.stopPropagation()}>
            <div className="pr-modal-header">
              <h3>Send Payslip Email</h3>
              <button className="pr-modal-close" onClick={() => setEmailPreview(null)}>✕</button>
            </div>
            <div className="pr-modal-body">
              <div className="pe-field"><span className="pe-label">To:</span><span className="pe-value">{emailPreview.to}</span></div>
              <div className="pe-field"><span className="pe-label">Subject:</span><span className="pe-value">{emailPreview.subject}</span></div>
              <div className="pe-divider" />
              <div className="pe-body">
                Dear {emailPreview.employeeName},<br /><br />
                Please find attached your payslip for the month of {emailPreview.month} {emailPreview.year}.<br /><br />
                This is a system-generated document. For any queries, please contact the HR department.<br /><br />
                Regards,<br />
                HR Team
              </div>
            </div>
            <div className="pr-modal-footer">
              <button className="pr-btn pr-btn-secondary" onClick={() => setEmailPreview(null)}>Cancel</button>
              <button className="pr-btn pr-btn-primary" onClick={sendEmailPayslip} disabled={sendingEmail}>
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNum(v) {
  const n = parseFloat(v) || 0;
  return '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const pgStyles = `
.pr-page { padding: 0; }
.pr-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.pr-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; color: #0f172a; }
.pr-subtitle { margin: 4px 0 0; font-size: .88rem; color: #64748b; }
.pr-card { background: #fff; border-radius: 16px; border: 1.5px solid #e2e8f0; overflow: hidden; }
.pr-toolbar { display: flex; flex-wrap: wrap; gap: 10px; padding: 16px 20px; border-bottom: 1.5px solid #e2e8f0; align-items: center; }
.pr-search { flex: 1; min-width: 200px; padding: 9px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; outline: none; font-family: 'Inter', sans-serif; }
.pr-search:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
.pr-filter-select { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; outline: none; background: #fff; cursor: pointer; font-family: 'Inter', sans-serif; }
.pr-loading { padding: 40px; text-align: center; color: #94a3b8; }
.pr-empty { padding: 48px 20px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.pr-empty p { margin: 0; font-size: .9rem; }
.pr-table-wrap { overflow-x: auto; }
.pr-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.pr-table th { padding: 12px 14px; text-align: left; font-weight: 600; color: #64748b; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; white-space: nowrap; font-size: .78rem; text-transform: uppercase; letter-spacing: .03em; }
.pr-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
.pr-table tbody tr:hover { background: #f8fafc; }
.pr-action-btn { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px; font-size: 14px; }
.pr-action-btn:hover { background: #f1f5f9; }
.pr-action-btn.pr-emailed { position: relative; color: #059669; }
.pr-action-btn.pr-emailed::after { content: ''; position: absolute; top: 3px; right: 3px; width: 8px; height: 8px; background: #059669; border-radius: 50%; border: 2px solid #fff; }
.pr-btn { padding: 10px 22px; border-radius: 10px; font-size: .88rem; font-weight: 600; cursor: pointer; transition: all .2s; font-family: 'Outfit', sans-serif; border: none; display: inline-flex; align-items: center; gap: 6px; }
.pr-btn-primary { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; }
.pr-btn-primary:hover { box-shadow: 0 4px 14px rgba(99,102,241,.35); transform: translateY(-1px); }
.pr-btn-secondary { background: #fff; color: #475569; border: 1.5px solid #e2e8f0; }
.pr-btn-secondary:hover { background: #f1f5f9; }
.pr-pagination { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-top: 1.5px solid #e2e8f0; }
.pr-page-btns { display: flex; align-items: center; gap: 4px; }
.pr-page-btn { width: 32px; height: 32px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; cursor: pointer; font-size: .82rem; color: #475569; display: flex; align-items: center; justify-content: center; }
.pr-page-btn:hover:not(:disabled) { background: #f1f5f9; }
.pr-page-btn:disabled { opacity: .4; cursor: not-allowed; }
.pr-page-current { font-weight: 600; font-size: .88rem; color: #1e293b; min-width: 32px; text-align: center; }
.pr-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.pr-modal { background: #fff; border-radius: 16px; width: 500px; max-width: 94vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(15,23,42,.25); }
.pr-modal-lg { width: 800px; }
.pr-modal-pdf { width: 900px; max-width: 96vw; }
.pr-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1.5px solid #e2e8f0; }
.pr-modal-header h3 { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
.pr-modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; padding: 4px 8px; border-radius: 6px; }
.pr-modal-close:hover { background: #f1f5f9; color: #475569; }
.pr-modal-body { padding: 20px 24px; }
.pr-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; }
.pr-detail-grid { display: flex; flex-direction: column; gap: 20px; }
.pr-detail-section h4 { margin: 0 0 10px; font-family: 'Outfit', sans-serif; font-size: .95rem; font-weight: 700; color: #1e293b; }
.pr-detail-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: .85rem; }
.pr-detail-row span:first-child { color: #64748b; }
.pr-detail-row span:last-child { color: #1e293b; font-weight: 500; }
.pe-field { display: flex; gap: 8px; padding: 6px 0; font-size: .88rem; }
.pe-label { font-weight: 600; color: #475569; min-width: 70px; }
.pe-value { color: #0f172a; word-break: break-all; }
.pe-divider { border-top: 1px solid #e2e8f0; margin: 12px 0; }
.pe-body { font-size: .88rem; color: #334155; line-height: 1.6; white-space: pre-line; }
`;
