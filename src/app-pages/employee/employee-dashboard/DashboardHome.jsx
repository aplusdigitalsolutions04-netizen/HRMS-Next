import React, { useState, useEffect, useCallback } from 'react';
import useStatusMaster, { pillStyle } from '../../shared/useStatusMaster';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMins = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
const fmtHM = (mins) => (mins === null || mins < 0 ? '--' : `${Math.floor(mins / 60)}h ${pad(Math.round(mins % 60))}m`);

// Today's check-in / check-out and the last 7 days. It re-reads by itself every 30 seconds, because
// the server pulls punches from TeamOffice in the background - nothing to click.
function TodayCard() {
  const sm = useStatusMaster();
  const [recs, setRecs] = useState({});
  const [now, setNow] = useState(new Date());

  const read = useCallback(() => {
    const d = new Date();
    const months = [[d.getMonth() + 1, d.getFullYear()]];
    if (d.getDate() < 7) { const pm = new Date(d.getFullYear(), d.getMonth() - 1, 1); months.push([pm.getMonth() + 1, pm.getFullYear()]); }
    Promise.all(months.map(([m, y]) => fetch(`${API}/my-attendance/records?page=1&per_page=31&sort=date&order=desc&month=${m}&year=${y}`, { headers: auth() }).then(r => r.json()).catch(() => ({}))))
      .then(list => {
        const map = {};
        for (const j of list) for (const r of (j.records || [])) if (r.date_str) map[r.date_str] = r;
        setRecs(map);
      });
  }, []);

  useEffect(() => {
    read();
    const tick = () => {
      if (document.hidden) return;
      fetch(`${API}/my-attendance/live`, { method: 'POST', headers: auth() }).catch(() => {}).finally(read);
      setNow(new Date());
    };
    const id = setInterval(tick, 30000);
    const clock = setInterval(() => setNow(new Date()), 60000);
    return () => { clearInterval(id); clearInterval(clock); };
  }, [read]);

  const today = recs[ymd(now)];
  const inM = toMins(today && today.in_time), outM = toMins(today && today.out_time);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const worked = inM === null ? null : (outM !== null ? outM - inM : nowM - inM);
  const st = today ? sm.find('attendance', today.status) : null;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return d; });

  return (
    <div className="emp-card td-card">
      <div className="emp-card-header">
        <h3>Today</h3>
        {st
          ? <span style={pillStyle(st.color)} title={st.description}>{st.label}</span>
          : <span style={pillStyle('#64748b')}>Not checked in yet</span>}
      </div>
      <div className="td-tiles">
        <div className="td-tile"><span>Check-in</span><b>{today && today.in_time ? today.in_time : '--:--'}</b></div>
        <div className="td-tile"><span>Check-out</span><b>{today && today.out_time ? today.out_time : '--:--'}</b></div>
        <div className="td-tile"><span>{outM === null && inM !== null ? 'Working so far' : 'Hours worked'}</span><b>{fmtHM(worked)}</b></div>
      </div>
      <div className="td-week">
        {days.map(d => {
          const r = recs[ymd(d)];
          const s2 = r ? sm.find('attendance', r.status) : null;
          const isToday = ymd(d) === ymd(now);
          return (
            <div key={ymd(d)} className="td-day" title={s2 ? `${d.toDateString()}: ${s2.label}` : d.toDateString()}>
              <div className={`td-dot${isToday ? ' today' : ''}`} style={s2 ? { background: s2.color + '22', color: s2.color, borderColor: s2.color + '66' } : undefined}>{s2 ? s2.code : '-'}</div>
              <span>{d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HolidaysCard() {
  const [list, setList] = useState(null);
  useEffect(() => {
    const y = new Date().getFullYear();
    Promise.all([y, y + 1].map(yy => fetch(`${API}/settings/holidays?year=${yy}`, { headers: auth() }).then(r => r.json()).catch(() => ({}))))
      .then(([a, b]) => {
        const todayStr = ymd(new Date());
        setList([...(a.holidays || []), ...(b.holidays || [])].filter(h => h.holiday_date >= todayStr).slice(0, 4));
      });
  }, []);
  const left = (s) => { const [y, m, d] = s.split('-').map(Number); const n = Math.round((new Date(y, m - 1, d) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`; };
  return (
    <div className="emp-card td-card">
      <div className="emp-card-header"><h3>Upcoming Holidays</h3></div>
      {list === null ? null : list.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 13, padding: '14px 0' }}>No upcoming holidays.</div>
      ) : list.map(h => {
        const [y, m, d] = h.holiday_date.split('-').map(Number);
        return (
          <div key={h.holiday_date} className="td-hol">
            <div className="td-hol-d"><b>{pad(d)}</b><span>{new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short' })}</span></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })}</div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#ea580c', whiteSpace: 'nowrap' }}>{left(h.holiday_date)}</span>
          </div>
        );
      })}
    </div>
  );
}

const homeStyles = `
.td-row { display:grid; grid-template-columns: 3fr 2fr; gap:16px; margin-bottom:20px; }
.td-card { margin-bottom:0 !important; }
.td-tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:14px 0 16px; }
.td-tile { background:#f8fafc; border:1px solid #eef2f7; border-radius:12px; padding:10px 14px; }
.td-tile span { display:block; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#94a3b8; }
.td-tile b { display:block; font-family:'Outfit',sans-serif; font-weight:700; font-size:1.2rem; color:#0f172a; margin-top:2px; }
.td-week { display:flex; justify-content:space-between; gap:6px; border-top:1px solid #f1f5f9; padding-top:12px; }
.td-day { display:flex; flex-direction:column; align-items:center; gap:4px; }
.td-day span { font-size:.68rem; color:#94a3b8; font-weight:600; }
.td-dot { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.7rem; font-weight:700; background:#f1f5f9; color:#94a3b8; border:1.5px solid #e2e8f0; }
.td-dot.today { box-shadow:0 0 0 3px #e0e7ff; }
.td-hol { display:flex; align-items:center; gap:12px; padding:9px 0; border-bottom:1px solid #f8fafc; }
.td-hol:last-child { border-bottom:none; }
.td-hol-d { width:44px; text-align:center; border-radius:10px; padding:4px 0 5px; background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; flex-shrink:0; }
.td-hol-d b { display:block; font-family:'Outfit',sans-serif; font-size:1.05rem; line-height:1.1; }
.td-hol-d span { font-size:.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
@media (max-width: 900px) { .td-row { grid-template-columns: 1fr; } .td-tiles { grid-template-columns: 1fr 1fr 1fr; } }
`;

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

      <style>{homeStyles}</style>
      <div className="td-row">
        <TodayCard />
        <HolidaysCard />
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
