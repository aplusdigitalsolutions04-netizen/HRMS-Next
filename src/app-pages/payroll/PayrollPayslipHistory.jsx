import React, { useState, useEffect } from 'react';
import Pagination from '../shared/Pagination';
import Swal from 'sweetalert2';
import { Tabs } from '@/lib/ui-motion';
import { appLocale, currencySymbol } from '@/lib/app-config-client';

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
  const [perPage, setPerPage] = useState(10);
  const [statusTab, setStatusTab] = useState('all');
  const [drafts, setDrafts] = useState(0);
  const [approving, setApproving] = useState(false);

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
    if (statusTab !== 'all') url += `&status=${statusTab.toUpperCase()}`;
    fetch(url, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setPayslips(d.payslips || []);
        setTotal(d.total || 0);
        setDrafts(d.drafts || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayslips(); }, [page, month, year, search, perPage, statusTab]);

  // Approve = publish to the employee and email the PDF. Drafts are never visible to employees.
  const approve = async (body, confirmText) => {
    const c = await Swal.fire({ icon: 'question', title: 'Approve and email?', text: confirmText, showCancelButton: true, confirmButtonText: 'Approve & email', cancelButtonText: 'Cancel', confirmButtonColor: 'var(--brand)' });
    if (!c.isConfirmed) return;
    setApproving(true);
    try {
      const res = await fetch(`${API}/payroll/payslips/approve`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, send_email: true }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Approve failed');
      await Swal.fire({ icon: d.failed && d.failed.length ? 'warning' : 'success', title: 'Done', text: d.message });
      fetchPayslips();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setApproving(false); }
  };

  // Copies the approved payslips of the chosen month to Google Drive (folder "<Month> <Year>")
  const saveMonthToDrive = async () => {
    const label = `${months.find(m => m.value === month)?.label} ${year}`;
    const c = await Swal.fire({ icon: 'question', title: 'Save to Google Drive?', text: `Save all approved payslips of ${label} in a Drive folder named "${label}"? Files already there are replaced.`, showCancelButton: true, confirmButtonText: 'Save', confirmButtonColor: 'var(--brand)' });
    if (!c.isConfirmed) return;
    setApproving(true);
    try {
      const res = await fetch(`${API}/payroll/payslips/save-to-drive`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ month, year }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      Swal.fire({ icon: d.failed ? 'warning' : 'success', title: 'Done', text: d.message });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setApproving(false); }
  };

  const downloadPayslip = async (id) => {
    try {
      const res = await fetch(`${API}/payroll/payslips/${id}/download`, { headers: auth() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ? 'Download failed: ' + d.detail : 'Download failed'); }
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
      if (!window.confirm(`Payslip was already emailed to ${p.employee_email} on ${new Date(p.email_sent_at).toLocaleString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Send again?`)) return;
    }
    setEmailPreview({ id: p.id, to: p.employee_email, subject: '', html: '', cc: '', bcc: '', filename: '', loading: true });
    fetch(`${API}/payroll/payslips/${p.id}/send-email`, { headers: auth() })
      .then(async res => { const d = await res.json(); if (!res.ok) throw new Error(d.detail || 'Could not load the mail'); return d; })
      .then(d => setEmailPreview({ id: p.id, to: d.to || p.employee_email, cc: d.cc || '', bcc: d.bcc || '', subject: d.subject, html: (d.logo_data_url ? String(d.html).split('cid:company-logo').join(d.logo_data_url) : d.html), logo: d.logo_data_url || '', filename: d.filename, loading: false }))
      .catch(e => { setEmailPreview(null); alert(e.message); });
  };

  const sendEmailPayslip = async () => {
    if (!emailPreview) return;
    setSendingEmail(true);
    try {
      // the text HR may have edited goes along; the logo picture is turned back into the form a mail needs
      const html = emailPreview.logo ? String(emailPreview.html).split(emailPreview.logo).join('cid:company-logo') : emailPreview.html;
      const res = await fetch(`${API}/payroll/payslips/${emailPreview.id}/send-email`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: emailPreview.subject, html, cc: emailPreview.cc || '', bcc: emailPreview.bcc || '' }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Failed to send email');
      setPayslips(prev => prev.map(p => p.id === emailPreview.id ? { ...p, email_sent_at: new Date().toISOString() } : p));
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

  // Open the PDF in a new browser tab. The tab is opened synchronously on the
  // click (so popup blockers allow it) and pointed at the PDF once loaded.
  const viewDetails = async (id) => {
    const tab = window.open('', '_blank');
    try {
      const res = await fetch(`${API}/payroll/payslips/${id}/download`, { headers: auth() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail ? 'Failed to load: ' + d.detail : 'Failed to load'); }
      const blob = await res.blob();
      const pdfUrl = window.URL.createObjectURL(blob);
      if (tab) tab.location.href = pdfUrl; else window.location.href = pdfUrl;
      setTimeout(() => window.URL.revokeObjectURL(pdfUrl), 5 * 60 * 1000);
    } catch (e) {
      if (tab) tab.close();
      alert(e.message);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="pr-page">
      <style>{pgStyles}</style>
      <div className="pr-header">
        <div>
          <h2 className="pr-title">Payslip History</h2>
          <p className="pr-subtitle">Payslips are prepared as drafts. Check them, then approve - approving publishes the payslip to the employee and emails it.</p>
        </div>
        <div className="pr-header-btns">
        {month && year && (
          <button className="pr-btn pr-btn-secondary" disabled={approving} onClick={saveMonthToDrive} title="Save the approved payslips of this month to Google Drive">Save month to Drive</button>
        )}
        {drafts > 0 && (
          <button className="pr-btn pr-btn-primary" disabled={approving || !month || !year}
            title={!month || !year ? 'Pick a month and a year to approve all of its drafts at once' : ''}
            onClick={() => approve({ month, year }, `Approve all ${drafts} draft payslip(s) for ${months.find(m => m.value === month)?.label} ${year} and email them to the employees?`)}>
            {approving ? 'Working...' : `Approve & email all drafts (${drafts})`}
          </button>
        )}
        </div>
      </div>

      <div className="tabs-bar">
        <Tabs id="payslip-status" value={statusTab} onChange={v => { setStatusTab(v); setPage(1); }} tabs={[
          { id: 'all', label: 'All' },
          { id: 'draft', label: 'Drafts' },
          { id: 'approved', label: 'Approved' },
        ]} />
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
                  <th>Status</th>
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
                    <td>
                      {String(p.status || 'APPROVED').toUpperCase() === 'DRAFT'
                        ? <span style={{ background: '#fffbeb', color: '#b45309', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>Draft</span>
                        : <span style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{p.email_sent_at ? 'Approved · Emailed' : 'Approved'}</span>}
                    </td>
                    <td style={{ fontSize: '.8rem', color: '#64748b' }}>{p.generated_at ? new Date(p.generated_at).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {String(p.status || 'APPROVED').toUpperCase() === 'DRAFT' && (
                          <button className="pr-action-btn" style={{ color: '#15803d', fontWeight: 700 }} disabled={approving} onClick={() => approve({ ids: [p.id] }, `Approve the payslip for ${p.employee_name} and email it?`)} title="Approve & email">✓</button>
                        )}
                        <button className="pr-action-btn" onClick={() => viewDetails(p.id, p.employee_name)} title="View">👁</button>
                        <button className="pr-action-btn" onClick={() => downloadPayslip(p.id)} title="Download">⬇</button>
                        {String(p.status || 'APPROVED').toUpperCase() !== 'DRAFT' && <button className={`pr-action-btn ${p.email_sent_at ? 'pr-emailed' : ''}`} onClick={() => openEmailPreview(p)} title={p.email_sent_at ? `Sent: ${new Date(p.email_sent_at).toLocaleString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'Send Email'}>{p.email_sent_at ? '✅' : '✉'}</button>}
                        <button className="pr-action-btn" onClick={() => deletePayslip(p.id, p.employee_name)} title="Delete" style={{ color: '#dc2626' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination onPageSizeChange={n => { setPerPage(n); setPage(1); }} page={page} totalItems={total} pageSize={perPage} itemLabel="payslips" onPageChange={setPage} />
      </div>

      {emailPreview && (
        <div className="pr-modal-overlay" onClick={() => setEmailPreview(null)}>
          <div className="pr-modal" onClick={e => e.stopPropagation()}>
            <div className="pr-modal-header">
              <h3>Send Payslip Email</h3>
              <button className="pr-modal-close" onClick={() => setEmailPreview(null)}>✕</button>
            </div>
            <div className="pr-modal-body">
              <div className="pe-field"><span className="pe-label">To:</span><span className="pe-value">{emailPreview.to}</span></div>
              <div className="pe-field"><span className="pe-label">CC:</span>
                <input className="pe-input" value={emailPreview.cc || ''} disabled={emailPreview.loading} placeholder="Separate addresses with a comma" onChange={e => setEmailPreview(v => ({ ...v, cc: e.target.value }))} />
              </div>
              <div className="pe-field"><span className="pe-label">BCC:</span>
                <input className="pe-input" value={emailPreview.bcc || ''} disabled={emailPreview.loading} placeholder="Hidden copy" onChange={e => setEmailPreview(v => ({ ...v, bcc: e.target.value }))} />
              </div>
              <div className="pe-field"><span className="pe-label">Subject:</span>
                <input className="pe-input" value={emailPreview.subject} disabled={emailPreview.loading} onChange={e => setEmailPreview(v => ({ ...v, subject: e.target.value }))} />
              </div>
              <div className="pe-field"><span className="pe-label">Attached:</span><span className="pe-value">{emailPreview.filename ? <span className="pe-file">📎 {emailPreview.filename}</span> : '...'} <span style={{ color: '#94a3b8' }}>(added automatically)</span></span></div>
              <div className="pe-divider" />
              <div className="pe-hint">You can edit the message below before sending.</div>
              {emailPreview.loading
                ? <div className="pe-body">Loading...</div>
                : <div className="pe-body pe-edit" contentEditable suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                    onBlur={e => { const h = e.currentTarget.innerHTML; setEmailPreview(v => ({ ...v, html: h })); }} />}
            </div>
            <div className="pr-modal-footer">
              <button className="pr-btn pr-btn-secondary" onClick={() => setEmailPreview(null)}>Cancel</button>
              <button className="pr-btn pr-btn-primary" onClick={sendEmailPayslip} disabled={sendingEmail || emailPreview.loading}>
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
  return currencySymbol() + ' ' + n.toLocaleString(appLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const pgStyles = `
.pr-page { padding: 0; }
.pr-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
.pr-header-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.pr-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 700; color: #0f172a; }
.pr-subtitle { margin: 4px 0 0; font-size: .88rem; color: #64748b; }
.pr-card { background: #fff; border-radius: 16px; border: 1.5px solid #e2e8f0; overflow: hidden; }
.pr-toolbar { display: flex; flex-wrap: wrap; gap: 10px; padding: 16px 15px; border-bottom: 1.5px solid #e2e8f0; align-items: center; }
.pr-search { flex: 1; min-width: 200px; padding: 9px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; outline: none; font-family: 'Inter', sans-serif; }
.pr-search:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(111,78,55,.15); }
.pr-filter-select { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; outline: none; background: #fff; cursor: pointer; font-family: 'Inter', sans-serif; }
.pr-loading { padding: 30px; text-align: center; color: #94a3b8; }
.pr-empty { padding: 36px 15px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 12px; }
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
.pr-btn { padding: 10px 17px; border-radius: 10px; font-size: .88rem; font-weight: 600; cursor: pointer; transition: all .2s; font-family: 'Outfit', sans-serif; border: none; display: inline-flex; align-items: center; gap: 6px; }
.pr-btn-primary { background: linear-gradient(135deg,var(--brand),var(--brand-mid)); color: #fff; }
.pr-btn-primary:hover { box-shadow: 0 4px 14px rgba(111,78,55,.35); transform: translateY(-1px); }
.pr-btn-secondary { background: #fff; color: #475569; border: 1.5px solid #e2e8f0; }
.pr-btn-secondary:hover { background: #f1f5f9; }
.pr-pagination { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 14px 15px; border-top: 1.5px solid #e2e8f0; }
@media (max-width: 640px) {
  .pr-header-btns { width: 100%; }
  .pr-header-btns .pr-btn { flex: 1 1 100%; justify-content: center; }
  .pr-search { min-width: 100%; }
  .pr-filter-select { flex: 1; min-width: 0; }
  .pr-table th, .pr-table td { padding: 10px 10px; }
  .pr-pagination { justify-content: center; }
}
.pr-page-btns { display: flex; align-items: center; gap: 4px; }
.pr-page-btn { width: 32px; height: 32px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; cursor: pointer; font-size: .82rem; color: #475569; display: flex; align-items: center; justify-content: center; }
.pr-page-btn:hover:not(:disabled) { background: #f1f5f9; }
.pr-page-btn:disabled { opacity: .4; cursor: not-allowed; }
.pr-page-current { font-weight: 600; font-size: .88rem; color: #1e293b; min-width: 32px; text-align: center; }
.pr-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.pr-modal { background: #fff; border-radius: 16px; width: 500px; max-width: 94vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(15,23,42,.25); }
.pr-modal-lg { width: 800px; }
.pr-modal-pdf { width: 900px; max-width: 96vw; }
.pr-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 18px; border-bottom: 1.5px solid #e2e8f0; }
.pr-modal-header h3 { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
.pr-modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; padding: 4px 8px; border-radius: 6px; }
.pr-modal-close:hover { background: #f1f5f9; color: #475569; }
.pr-modal-body { padding: 15px 18px; }
.pr-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 18px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; }
.pr-detail-grid { display: flex; flex-direction: column; gap: 20px; }
.pr-detail-section h4 { margin: 0 0 10px; font-family: 'Outfit', sans-serif; font-size: .95rem; font-weight: 700; color: #1e293b; }
.pr-detail-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: .85rem; }
.pr-detail-row span:first-child { color: #64748b; }
.pr-detail-row span:last-child { color: #1e293b; font-weight: 500; }
.pe-field { display: flex; gap: 8px; padding: 6px 0; font-size: .88rem; }
.pe-label { font-weight: 600; color: #475569; min-width: 70px; }
.pe-value { color: #0f172a; word-break: break-all; }
.pe-divider { border-top: 1px solid #e2e8f0; margin: 12px 0; }
.pe-body { font-size: .88rem; color: #334155; line-height: 1.6; }
.pe-edit { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; min-height: 140px; max-height: 45vh; overflow: auto; outline: none; background: #fff; }
.pe-edit:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(111,78,55,.15); }
.pe-edit img { max-width: 100%; }
.pe-input { flex: 1; min-width: 0; padding: 7px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: .88rem; font-family: inherit; outline: none; }
.pe-input:focus { border-color: var(--brand); }
.pe-file { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 2px 8px; font-size: .82rem; word-break: break-all; }
.pe-hint { font-size: .78rem; color: #64748b; margin-bottom: 8px; }
`;
