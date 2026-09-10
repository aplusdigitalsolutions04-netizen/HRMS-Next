import React from 'react';

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DashboardHome({ greeting, empName, presentDays, totalAttDays, leaveDays, docCount, notificationsCount, monthlyAtt, attMonthIdx, setAttMonthIdx, hasAttData, maxAtt, absentDays }) {
  return (
    <>
      <div className="emp-banner">
        <div className="emp-banner-content">
          <h1>{greeting}, {empName}</h1>
          <p>Have a great day ahead! Here's what's happening with you today.</p>
        </div>
        <div className="emp-banner-waves" />
      </div>

      <div className="emp-stats">
        <div className="emp-stat-card">
          <div className="emp-stat-header">
            <div className="emp-stat-icon" style={{ background: '#eef2ff' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
          </div>
          <div className="emp-stat-value">{presentDays} / {totalAttDays} Days</div>
          <div className="emp-stat-label">This Month</div>
        </div>
        <div className="emp-stat-card">
          <div className="emp-stat-header">
            <div className="emp-stat-icon" style={{ background: '#fef3c7' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
          </div>
          <div className="emp-stat-value">{leaveDays} Days</div>
          <div className="emp-stat-label">Leave Taken</div>
        </div>
        <div className="emp-stat-card">
          <div className="emp-stat-header">
            <div className="emp-stat-icon" style={{ background: '#dbeafe' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
          </div>
          <div className="emp-stat-value">{docCount}</div>
          <div className="emp-stat-label">Documents Available</div>
        </div>
        <div className="emp-stat-card">
          <div className="emp-stat-header">
            <div className="emp-stat-icon" style={{ background: '#fce4ec' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </div>
          </div>
          <div className="emp-stat-value">{notificationsCount}</div>
          <div className="emp-stat-label">Notifications</div>
        </div>
      </div>

      <div className="emp-card" style={{ marginBottom: 28 }}>
        <div className="emp-card-header">
          <h3>Attendance Overview</h3>
          {monthlyAtt.length > 0 && (
            <select value={attMonthIdx} onChange={e => setAttMonthIdx(Number(e.target.value))}>
              {monthlyAtt.map((d, i) => <option key={i} value={i}>{monthNames[d.month - 1]} {d.year}</option>)}
            </select>
          )}
        </div>
        <div className="att-legend">
          <div className="att-legend-item">
            <div className="att-legend-dot" style={{ background: '#10b981' }} />
            <span>Present ({presentDays})</span>
          </div>
          <div className="att-legend-item">
            <div className="att-legend-dot" style={{ background: '#ef4444' }} />
            <span>Absent ({absentDays})</span>
          </div>
          <div className="att-legend-item">
            <div className="att-legend-dot" style={{ background: '#f59e0b' }} />
            <span>Leave ({leaveDays})</span>
          </div>
        </div>
        <div className="att-chart">
          {hasAttData ? monthlyAtt.map((d, i) => {
            const p = Number(d.present), a = Number(d.absent), l = Number(d.leave);
            const ph = (p / maxAtt) * 100;
            const ah = (a / maxAtt) * 100;
            const lh = (l / maxAtt) * 100;
            return (
              <div key={i} className="att-chart-bar-wrap">
                <div className="att-chart-bars">
                  <div className="att-chart-bar" style={{ height: `${ph}%`, background: '#10b981', minHeight: p > 0 ? 4 : 0 }} />
                  <div className="att-chart-bar" style={{ height: `${ah}%`, background: '#ef4444', minHeight: a > 0 ? 4 : 0 }} />
                  <div className="att-chart-bar" style={{ height: `${lh}%`, background: '#f59e0b', minHeight: l > 0 ? 4 : 0 }} />
                </div>
                <span className="att-chart-label">{monthNames[d.month - 1]}</span>
              </div>
            );
          }) : (
            <div style={{ width: '100%', textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 20 }}>
              No attendance data available yet. HR will upload it.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
