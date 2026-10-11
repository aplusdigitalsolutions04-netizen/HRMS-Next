import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';
import { Tabs } from '@/lib/ui-motion';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const TYPES = [
  { id: 'attendance', label: 'Attendance', hint: 'Days present, absent, half day, extra work and hours for every employee.' },
  { id: 'leave', label: 'Leave', hint: 'Every leave request that falls in the dates, with a summary by type.' },
  { id: 'headcount', label: 'Headcount', hint: 'Employees by department on the To date, with joiners and leavers.' },
  { id: 'attrition', label: 'Attrition', hint: 'Who left in the dates, plus the attrition rate.' },
];

const presets = () => {
  const n = new Date();
  const first = new Date(n.getFullYear(), n.getMonth(), 1);
  const lastPrevEnd = new Date(n.getFullYear(), n.getMonth(), 0);
  const lastPrevStart = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  const q = new Date(n.getFullYear(), n.getMonth() - 2, 1);
  const fy = new Date(n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1, 3, 1);
  return [
    { label: 'This month', from: ymd(first), to: ymd(n) },
    { label: 'Last month', from: ymd(lastPrevStart), to: ymd(lastPrevEnd) },
    { label: 'Last 3 months', from: ymd(q), to: ymd(n) },
    { label: 'This financial year', from: ymd(fy), to: ymd(n) },
  ];
};

export default function Reports() {
  const P = presets();
  const [type, setType] = useState('attendance');
  const [from, setFrom] = useState(P[0].from);
  const [to, setTo] = useState(P[0].to);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const run = useCallback(async (t = type, f = from, tt = to) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/reports/${t}?from=${f}&to=${tt}`, { headers: auth() });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not build the report');
      setReport(d); setPage(1);
    } catch (e) { setReport(null); setError(e.message); }
    finally { setLoading(false); }
  }, [type, from, to]);

  useEffect(() => { run(); }, []);

  const download = async (format) => {
    setExporting(format);
    try {
      const res = await fetch(`${API}/reports/${type}?from=${from}&to=${to}&format=${format}`, { headers: auth() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Export failed'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${type}-report_${from}_to_${to}.${format}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setExporting(''); }
  };

  const cur = TYPES.find(t => t.id === type);
  const rows = report ? paginate(report.rows, page, pageSize) : [];

  return (
    <div>
      <style>{`
        .rp-sum { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:12px; }
        .rp-sum div { background:#fff; border:1px solid #e8edf6; border-radius:12px; padding:10px 14px; }
        .rp-sum span { display:block; font-size:.72rem; font-weight:600; color:#64748b; }
        .rp-sum b { font-family:'Outfit',sans-serif; font-size:1.25rem; color:#0f172a; }
        .rp-t { width:100%; border-collapse:collapse; }
        .rp-t th { background:#f8fafc; color:#64748b; font-weight:700; text-transform:uppercase; font-size:.68rem; letter-spacing:.4px; padding:9px 12px; border-bottom:1px solid #e8edf6; text-align:left; white-space:nowrap; }
        .rp-t td { padding:8px 12px; font-size:.82rem; color:#334155; border-bottom:1px solid #f4f6fa; white-space:nowrap; }
        .rp-t .r { text-align:right; }
        .rp-chips { display:flex; gap:6px; flex-wrap:wrap; }
        .rp-chip { border:1px solid #e2e8f0; background:#fff; color:#475569; font-size:.76rem; font-weight:600; padding:5px 11px; border-radius:20px; cursor:pointer; }
        .rp-chip:hover { border-color:#93c5fd; color:#1d4ed8; }
      `}</style>

      <div className="ph">
        <div>
          <h1>Reports</h1>
          <p>Pick a report and the dates, check it on screen, then download it as Excel or PDF.</p>
        </div>
        <div className="ph-actions">
          <button className="btn-o" disabled={!report || exporting} onClick={() => download('xlsx')}>{exporting === 'xlsx' ? 'Preparing...' : 'Export Excel'}</button>
          <button className="btn-p" disabled={!report || exporting} onClick={() => download('pdf')}>{exporting === 'pdf' ? 'Preparing...' : 'Export PDF'}</button>
        </div>
      </div>

      <div className="tabs-bar">
        <Tabs id="report-type" value={type} onChange={v => { setType(v); run(v, from, to); }} tabs={TYPES.map(t => ({ id: t.id, label: t.label }))} />
      </div>
      <p style={{ margin: '0 0 8px', fontSize: '.82rem', color: '#64748b' }}>{cur.hint}</p>

      <div className="filters">
        <label style={{ fontSize: '.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>From <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
        <label style={{ fontSize: '.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>To <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        <button className="btn-p" onClick={() => run()} disabled={loading}>{loading ? 'Building...' : 'Run report'}</button>
        <div className="rp-chips">
          {P.map(p => <button key={p.label} className="rp-chip" onClick={() => { setFrom(p.from); setTo(p.to); run(type, p.from, p.to); }}>{p.label}</button>)}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}

      {report && (
        <>
          <div className="rp-sum">{report.summary.map(s => <div key={s.label}><span>{s.label}</span><b>{s.value}</b></div>)}</div>
          <div style={{ background: '#fff', border: '1px solid #e8edf6', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #eef2f7', fontSize: '.8rem', color: '#64748b' }}>{report.subtitle}</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="rp-t">
                <thead><tr><th style={{ width: 40 }}>#</th>{report.columns.map(c => <th key={c.key} className={c.align === 'right' ? 'r' : ''}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={report.columns.length + 1} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>No data for these dates.</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                      {report.columns.map(c => <td key={c.key} className={c.align === 'right' ? 'r' : ''}>{r[c.key] === '' || r[c.key] == null ? '-' : String(r[c.key])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0 14px 12px' }}>
              <Pagination page={page} totalItems={report.rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="rows" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
