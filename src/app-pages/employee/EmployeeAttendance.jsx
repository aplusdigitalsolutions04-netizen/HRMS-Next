import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];


function Donut({ pct, size = 120, sw = 16, color = '#6366f1', bg = '#f1f5f9' }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const gap = circ - dash;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${dash} ${gap}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  );
}

export default function EmployeeAttendance() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);

  const [records, setRecords] = useState({ records: [], total: 0, page: 1, per_page: 15, total_pages: 1 });
  const [insights, setInsights] = useState(null);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsSort, setRecordsSort] = useState('date');
  const [recordsOrder, setRecordsOrder] = useState('desc');


  const fetchAll = useCallback(() => {
    const h = auth();
    setLoading(true);
    Promise.all([
      fetch(`${API}/my-attendance/summary`, { headers: h }).then(r => r.json()).catch(() => null),
      fetch(`${API}/my-attendance/monthly`, { headers: h }).then(r => r.json()).catch(() => ({ months: [] })),
      fetch(`${API}/my-attendance/insights`, { headers: h }).then(r => r.json()).catch(() => null),
    ]).then(([s, m, i]) => {
      setSummary(s);
      const months = m?.months || [];
      setMonthly(months);
      setInsights(i);
      if (months.length > 0) {
        const last = months[0];
        setMonth(last.month);
        setYear(last.year);
      }
      setLoading(false);
    });
  }, []);

  const fetchRecords = useCallback(() => {
    fetch(`${API}/my-attendance/records?page=${recordsPage}&per_page=31&sort=${recordsSort}&order=${recordsOrder}&month=${month}&year=${year}`, { headers: auth() })
      .then(r => r.json()).then(d => { if (d && Array.isArray(d.records)) setRecords(d); }).catch(() => {});
  }, [recordsPage, recordsSort, recordsOrder, month, year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'USER') navigate('/');
  }, []);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  };

  const exportReport = () => {
    fetch(`${API}/my-attendance/calendar/export?month=${month}&year=${year}`, { headers: auth() })
      .then(r => {
        if (!r.ok) throw new Error("Export failed");
        return r.blob();
      })
      .then(blob => {
        const monthName = new Date(year, month - 1).toLocaleDateString('en', { month: 'long' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Attendance_Report_${monthName}_${year}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(e => alert("Export failed. Check server connection."));
  };

  const pct = (val, total) => total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
  const curMonth = monthly.find(m => m.month === month && m.year === year) || { present: 0, absent: 0, leave: 0, working_hours: 0 };
  const summaryTotal = 22;
  const attendancePct = summaryTotal > 0 ? ((curMonth.present / summaryTotal) * 100).toFixed(1) : '0.0';
  const lastMonth = monthly[monthly.length - 2] || { present: 0, absent: 0, leave: 0 };
  const lastTotal = (lastMonth.present || 0) + (lastMonth.absent || 0) + (lastMonth.leave || 0);
  const prevPct = lastTotal > 0 ? ((lastMonth.present / lastTotal) * 100).toFixed(1) : '0.0';
  const improvement = (parseFloat(attendancePct) - parseFloat(prevPct)).toFixed(1);

  const statusBadge = parseFloat(attendancePct) >= 95 ? 'Excellent Attendance'
    : parseFloat(attendancePct) >= 85 ? 'Good Attendance'
    : 'Needs Improvement';

  const badgeColor = parseFloat(attendancePct) >= 95 ? '#10b981'
    : parseFloat(attendancePct) >= 85 ? '#f59e0b'
    : '#ef4444';

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'records', label: 'Monthly Records' },
    { key: 'punch', label: 'Punch History' },
  ];

  const punchRecords = ((records?.records) || []).filter(r => r.in_time || r.out_time);
  const _toMins = (t) => {
    if (!t || t === '--:--') return null;
    t = t.trim();
    let ampm = null;
    const u = t.toUpperCase();
    if (u.endsWith('AM') || u.endsWith('PM')) { ampm = u.slice(-2); t = t.slice(0, -2).trim(); }
    let h, m;
    if (t.includes(':')) {
      const p = t.split(':');
      h = parseInt(p[0].replace(/\D/g, '')) || 0;
      m = parseInt(p[1].replace(/\D/g, '')) || 0;
    } else {
      const d = t.replace(/\D/g, '');
      if (!d) return null;
      if (d.length <= 2) { h = parseInt(d); m = 0; }
      else if (d.length === 3) { h = parseInt(d[0]); m = parseInt(d.slice(1)); }
      else { h = parseInt(d.slice(0, 2)); m = parseInt(d.slice(2, 4)); }
    }
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };
  const _fmtMins = (mins) => {
    const total = Math.round(mins);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const calcHours = (inTime, outTime) => {
    const inM = _toMins(inTime);
    const outM = _toMins(outTime);
    if (inM === null || outM === null) return 0;
    const diff = outM - inM;
    return diff > 0 ? diff / 60 : 0;
  };
  const punchDates = punchRecords.map(r => ({ date: r.date, in_time: r.in_time, out_time: r.out_time }));
  const totalHours = punchDates.reduce((s, d) => s + calcHours(d.in_time, d.out_time), 0);
  const inMins = punchDates.map(d => _toMins(d.in_time)).filter(v => v !== null);
  const outMins = punchDates.map(d => _toMins(d.out_time)).filter(v => v !== null);
  const avgIn = inMins.length > 0 ? _fmtMins(inMins.reduce((s, v) => s + v, 0) / inMins.length) : null;
  const avgOut = outMins.length > 0 ? _fmtMins(outMins.reduce((s, v) => s + v, 0) / outMins.length) : null;

  return (
    <div style={{ maxWidth: '100%', padding: '0 24px' }}>
      <style>{`
        .ea-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .ea-header-left { display: flex; align-items: center; gap: 14px; }
        .ea-header-icon { display: none; }
        .ea-header h1 { font-size: 24px; font-weight: 700; color: #0f172a; font-family: 'Outfit', sans-serif; }
        .ea-header p { display: none; }
        .ea-header-right { display: flex; align-items: center; gap: 10px; }

        .ea-month-btn { padding: 8px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; cursor: pointer; color: #64748b; font-size: 14px; display: flex; align-items: center; gap: 6px; font-family: inherit; }
        .ea-month-btn:hover { border-color: #6366f1; color: #6366f1; }
        .ea-month-label { font-size: 16px; font-weight: 600; color: #0f172a; min-width: 120px; text-align: center; }
        .ea-export-btn { padding: 8px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: inherit; }
        .ea-export-btn:hover { box-shadow: 0 4px 12px rgba(99,102,241,0.3); transform: translateY(-1px); }

        .ea-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: #f1f5f9; border-radius: 10px; padding: 4px; overflow-x: auto; }
        .ea-tab { padding: 8px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; white-space: nowrap; background: none; color: #64748b; font-family: inherit; }
        .ea-tab:hover { color: #0f172a; }
        .ea-tab.active { background: #fff; color: #6366f1; box-shadow: 0 1px 3px rgba(0,0,0,0.06); font-weight: 600; }

        .ea-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
        .ea-card { background: #fff; border-radius: 14px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .ea-card:hover { transform: none; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .ea-card-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .ea-card-value { font-size: 28px; font-weight: 700; color: #0f172a; font-family: 'Outfit', sans-serif; margin: 6px 0 4px; }
        .ea-card-sub { font-size: 12px; color: #94a3b8; }

        .ea-analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
        .ea-donut-wrap { display: flex; flex-direction: column; align-items: center; padding: 10px 0; }
        .ea-donut-label { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 8px; font-family: 'Outfit', sans-serif; }
        .ea-donut-sub { font-size: 22px; font-weight: 700; color: #6366f1; font-family: 'Outfit', sans-serif; }
        .ea-donut-legend { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; justify-content: center; }
        .ea-donut-legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; }
        .ea-donut-dot { width: 9px; height: 9px; border-radius: 4px; }

        .ea-insight-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ea-insight-card { background: #f8fafc; border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
        .ea-insight-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
        .ea-insight-value { font-size: 16px; font-weight: 700; color: #0f172a; font-family: 'Outfit', sans-serif; }
        .ea-insight-change { font-size: 13px; font-weight: 600; }

        .ea-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 18px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }

        .ea-table-wrap { overflow-x: auto; }
        .ea-records .ea-table, .ea-punch .ea-table { width: 100%; border-collapse: collapse; }
        .ea-records .ea-table th, .ea-punch .ea-table th { text-align: left; padding: 10px 14px; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #f1f5f9; cursor: pointer; white-space: nowrap; }
        .ea-records .ea-table th:hover, .ea-punch .ea-table th:hover { color: #6366f1; }
        .ea-records .ea-table td, .ea-punch .ea-table td { padding: 10px 14px; font-size: 14px; color: #334155; border-bottom: 1px solid #f8fafc; }
        .ea-records .ea-table tr:hover td, .ea-punch .ea-table tr:hover td { background: #fafaff; }
        .ea-records .ea-status, .ea-punch .ea-status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; }
        .ea-records .ea-pagination, .ea-punch .ea-pagination { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; }
        .ea-records .ea-page-btn, .ea-punch .ea-page-btn { padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 13px; color: #64748b; font-family: inherit; }
        .ea-records .ea-page-btn:hover, .ea-punch .ea-page-btn:hover { border-color: #6366f1; color: #6366f1; }
        .ea-records .ea-page-btn.active, .ea-punch .ea-page-btn.active { background: #6366f1; color: #fff; border-color: #6366f1; }
        .ea-records .ea-page-btn:disabled, .ea-punch .ea-page-btn:disabled { opacity: 0.4; cursor: default; }
        .ea-punch .ea-grid-4 { gap: 14px; margin-bottom: 20px; }
        .ea-punch .ea-insight-card { background: #f8fafc; border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 4px; }
        .ea-punch .ea-insight-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .ea-punch .ea-insight-value { font-size: 20px; font-weight: 700; color: #0f172a; font-family: 'Outfit', sans-serif; }

        .ea-skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        .ea-empty { text-align: center; padding: 20px 16px; color: #94a3b8; }
        .ea-empty svg { margin-bottom: 6px; opacity: 0.4; }
        .ea-empty h3 { font-size: 13px; font-weight: 600; color: #64748b; margin-bottom: 4px; font-family: 'Outfit', sans-serif; }
        .ea-empty p { font-size: 11px; }

        @media (max-width: 768px) {
          .ea-grid-4 { grid-template-columns: repeat(2, 1fr); }
          .ea-analytics-grid { grid-template-columns: 1fr; }
          .ea-insight-cards { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="ea-header">
        <div className="ea-header-left">
          <div className="ea-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <h1>My Attendance</h1>
            <p>Track your attendance and view your monthly summary.</p>
          </div>
        </div>
        <div className="ea-header-right">
          <button className="ea-month-btn" onClick={() => changeMonth(-1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="ea-month-label">{monthNames[month - 1]} {year}</span>
          <button className="ea-month-btn" onClick={() => changeMonth(1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button className="ea-export-btn" onClick={exportReport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Report
          </button>
        </div>
      </div>

      <div className="ea-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`ea-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <div>
          <div className="ea-grid-4">
            {[1,2,3,4].map(i => <div key={i} className="ea-card"><div className="ea-skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} /><div className="ea-skeleton" style={{ height: 32, width: '40%', marginBottom: 6 }} /><div className="ea-skeleton" style={{ height: 12, width: '50%' }} /></div>)}
          </div>
          <div className="ea-card"><div className="ea-skeleton" style={{ height: 200 }} /></div>
        </div>
      ) : summaryTotal === 0 && activeTab === 'overview' ? (
        <div className="ea-card ea-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <h3>No attendance records available yet</h3>
          <p>Your attendance information will appear here once uploaded by HR.</p>
        </div>
      ) : (
        <>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              <div className="ea-badge" style={{ background: `${badgeColor}14`, color: badgeColor }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {parseFloat(attendancePct) >= 95 ? <polyline points="20 6 9 17 4 12" /> : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                </svg>
                {statusBadge} — {attendancePct}%
              </div>

              <div className="ea-grid-4">
                <div className="ea-card">
                  <div className="ea-card-label">Present Days</div>
                  <div className="ea-card-value" style={{ color: '#10b981' }}>{curMonth.present || 0}</div>
                  <div className="ea-card-sub">{summaryTotal > 0 ? `${((curMonth.present / summaryTotal) * 100).toFixed(2)}% of working days` : 'No records'}</div>
                </div>
                <div className="ea-card">
                  <div className="ea-card-label">Absent Days</div>
                  <div className="ea-card-value" style={{ color: '#ef4444' }}>{curMonth.absent || 0}</div>
                  <div className="ea-card-sub">{summaryTotal > 0 ? `${((curMonth.absent / summaryTotal) * 100).toFixed(2)}% of working days` : 'No records'}</div>
                </div>
                <div className="ea-card">
                  <div className="ea-card-label">Leave Days</div>
                  <div className="ea-card-value" style={{ color: '#f59e0b' }}>{curMonth.leave || 0}</div>
                  <div className="ea-card-sub">{summaryTotal > 0 ? `${((curMonth.leave / summaryTotal) * 100).toFixed(2)}% of working days` : 'No records'}</div>
                </div>
                <div className="ea-card">
                  <div className="ea-card-label">Total Working Days</div>
                  <div className="ea-card-value">{summaryTotal}</div>
                  <div className="ea-card-sub">{monthNames[month - 1]} {year}</div>
                </div>
              </div>

              <div className="ea-analytics-grid">
                <div className="ea-card">
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 10, fontFamily: "'Outfit', sans-serif" }}>Attendance Distribution</h3>
                  <div className="ea-donut-wrap">
                    <Donut pct={parseFloat(attendancePct)} />
                    <div className="ea-donut-label">Attendance Rate</div>
                    <div className="ea-donut-sub">{attendancePct}%</div>
                    <div className="ea-donut-legend">
                      <div className="ea-donut-legend-item"><div className="ea-donut-dot" style={{ background: '#10b981' }} />Present ({curMonth.present})</div>
                      <div className="ea-donut-legend-item"><div className="ea-donut-dot" style={{ background: '#ef4444' }} />Absent ({curMonth.absent})</div>
                      <div className="ea-donut-legend-item"><div className="ea-donut-dot" style={{ background: '#f59e0b' }} />Leave ({curMonth.leave})</div>
                    </div>
                  </div>
                </div>

                <div className="ea-card">
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 10, fontFamily: "'Outfit', sans-serif" }}>Attendance Analytics</h3>
                  <div className="ea-insight-cards">
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Attendance %</div>
                      <div className="ea-insight-value">{attendancePct}%</div>
                    </div>
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Monthly Trend</div>
                      <div className="ea-insight-value">{monthly.length > 1 ? `${monthly[monthly.length - 1].present} days` : '—'}</div>
                    </div>
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Consistency Score</div>
                      <div className="ea-insight-value">{insights?.consistency_score || 0}%</div>
                    </div>
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Improvement</div>
                      <div className="ea-insight-value" style={{ color: parseFloat(improvement) >= 0 ? '#10b981' : '#ef4444' }}>
                        {parseFloat(improvement) >= 0 ? '+' : ''}{improvement}%
                        <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 4 }}>vs last month</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>



            </>
          )}

          {/* MONTHLY RECORDS TAB */}
          {activeTab === 'records' && (
            <div className="ea-card ea-records">
              <div className="ea-table-wrap">
                <table className="ea-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th onClick={() => { setRecordsSort('date'); setRecordsOrder(recordsOrder === 'asc' ? 'desc' : 'asc'); }}>
                        Date {recordsSort === 'date' ? (recordsOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th>Day</th>
                      <th>Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Working Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(records?.records || []).length > 0 ? records.records.map((r, idx) => {
                      const stMap = { 'P': 'Present', 'A': 'Absent', 'WO': 'Week Off', 'PL': 'Planned Leave', 'CL': 'Casual Leave', 'SL': 'Sick Leave', 'NH': 'National Holiday', 'WFH': 'Work From Home' };
                      const stLabel = stMap[r.status] || r.status;
                      const stColor = r.status === 'P' ? '#10b981' : r.status === 'A' ? '#ef4444' : r.status === 'WO' ? '#94a3b8' : '#f59e0b';
                      const stBg = r.status === 'P' ? '#ecfdf5' : r.status === 'A' ? '#fef2f2' : r.status === 'WO' ? '#f8fafc' : '#fffbeb';
                      const hrs = r.working_hours || 0;
                      const hrsStr = hrs > 0 ? `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m` : '—';
                      return (
                        <tr key={r.id}>
                          <td style={{ color: '#94a3b8' }}>{((records.page || 1) - 1) * (records.per_page || 31) + idx + 1}</td>
                          <td style={{ fontWeight: 500 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td style={{ color: '#64748b' }}>{r.day}</td>
                          <td><span className="ea-status" style={{ background: stBg, color: stColor }}>{stLabel}</span></td>
                          <td>{r.in_time || '—'}</td>
                          <td>{r.out_time || '—'}</td>
                          <td>{hrsStr}</td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No attendance records for this month</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(records?.total_pages || 1) > 1 && (
                <div className="ea-pagination">
                  <button className="ea-page-btn" disabled={records.page <= 1} onClick={() => setRecordsPage(records.page - 1)}>Prev</button>
                  {Array.from({ length: records.total_pages }, (_, i) => i + 1).slice(Math.max(0, records.page - 3), records.page + 2).map(p => (
                    <button key={p} className={`ea-page-btn${records.page === p ? ' active' : ''}`} onClick={() => setRecordsPage(p)}>{p}</button>
                  ))}
                  <button className="ea-page-btn" disabled={records.page >= records.total_pages} onClick={() => setRecordsPage(records.page + 1)}>Next</button>
                </div>
              )}
            </div>
          )}

          {/* PUNCH HISTORY TAB */}
          {activeTab === 'punch' && (
            <div className="ea-card ea-punch">
              {punchRecords.length > 0 ? (
                <>
                  <div className="ea-grid-4" style={{ marginBottom: 20 }}>
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Avg Check In</div>
                      <div className="ea-insight-value">{avgIn || '\u2014'}</div>
                    </div>
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Avg Check Out</div>
                      <div className="ea-insight-value">{avgOut || '\u2014'}</div>
                    </div>
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Total Hours</div>
                      <div className="ea-insight-value">{totalHours.toFixed(1)}h</div>
                    </div>
                    <div className="ea-insight-card">
                      <div className="ea-insight-label">Punch Records</div>
                      <div className="ea-insight-value">{punchRecords.length}</div>
                    </div>
                  </div>
                  <div className="ea-table-wrap">
                    <table className="ea-table">
                      <thead>
                        <tr><th style={{ width: 40 }}>#</th><th>Date</th><th>Day</th><th>Check In</th><th>Check Out</th><th>Hours</th></tr>
                      </thead>
                      <tbody>
                        {punchRecords.map((r, idx) => {
                          const hrs = calcHours(r.in_time, r.out_time);
                          return (
                            <tr key={r.date}>
                              <td style={{ color: '#94a3b8' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 500 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                              <td style={{ color: '#64748b' }}>{r.day}</td>
                              <td>{r.in_time || '—'}</td>
                              <td>{r.out_time || '—'}</td>
                              <td>{hrs > 0 ? `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {(records?.total_pages || 1) > 1 && (
                    <div className="ea-pagination">
                      <button className="ea-page-btn" disabled={records.page <= 1} onClick={() => setRecordsPage(records.page - 1)}>Prev</button>
                      {Array.from({ length: records.total_pages }, (_, i) => i + 1).slice(Math.max(0, records.page - 3), records.page + 2).map(p => (
                        <button key={p} className={`ea-page-btn${records.page === p ? ' active' : ''}`} onClick={() => setRecordsPage(p)}>{p}</button>
                      ))}
                      <button className="ea-page-btn" disabled={records.page >= records.total_pages} onClick={() => setRecordsPage(records.page + 1)}>Next</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="ea-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <h3>No punch records available</h3>
                  <p>Punch in/out data will appear here once attendance is uploaded by HR.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
