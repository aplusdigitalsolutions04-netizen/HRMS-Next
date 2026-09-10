import React, { useState, useEffect } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const months = [
  { value: 0, label: 'All Months' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: ['January','February','March','April','May','June','July','August','September','October','November','December'][i] })),
];

export default function MyPayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(0);
  const [viewPayslip, setViewPayslip] = useState(null);

  const fetchPayslips = () => {
    setLoading(true);
    let url = `${API}/payroll/my-payslips`;
    const params = [];
    if (month) params.push(`month=${month}`);
    if (year) params.push(`year=${year}`);
    if (params.length) url += '?' + params.join('&');
    fetch(url, { headers: auth() })
      .then(r => r.json())
      .then(d => setPayslips(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayslips(); }, [month, year]);

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

  const viewDetails = async (id) => {
    try {
      const res = await fetch(`${API}/payroll/payslips/${id}/download`, { headers: auth() });
      if (!res.ok) throw new Error('Failed to load');
      const blob = await res.blob();
      const pdfUrl = window.URL.createObjectURL(blob);
      setViewPayslip({ id, pdfUrl });
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

  return (
    <div className="mp-page">
      <style>{mpStyles}</style>
      <div className="mp-header">
        <h2 className="mp-title">My Payslips</h2>
        <p className="mp-subtitle">View and download your salary slips</p>
      </div>

      <div className="mp-card">
        <div className="mp-toolbar">
          <select className="mp-filter" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select className="mp-filter" value={year} onChange={e => setYear(Number(e.target.value))}>
            <option value={0}>All Years</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>
        {loading ? (
          <div className="mp-loading">Loading...</div>
        ) : payslips.length === 0 ? (
          <div className="mp-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <p>No payslips available for the selected period.</p>
          </div>
        ) : (
          <div className="mp-list">
            {payslips.map(p => {
              const monthName = months.find(m => m.value === p.month)?.label || p.month;
              return (
                <div key={p.id} className="mp-item">
                  <div className="mp-item-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div className="mp-item-info">
                    <div className="mp-item-title">{monthName} {p.year}</div>
                    <div className="mp-item-meta">
                      Generated: {p.generated_at ? new Date(p.generated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  </div>
                  <div className="mp-item-amount">{formatNum(p.net_salary)}</div>
                  <div className="mp-item-actions">
                    <button className="mp-btn mp-btn-view" onClick={() => viewDetails(p.id)}>View</button>
                    <button className="mp-btn mp-btn-download" onClick={() => downloadPayslip(p.id)}>Download</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewPayslip && (
        <div className="mp-modal-overlay" onClick={closeView}>
          <div className="mp-modal mp-modal-pdf" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h3>Payslip Preview</h3>
              <button className="mp-modal-close" onClick={closeView}>✕</button>
            </div>
            <div className="mp-modal-body" style={{ padding: 0 }}>
              <iframe src={viewPayslip.pdfUrl} style={{ width: '100%', height: '70vh', border: 'none' }} title="Payslip PDF" />
            </div>
            <div className="mp-modal-footer">
              <button className="mp-btn-secondary" onClick={closeView}>Close</button>
              <button className="mp-btn-primary" onClick={() => downloadPayslip(viewPayslip.id)}>Download PDF</button>
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

const mpStyles = `
.mp-page { padding: 0; }
.mp-header { margin-bottom: 24px; }
.mp-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; color: #0f172a; }
.mp-subtitle { margin: 4px 0 0; font-size: .88rem; color: #64748b; }
.mp-card { background: #fff; border-radius: 16px; border: 1.5px solid #e2e8f0; overflow: hidden; }
.mp-toolbar { display: flex; gap: 10px; padding: 16px 20px; border-bottom: 1.5px solid #e2e8f0; }
.mp-filter { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; outline: none; background: #fff; cursor: pointer; font-family: 'Inter', sans-serif; }
.mp-loading { padding: 40px; text-align: center; color: #94a3b8; }
.mp-empty { padding: 48px 20px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.mp-empty p { margin: 0; font-size: .9rem; }
.mp-list { display: flex; flex-direction: column; }
.mp-item { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-bottom: 1px solid #f1f5f9; transition: background .15s; }
.mp-item:hover { background: #f8fafc; }
.mp-item:last-child { border-bottom: none; }
.mp-item-icon { width: 40px; height: 40px; border-radius: 10px; background: #eef2ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mp-item-info { flex: 1; min-width: 0; }
.mp-item-title { font-size: .95rem; font-weight: 600; color: #0f172a; }
.mp-item-meta { font-size: .78rem; color: #94a3b8; margin-top: 2px; }
.mp-item-amount { font-size: 1rem; font-weight: 700; color: #059669; white-space: nowrap; }
.mp-item-actions { display: flex; gap: 6px; }
.mp-btn { padding: 7px 16px; border-radius: 8px; font-size: .82rem; font-weight: 600; cursor: pointer; transition: all .15s; font-family: 'Outfit', sans-serif; border: none; }
.mp-btn-view { background: #eef2ff; color: #6366f1; }
.mp-btn-view:hover { background: #e0e7ff; }
.mp-btn-download { background: #f0fdf4; color: #059669; }
.mp-btn-download:hover { background: #dcfce7; }
.mp-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.mp-modal { background: #fff; border-radius: 16px; width: 750px; max-width: 94vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(15,23,42,.25); }
.mp-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1.5px solid #e2e8f0; }
.mp-modal-header h3 { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
.mp-modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; padding: 4px 8px; border-radius: 6px; }
.mp-modal-close:hover { background: #f1f5f9; color: #475569; }
.mp-modal-body { padding: 20px 24px; }
.mp-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; }
.mp-btn-secondary { padding: 10px 22px; border-radius: 10px; font-size: .88rem; font-weight: 600; cursor: pointer; font-family: 'Outfit', sans-serif; border: 1.5px solid #e2e8f0; background: #fff; color: #475569; }
.mp-btn-secondary:hover { background: #f1f5f9; }
.mp-btn-primary { padding: 10px 22px; border-radius: 10px; font-size: .88rem; font-weight: 600; cursor: pointer; font-family: 'Outfit', sans-serif; border: none; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; }
.mp-btn-primary:hover { box-shadow: 0 4px 14px rgba(99,102,241,.35); transform: translateY(-1px); }
.mp-detail-grid { display: flex; flex-direction: column; gap: 20px; }
.mp-detail-section h4 { margin: 0 0 10px; font-family: 'Outfit', sans-serif; font-size: .95rem; font-weight: 700; color: #1e293b; }
.mp-detail-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: .85rem; }
.mp-detail-row span:first-child { color: #64748b; }
.mp-detail-row span:last-child { color: #1e293b; font-weight: 500; }
.mp-modal-pdf { width: 900px; max-width: 96vw; }
`;
