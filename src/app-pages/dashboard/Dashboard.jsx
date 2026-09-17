import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

function AnimatedValue({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef();
  const startTime = useRef();

  useEffect(() => {
    const target = Number(value) || 0;
    if (target === 0) { setDisplay(0); return; }
    const dur = 600;
    startTime.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / dur, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <>{display}{suffix}</>;
}

const DonutChart = ({ segments, size = 120, sw = 20 }) => {
  const cx = size / 2, cy = size / 2;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
      {segments.map((seg, i) => {
        const pct = seg.value / total, dash = pct * circ, gap = circ - dash, o = offset;
        offset += dash;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-o} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease' }} />;
      })}
    </svg>
  );
};

function Dashboard() {
  const [stats, setStats] = useState({ depts: 0, emps: 0, pendingEmps: 0, candidates: 0, empGrowth: 0 });
  const [candidateList, setCandidateList] = useState([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = sessionStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [deptRes, empRes, pendingRes, candRes, attRes, profileRes] = await Promise.all([
          fetch(`${API}/departments`, { headers }),
          fetch(`${API}/employee/management`, { headers }),
          fetch(`${API}/employee/pending`, { headers }),
          fetch(`${API}/candidate/data`, { headers }),
          fetch(`${API}/attendance/result`, { headers }),
          fetch(`${API}/profile`, { headers }),
        ]);
        if (profileRes.ok) setProfile(await profileRes.json());
        const depts = deptRes.ok ? await deptRes.json() : [];
        const emps = empRes.ok ? await empRes.json() : [];
        const pending = pendingRes.ok ? await pendingRes.json() : [];
        const candidates = candRes.ok ? await candRes.json() : [];
        const attData = attRes.ok ? await attRes.json() : { summary: [] };
        const now = new Date();
        const ago30 = new Date(now); ago30.setDate(ago30.getDate() - 30);
        const ago60 = new Date(now); ago60.setDate(ago60.getDate() - 60);
        const recent30 = emps.filter(e => e.created_on && new Date(e.created_on) >= ago30).length;
        const prev30 = emps.filter(e => e.created_on && new Date(e.created_on) >= ago60 && new Date(e.created_on) < ago30).length;
        setStats({ depts: depts.length || 0, emps: emps.length || 0, pendingEmps: pending.length || 0, candidates: candidates.length || 0, empGrowth: prev30 > 0 ? Math.round(((recent30 - prev30) / prev30) * 100) : recent30 > 0 ? 100 : 0 });
        setCandidateList(Array.isArray(candidates) ? candidates : []);
        setAttendanceSummaries(Array.isArray(attData.summary) ? attData.summary : []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); setTimeout(() => setReady(true), 100); }
    }
    fetchData();
  }, []);

  const attendanceAgg = attendanceSummaries.reduce((acc, s) => {
    acc.present += s.total_present_days || 0;
    acc.absent += s.total_absent_days || 0;
    if (s.performance) {
      s.performance.split(',').map(p => p.trim()).forEach(p => {
        const [k, v] = p.split('=');
        if (k && k.toUpperCase() === 'L' && v) acc.late += parseInt(v, 10) || 0;
      });
    }
    return acc;
  }, { present: 0, absent: 0, late: 0 });

  const attTotal = attendanceAgg.present + attendanceAgg.absent + attendanceAgg.late;
  const attRate = attTotal > 0 ? ((attendanceAgg.present / attTotal) * 100).toFixed(1) : '0.0';

  const now = new Date();
  const upcomingInterviews = candidateList
    .filter(c => c.interview_date && new Date(c.interview_date) > now)
    .sort((a, b) => new Date(a.interview_date) - new Date(b.interview_date))
    .slice(0, 5);

  const fmtInterview = (dt) => {
    if (!dt) return null;
    const d = new Date(dt);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tom = new Date(today); tom.setDate(tom.getDate() + 1);
    const ds = new Date(d); ds.setHours(0, 0, 0, 0);
    const isToday = ds.getTime() === today.getTime();
    const isTomorrow = ds.getTime() === tom.getTime();
    return {
      date: isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      isToday,
    };
  };

  const Skeleton = ({ width = '60%', height = 12 }) => (
    <div className="db-sk" style={{ width, height }} />
  );

  if (loading) {
    return (
        <div className="db-page">
        <style>{`.db-sk { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:dbShimmer 1.2s infinite; border-radius:8px; } @keyframes dbShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} } .db-sk-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:14px; } .db-sk-card { background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9; display:flex; flex-direction:column; gap:12px; } .db-sk-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; } .db-sk-card-lg { background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9; display:flex; flex-direction:column; gap:14px; min-height:320px; }`}</style>
        <div className="db-hdr" style={{ marginBottom:14 }}><div className="db-sk" width="200px" height="26" /><div className="db-sk" width="160px" height="26" /></div>
        <div className="db-sk-grid">
          {[1,2,3,4].map(i => <div key={i} className="db-sk-card"><div className="db-sk" width="40%" height="16" /><div className="db-sk" width="60%" height="34" /><div className="db-sk" width="50%" height="14" /></div>)}
        </div>
        <div className="db-sk-3">
          {[1,2,3].map(i => <div key={i} className="db-sk-card-lg"><div className="db-sk" width="50%" height="16" /><div className="db-sk" width="90%" height="10" /><div className="db-sk" width="80%" height="10" /><div className="db-sk" width="70%" height="10" /><div className="db-sk" width="85%" height="10" /><div className="db-sk" width="40%" height="10" /></div>)}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes dbf { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dbSlUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dbspin { to{transform:rotate(360deg)} }
        @keyframes dbPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes dbGlow { 0%,100%{box-shadow:0 0 8px rgba(99,102,241,.15)} 50%{box-shadow:0 0 20px rgba(99,102,241,.3)} }
        @keyframes dbRipple { to{transform:scale(4);opacity:0} }
        @keyframes dbShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        .db-page { animation:dbf .4s ease both; max-width:1600px; margin:0 auto; width:100%; }

        /* ── Header ── */
        .db-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; gap:10px; }
        .db-hdr-l h1 { margin:0; font-family:'Outfit',sans-serif; font-weight:800; font-size:1.75rem; color:#0f172a; letter-spacing:-0.3px; line-height:1.2; }
        .db-hdr-g { font-size:.9rem; color:#475569; font-weight:500; }
        .db-hdr-r { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .db-rng { padding:6px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:.8rem; outline:none; background:#fff; color:#0f172a; cursor:pointer; font-weight:500; min-width:115px; transition:all .2s; }
        .db-rng:hover { border-color:#94a3b8; }
        .db-rng:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
        .db-rfsh { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; border:1.5px solid #e2e8f0; background:#fff; color:#64748b; cursor:pointer; transition:all .2s; }
        .db-rfsh:hover { background:#f8fafc; border-color:#cbd5e1; color:#334155; transform:translateY(-1px); box-shadow:0 2px 6px rgba(0,0,0,.08); }

        /* ── KPI Row ── */
        .db-kpi { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px; }
        .db-kpi-c {
          background:#fff; border-radius:14px; padding:18px 20px 16px;
          box-shadow:0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04);
          border:1px solid #f1f5f9;
          display:flex; flex-direction:column; gap:0;
          transition:all .3s cubic-bezier(.22,1,.36,1);
          position:relative; overflow:hidden; cursor:default;
        }
        .db-kpi-c::before {
          content:''; position:absolute; top:0; left:0; right:0; height:3px;
          border-radius:14px 14px 0 0;
          transition:height .3s ease;
        }
        .db-kpi-c:hover::before { height:5px; }
        .db-kpi-c:hover {
          box-shadow:0 12px 32px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.06);
          transform:translateY(-3px);
        }
        .db-kpi-c:active { transform:translateY(-1px); }
        .db-kpi-r1 { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .db-kpi-ic { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:transform .3s ease; }
        .db-kpi-c:hover .db-kpi-ic { transform:scale(1.1); }
        .db-kpi-ic svg { width:16px; height:16px; }
        .db-kpi-t { font-size:.72rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.3px; }
        .db-kpi-v { font-size:1.9rem; font-weight:800; color:#0f172a; font-family:'Outfit',sans-serif; line-height:1.1; margin-bottom:4px; }
        .db-kpi-r3 { display:flex; align-items:center; gap:8px; }
        .db-kpi-gr { display:inline-flex; align-items:center; gap:3px; font-size:.72rem; font-weight:700; padding:2px 7px; border-radius:5px; }
        .db-kpi-gr.up { background:#ecfdf5; color:#065f46; }
        .db-kpi-gr.down { background:#fef2f2; color:#991b1b; }
        .db-kpi-d { font-size:.72rem; color:#94a3b8; }
        .db-kpi-lk { font-size:.72rem; font-weight:600; color:#6366f1; text-decoration:none; margin-left:auto; white-space:nowrap; opacity:0; transform:translateX(-4px); transition:all .25s; }
        .db-kpi-c:hover .db-kpi-lk { opacity:1; transform:translateX(0); }

        /* ── 3-col row ── */
        .db-3col { display:grid; grid-template-columns:1fr 1fr; gap:28px; flex:1; min-height:0; }

        .db-card {
          background:#fff; border-radius:20px;
          box-shadow:0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04);
          border:1px solid #f1f5f9;
          overflow:hidden;
          transition:all .3s cubic-bezier(.22,1,.36,1);
          display:flex; flex-direction:column;
        }
        .db-card:hover {
          box-shadow:0 12px 32px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.06);
          transform:translateY(-2px);
        }
        .db-card-hdr { display:flex; align-items:center; justify-content:space-between; padding:26px 28px 0; flex-shrink:0; }
        .db-card-ttl { font-family:'Outfit',sans-serif; font-weight:700; font-size:1.3rem; color:#0f172a; }
        .db-card-flt select {
          padding:7px 12px; border:1.5px solid #e2e8f0; border-radius:8px;
          font-size:.85rem; outline:none; background:#fff; color:#475569; cursor:pointer; font-weight:500;
          transition:all .2s;
        }
        .db-card-flt select:hover { border-color:#94a3b8; }
        .db-card-flt select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
        .db-card-bd { padding:22px 28px 26px; flex:1; display:flex; flex-direction:column; min-height:0; }

        /* ── Attendance ── */
        .db-att { display:flex; gap:18px; align-items:center; flex:1; min-height:0; }
        .db-att-cw { flex-shrink:0; position:relative; }
        .db-att-cw svg { filter:drop-shadow(0 2px 4px rgba(0,0,0,.06)); }
        .db-att-cl { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; pointer-events:none; }
        .db-att-cp { font-size:1.5rem; font-weight:800; color:#0f172a; font-family:'Outfit',sans-serif; line-height:1; }
        .db-att-cs { font-size:.72rem; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.2px; margin-top:1px; }
        .db-att-r { flex:1; display:flex; flex-direction:column; gap:0; min-height:0; }
        .db-att-m { display:flex; flex-direction:column; gap:8px; }
        .db-att-row { display:flex; align-items:center; gap:10px; height:34px; transition:background .2s; border-radius:6px; padding:0 8px; margin:0 -8px; }
        .db-att-row:hover { background:#f8fafc; }
        .db-att-dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; }
        .db-att-rl { flex:1; font-size:.95rem; font-weight:500; color:#475569; }
        .db-att-rc { font-size:1rem; font-weight:700; color:#0f172a; min-width:34px; text-align:right; }
        .db-att-rp { font-size:.9rem; font-weight:600; color:#94a3b8; min-width:54px; text-align:right; }
        .db-att-rate { display:flex; align-items:center; justify-content:space-between; padding-top:12px; margin-top:11px; border-top:1px solid #f1f5f9; }
        .db-att-rlbl { font-size:.85rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.3px; }
        .db-att-rval { font-size:1.4rem; font-weight:800; color:#0f172a; font-family:'Outfit',sans-serif; line-height:1; }

        /* ── Upcoming Interviews ── */
        .db-ivw { flex:1; display:flex; flex-direction:column; gap:0; min-height:0; }
        .db-ivw-link { font-size:.9rem; font-weight:600; color:#6366f1; text-decoration:none; transition:all .2s; }
        .db-ivw-link:hover { color:#4338ca; text-decoration:underline; }
        .db-ivw-list { flex:1; display:flex; flex-direction:column; gap:0; }
        .db-ivw-item {
          display:flex; align-items:center; padding:12px 10px; gap:16px;
          border-bottom:1px solid #f8fafc;
          flex-shrink:0; transition:all .2s; border-radius:8px; margin:0 -10px;
          cursor:default;
        }
        .db-ivw-item:hover { background:#f8fafc; }
        .db-ivw-item:last-child { border-bottom:none; }
        .db-ivw-avatar {
          width:46px; height:46px; border-radius:50%;
          background:linear-gradient(135deg,#eef2ff,#e0e7ff); color:#6366f1;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          font-size:.95rem; font-weight:700; font-family:'Outfit',sans-serif;
          transition:transform .2s;
        }
        .db-ivw-item:hover .db-ivw-avatar { transform:scale(1.1); }
        .db-ivw-info { flex:1; min-width:0; }
        .db-ivw-name { font-size:1rem; font-weight:600; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .db-ivw-role { font-size:.9rem; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .db-ivw-dt { text-align:right; flex-shrink:0; }
        .db-ivw-date { font-size:.92rem; font-weight:700; color:#0f172a; }
        .db-ivw-time { font-size:.85rem; color:#64748b; }
        .db-ivw-today { display:inline-flex; align-items:center; gap:4px; }
        .db-ivw-today::before { content:''; width:8px; height:8px; border-radius:50%; background:#16a34a; animation:dbPulse 1.5s infinite; }
        .db-ivw-empty { text-align:center; padding:28px 14px; color:#94a3b8; font-size:1rem; margin:auto; }
        .db-ivw-footer { padding-top:14px; border-top:1px solid #f1f5f9; margin-top:auto; }
        .db-ivw-footer a { font-size:.9rem; font-weight:600; color:#6366f1; text-decoration:none; display:flex; align-items:center; gap:4px; transition:gap .2s; }
        .db-ivw-footer a:hover { gap:8px; }

        .db-emp { text-align:center; padding:28px 14px; color:#94a3b8; font-size:.95rem; margin:auto; }

        @media (max-width:1100px) {
          .db-kpi { grid-template-columns:repeat(2,1fr); gap:12px; }
          .db-3col { grid-template-columns:1fr; gap:12px; }
        }
        @media (max-width:700px) {
          .db-kpi { grid-template-columns:1fr; gap:10px; }
          .db-hdr { flex-direction:column; align-items:flex-start; }
          .db-att { flex-direction:column; align-items:center; }
        }
      `}</style>

      <div className="db-page">
        {/* ── Header ── */}
        <div className="db-hdr" style={{ animation: ready ? undefined : 'none' }}>
          <div className="db-hdr-l">
            <h1>Dashboard</h1>
            <div className="db-hdr-g">Welcome back, {profile?.full_name || profile?.email?.split('@')[0] || 'Admin'} <span role="img" aria-label="wave">👋</span></div>
          </div>
          <div className="db-hdr-r">
            <select className="db-rng" defaultValue="7d">
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <button className="db-rfsh" onClick={() => window.location.reload()} title="Refresh">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
        </div>

        {/* ── Row 1: KPI Cards ── */}
        <div className="db-kpi" style={{ animation: ready ? undefined : 'none' }}>
          <div className="db-kpi-c" style={{ '--accent': '#6366f1' }}>
            <div className="db-kpi-r1">
              <div className="db-kpi-ic" style={{ background:'#eef2ff', color:'#6366f1' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <span className="db-kpi-t">Total Employees</span>
            </div>
            <div className="db-kpi-v"><AnimatedValue value={stats.emps} /></div>
            <div className="db-kpi-r3">
              <span className={`db-kpi-gr ${stats.empGrowth >= 0 ? 'up' : 'down'}`}>
                <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor"><path d={stats.empGrowth >= 0 ? 'M12 5l7 7h-5v7h-4v-7H5l7-7z' : 'M12 19l-7-7h5V5h4v7h5l-7 7z'} /></svg>
                {stats.empGrowth >= 0 ? '+' : ''}{stats.empGrowth}%
              </span>
              <span className="db-kpi-d">vs last 30 days</span>
              <Link to="/employees/manage" className="db-kpi-lk">View &rarr;</Link>
            </div>
          </div>

          <div className="db-kpi-c">
            <div className="db-kpi-r1">
              <div className="db-kpi-ic" style={{ background:'#fffbeb', color:'#f59e0b' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <span className="db-kpi-t">Pending Approvals</span>
            </div>
            <div className="db-kpi-v"><AnimatedValue value={stats.pendingEmps} /></div>
            <div className="db-kpi-r3">
              <span className="db-kpi-d">{stats.pendingEmps > 0 ? 'Awaiting review' : 'All clear'}</span>
              <Link to="/employees/pending" className="db-kpi-lk">Review &rarr;</Link>
            </div>
          </div>

          <div className="db-kpi-c">
            <div className="db-kpi-r1">
              <div className="db-kpi-ic" style={{ background:'#ecfdf5', color:'#10b981' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <span className="db-kpi-t">Total Candidates</span>
            </div>
            <div className="db-kpi-v"><AnimatedValue value={stats.candidates} /></div>
            <div className="db-kpi-r3">
              <span className="db-kpi-d">All registered candidates</span>
              <Link to="/candidates/data" className="db-kpi-lk">View &rarr;</Link>
            </div>
          </div>

          <div className="db-kpi-c">
            <div className="db-kpi-r1">
              <div className="db-kpi-ic" style={{ background:'#eff6ff', color:'#0284c7' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              </div>
              <span className="db-kpi-t">Departments</span>
            </div>
            <div className="db-kpi-v"><AnimatedValue value={stats.depts} /></div>
            <div className="db-kpi-r3">
              <span className="db-kpi-d">Active departments</span>
              <Link to="/masters/departments" className="db-kpi-lk">Manage &rarr;</Link>
            </div>
          </div>
        </div>

        {/* ── Row 2: 3 Cards ── */}
        <div className="db-3col" style={{ animation: ready ? undefined : 'none' }}>
          {/* Attendance Overview */}
          <div className="db-card">
            <div className="db-card-hdr">
              <span className="db-card-ttl">Attendance Overview</span>
            </div>
            <div className="db-card-bd">
              {attendanceSummaries.length === 0 ? (
                <div className="db-emp">No attendance data available yet.</div>
              ) : (
                <div className="db-att">
                  <div className="db-att-cw">
                    <DonutChart segments={[{ value: attendanceAgg.present, color: '#16a34a' }, { value: attendanceAgg.absent, color: '#ef4444' }, { value: attendanceAgg.late || 0, color: '#94a3b8' }]} size={120} sw={22} />
                    <div className="db-att-cl">
                      <div className="db-att-cp">{attRate}%</div>
                      <div className="db-att-cs">Rate</div>
                    </div>
                  </div>
                  <div className="db-att-r">
                    <div className="db-att-m">
                      <div className="db-att-row">
                        <div className="db-att-dot" style={{ background:'#16a34a', boxShadow:'0 0 0 2px #16a34a22' }} />
                        <span className="db-att-rl">Present</span>
                        <span className="db-att-rc">{attendanceAgg.present}</span>
                        <span className="db-att-rp">{attTotal > 0 ? ((attendanceAgg.present / attTotal) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                      <div className="db-att-row">
                        <div className="db-att-dot" style={{ background:'#ef4444', boxShadow:'0 0 0 2px #ef444422' }} />
                        <span className="db-att-rl">Absent</span>
                        <span className="db-att-rc">{attendanceAgg.absent}</span>
                        <span className="db-att-rp">{attTotal > 0 ? ((attendanceAgg.absent / attTotal) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                      <div className="db-att-row">
                        <div className="db-att-dot" style={{ background:'#94a3b8', boxShadow:'0 0 0 2px #94a3b822' }} />
                        <span className="db-att-rl">Late</span>
                        <span className="db-att-rc">{attendanceAgg.late || 0}</span>
                        <span className="db-att-rp">{attTotal > 0 ? (((attendanceAgg.late || 0) / attTotal) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                    </div>
                    <div className="db-att-rate" style={{ marginTop:'auto' }}>
                      <span className="db-att-rlbl">Attendance Rate</span>
                      <span className="db-att-rval">{attRate}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Interviews */}
          <div className="db-card">
            <div className="db-card-hdr">
              <span className="db-card-ttl">Upcoming Interviews</span>
              <Link to="/candidates/data" className="db-ivw-link">View All</Link>
            </div>
            <div className="db-card-bd">
              {upcomingInterviews.length === 0 ? (
                <div className="db-ivw-empty">No upcoming interviews scheduled.</div>
              ) : (
                <div className="db-ivw">
                  <div className="db-ivw-list">
                    {upcomingInterviews.map((iv, i) => {
                      const fmt = fmtInterview(iv.interview_date);
                      const initials = (iv.candidate_name || '??').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <div className="db-ivw-item" key={iv.id || i} style={{ animation: `dbSlUp .3s ease both ${i * 0.05}s` }}>
                          <div className="db-ivw-avatar">{initials}</div>
                          <div className="db-ivw-info">
                            <div className="db-ivw-name">{iv.candidate_name || 'Unknown'}</div>
                            <div className="db-ivw-role">{iv.apply_post || 'No role'}</div>
                          </div>
                          <div className="db-ivw-dt">
                            {fmt && (
                              <div className="db-ivw-date">
                                {fmt.isToday ? <span className="db-ivw-today">{fmt.date}</span> : fmt.date}
                              </div>
                            )}
                            {fmt && <div className="db-ivw-time">{fmt.time}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="db-ivw-footer">
                    <Link to="/candidates/data">View Full Schedule &rarr;</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
