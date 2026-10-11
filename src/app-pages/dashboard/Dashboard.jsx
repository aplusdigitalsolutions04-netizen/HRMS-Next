import React, { useState, useEffect, useRef, useCallback } from 'react';
import useLiveRefresh from '@/lib/live';
import { Stagger, Item } from '@/lib/ui-motion';
import { Link } from 'react-router-dom';

const API = '/api';

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

// Small line icons, one path string each (24x24 viewBox).
const ICONS = {
  userPlus: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M20 8v6 M23 11h-6',
  check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4 12 14.01l-3-3',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18',
  wallet: 'M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4z',
  briefcase: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  edit: 'M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  grid: 'M3 3h18v18H3z M3 9h18 M9 21V9',
  cake: 'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8 M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1 M2 21h20 M7 8v3 M12 8v3 M17 8v3 M7 4h.01 M12 4h.01 M17 4h.01',
  award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M8.21 13.89 7 23l5-3 5 3-1.21-9.12',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
  refresh: 'M23 4v6h-6 M20.49 15a9 9 0 1 1-2.12-9.36L23 10',
  arrow: 'M5 12h14 M12 5l7 7-7 7',
};
const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {(ICONS[name] || '').split(' M').map((d, i) => <path key={i} d={(i === 0 ? '' : 'M') + d} />)}
  </svg>
);

const LT_COLORS = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9'];
const ACT_COLORS = {
  pending: { bg: '#fffbeb', fg: '#b45309' }, approved: { bg: '#f0fdf4', fg: '#15803d' }, rejected: { bg: '#fef2f2', fg: '#b91c1c' },
  cancelled: { bg: '#f1f5f9', fg: '#64748b' }, active: { bg: '#f0fdf4', fg: '#15803d' }, needs_correction: { bg: '#fff7ed', fg: '#c2410c' },
  default: { bg: '#eff6ff', fg: '#1d4ed8' },
};
const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60); if (h < 24) return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
  const dd = Math.floor(h / 24); if (dd < 30) return dd + ' day' + (dd === 1 ? '' : 's') + ' ago';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#3b82f6', '#14b8a6', '#f97316'];

const initialsOf = (name) => (name || '?').split(' ').filter(Boolean).map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?';

// "2026-10-12" -> "12 Oct"
const shortDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  if (!m) return '';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
const weekday = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { weekday: 'short' }) : '';
};
const inDays = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`);

function Dashboard() {
  const [stats, setStats] = useState({ depts: 0, emps: 0, pendingEmps: 0, candidates: 0, empGrowth: 0 });
  const [candidateList, setCandidateList] = useState([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState([]);
  const [overview, setOverview] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);

  const liveRef = React.useRef(null);
  useLiveRefresh(() => { if (liveRef.current) liveRef.current(); }, 60000);
  const fetchData = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [deptRes, empRes, pendingRes, candRes, attRes, profileRes, ovRes] = await Promise.all([
        fetch(`${API}/departments`, { headers }),
        fetch(`${API}/employee/management`, { headers }),
        fetch(`${API}/employee/pending`, { headers }),
        fetch(`${API}/candidate/data`, { headers }),
        fetch(`${API}/attendance/result`, { headers }),
        fetch(`${API}/profile`, { headers }),
        fetch(`${API}/dashboard/overview`, { headers }),
      ]);
      if (profileRes.ok) setProfile(await profileRes.json());
      const depts = deptRes.ok ? await deptRes.json() : [];
      const emps = empRes.ok ? await empRes.json() : [];
      const pending = pendingRes.ok ? await pendingRes.json() : [];
      const candidates = candRes.ok ? await candRes.json() : [];
      const attData = attRes.ok ? await attRes.json() : { summary: [] };
      setOverview(ovRes.ok ? await ovRes.json() : null);
      const now = new Date();
      const ago30 = new Date(now); ago30.setDate(ago30.getDate() - 30);
      const recent30 = emps.filter(e => e.created_on && new Date(e.created_on) >= ago30).length;
      // headcount growth over the last 30 days: people added in that time, against the team size before them
      setStats({ depts: depts.length || 0, emps: emps.length || 0, pendingEmps: pending.length || 0, candidates: (candidates.data ? candidates.data.length : candidates.length) || 0, empGrowth: (emps.length - recent30) > 0 ? Math.round((recent30 / (emps.length - recent30)) * 100) : 0 });
      setCandidateList(Array.isArray(candidates) ? candidates : Array.isArray(candidates.data) ? candidates.data : []);
      setAttendanceSummaries(Array.isArray(attData.summary) ? attData.summary : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); setTimeout(() => setReady(true), 100); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  liveRef.current = fetchData;

  // cards this person chose to hide (My Preferences > Dashboard)
  const [hiddenW, setHiddenW] = useState([]);
  useEffect(() => {
    fetch('/api/preferences', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.prefs) setHiddenW(d.prefs.dashboard_hidden || []); })
      .catch(() => {});
  }, []);

  const refresh = () => { setRefreshing(true); fetchData(); };

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

  // ---- Derived data for the new widgets -------------------------------------
  const ov = overview || {};
  const at = ov.attendanceToday;
  const onLeaveToday = ov.leave ? ov.leave.onLeaveToday : [];
  const wfhToday = ov.wfh ? ov.wfh.today : [];
  const present = at ? at.present : 0;
  const notIn = at ? Math.max(0, at.totalActive - at.present - at.wfh - onLeaveToday.length - at.offOrHoliday) : 0;
  const attendanceToday = at ? Math.round(((at.present + at.wfh) / Math.max(at.totalActive, 1)) * 100) : 0;

  const pipeline = (() => {
    const by = {};
    candidateList.forEach(c => { const k = (c.status || 'New').toString(); by[k] = (by[k] || 0) + 1; });
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6);
  })();
  const pipelineMax = Math.max(1, ...pipeline.map(p => p[1]));
  const depMax = Math.max(1, ...((ov.departments || []).map(d => Number(d.count))));
  const ltMax = Math.max(1, ...((ov.leaveTrends ? Object.values(ov.leaveTrends.series).flat() : []).map(Number)));
  const hireMax = Math.max(1, ...((ov.hiring || []).map(h => h.count)));

  // Attention list: only the items this user can actually act on.
  const attention = [
    { key: 'emp', icon: 'edit', label: 'Employee approvals', value: stats.pendingEmps, to: '/employees/pending', color: '#f59e0b', show: true },
    { key: 'leave', icon: 'calendar', label: 'Leave requests', value: ov.leave ? ov.leave.pending : null, to: '/leave/manage', color: '#2563eb', show: ov.leave != null },
    { key: 'wfh', icon: 'home', label: 'WFH requests', value: ov.wfh ? ov.wfh.pending : null, to: '/wfh/manage', color: '#0ea5e9', show: ov.wfh != null },
    { key: 'doc', icon: 'file', label: 'Document approvals', value: ov.pending ? ov.pending.documents : null, to: '/document-approvals', color: '#ec4899', show: ov.pending && ov.pending.documents != null },
  ].filter(a => a.show);
  const attentionTotal = attention.reduce((s, a) => s + (Number(a.value) || 0), 0);

  const role = sessionStorage.getItem('role');
  let perms = {};
  try { perms = JSON.parse(sessionStorage.getItem('permissions') || '{}'); } catch { perms = {}; }
  const has = (p) => !p || role === 'ADMIN' || role === 'HR' || perms[p] === true;
  const quick = [
    { to: '/employees/invite', icon: 'userPlus', label: 'Invite Employee', perm: 'edit_employee' },
    { to: '/employees/pending', icon: 'edit', label: 'Approvals', perm: 'approve_employee', badge: stats.pendingEmps },
    { to: '/attendance/daily', icon: 'clock', label: 'Daily Attendance', perm: 'view_attendance' },
    { to: '/payroll/salary-sheet', icon: 'wallet', label: 'Salary Sheet', perm: 'view_payroll' },
    { to: '/candidates/add', icon: 'briefcase', label: 'Add Candidate', perm: 'add_candidate' },
    { to: '/settings/holidays', icon: 'sun', label: 'Holidays', perm: null },
  ].filter(q => has(q.perm));

  const greeting = (() => {
    const h = now.getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();
  const todayLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const Skeleton = ({ width = '60%', height = 12 }) => (
    <div className="db-sk" style={{ width, height }} />
  );

  const styles = `
        @keyframes dbf { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dbSlUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dbspin { to{transform:rotate(360deg)} }
        @keyframes dbPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes dbShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes dbGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes dbRise { from{transform:scaleY(0)} to{transform:scaleY(1)} }

        .db-sk { background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size:200% 100%; animation:dbShimmer 1.2s infinite; border-radius:8px; }
        .db-sk-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:18px; }
        .db-sk-card { background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9; display:flex; flex-direction:column; gap:12px; }
        .db-sk-3 { display:grid; grid-template-columns:7fr 5fr; gap:16px; }
        .db-sk-card-lg { background:#fff; border-radius:16px; padding:20px; border:1px solid #f1f5f9; display:flex; flex-direction:column; gap:14px; min-height:260px; }

        .db-page { max-width:1600px; margin:0 auto; width:100%; }

        /* ── Hero ── */
        .db-hero {
          display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
          padding:22px 26px; border-radius:20px; margin-bottom:16px; color:#fff;
          background:linear-gradient(120deg,#1e40af 0%,#2563eb 55%,#3b82f6 100%);
          box-shadow:0 10px 30px rgba(37,99,235,.28); position:relative; overflow:hidden;
        }
        .db-hero::after { content:''; position:absolute; right:-40px; top:-60px; width:220px; height:220px; border-radius:50%; background:rgba(255,255,255,.1); }
        .db-hero::before { content:''; position:absolute; right:120px; bottom:-90px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,.07); }
        .db-hero-l { position:relative; z-index:1; }
        .db-hero-l h1 { margin:0; font-family:'Outfit',sans-serif; font-weight:700; font-size:1.35rem; letter-spacing:-.3px; line-height:1.2; }
        .db-hero-g { font-size:.92rem; opacity:.9; margin-top:4px; font-weight:500; }
        .db-hero-r { position:relative; z-index:1; display:flex; align-items:center; gap:10px; }
        .db-date { padding:8px 14px; border-radius:10px; background:rgba(255,255,255,.16); font-size:.82rem; font-weight:600; backdrop-filter:blur(4px); }
        .db-rfsh { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:10px; border:1px solid rgba(255,255,255,.35); background:rgba(255,255,255,.14); color:#fff; cursor:pointer; transition:all .2s; }
        .db-rfsh:hover { background:rgba(255,255,255,.26); transform:translateY(-1px); }
        .db-rfsh.spin svg { animation:dbspin .8s linear infinite; }

        /* ── Quick actions ── */
        .db-quick { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px; }
        .db-q {
          display:inline-flex; align-items:center; gap:9px; padding:10px 16px; border-radius:12px;
          background:#fff; border:1px solid #e8ecf3; color:#334155; font-size:.84rem; font-weight:600; text-decoration:none;
          box-shadow:0 1px 2px rgba(15,23,42,.04); transition:all .2s; position:relative;
        }
        .db-q:hover { border-color:#bfdbfe; color:#1e40af; transform:translateY(-2px); box-shadow:0 8px 18px rgba(37,99,235,.14); }
        .db-q-ic { width:28px; height:28px; border-radius:8px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; }
        .db-q-bd { background:#f59e0b; color:#fff; font-size:.68rem; font-weight:700; border-radius:20px; padding:1px 7px; min-width:18px; text-align:center; }

        /* ── KPI Row ── */
        .db-kpi { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:18px; }
        .db-kpi-c {
          background:#fff; border-radius:12px; padding:12px 14px 11px;
          box-shadow:0 1px 3px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04);
          border:1px solid #f1f5f9; display:flex; flex-direction:column;
          transition:all .3s cubic-bezier(.22,1,.36,1); position:relative; overflow:hidden; cursor:default;
        }
        .db-kpi-c::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--accent,#2563eb); }
        .db-kpi-c:hover { box-shadow:0 12px 32px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.06); transform:translateY(-2px); }
        .db-kpi-r1 { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
        .db-kpi-ic { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:transform .3s ease; }
        .db-kpi-c:hover .db-kpi-ic { transform:scale(1.1) rotate(-4deg); }
        .db-kpi-ic svg { width:15px; height:15px; }
        .db-kpi-t { font-size:.66rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
        .db-kpi-v { font-size:1.25rem; font-weight:700; color:#0f172a; font-family:'Outfit',sans-serif; line-height:1.1; margin-bottom:3px; }
        .db-kpi-r3 { display:flex; align-items:center; gap:8px; }
        .db-kpi-gr { display:inline-flex; align-items:center; gap:3px; font-size:.72rem; font-weight:700; padding:2px 7px; border-radius:6px; }
        .db-kpi-gr.up { background:#ecfdf5; color:#065f46; }
        .db-kpi-gr.down { background:#fef2f2; color:#991b1b; }
        .db-kpi-d { font-size:.7rem; color:#94a3b8; }
        .db-kpi-lk { font-size:.7rem; font-weight:700; color:#2563eb; text-decoration:none; margin-left:auto; white-space:nowrap; opacity:0; transform:translateX(-4px); transition:all .25s; }
        .db-kpi-c:hover .db-kpi-lk { opacity:1; transform:translateX(0); }

        /* ── 12-column grid ── */
        .db-grid { display:grid; grid-template-columns:repeat(12,1fr); gap:12px; margin-bottom:12px; }
        .s4 { grid-column:span 4; } .s5 { grid-column:span 5; } .s6 { grid-column:span 6; } .s7 { grid-column:span 7; } .s8 { grid-column:span 8; }

        .db-card {
          background:#fff; border-radius:12px; border:1px solid #e8edf6; overflow:hidden;
          box-shadow:0 1px 2px rgba(15,26,58,.04);
          transition:box-shadow .3s ease, transform .3s ease; display:flex; flex-direction:column; min-width:0;
        }
        .db-card:hover { box-shadow:0 6px 18px rgba(15,26,58,.07); }
        .db-card-hdr { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px 0; flex-shrink:0; }
        .db-card-ttl { font-family:'Outfit',sans-serif; font-weight:700; font-size:.88rem; color:#0f172a; display:flex; align-items:center; gap:8px; }
        .db-card-ttl i { width:24px; height:24px; border-radius:7px; display:inline-flex; align-items:center; justify-content:center; font-style:normal; }
        .db-card-lnk { font-size:.72rem; font-weight:700; color:#2563eb; text-decoration:none; white-space:nowrap; }
        .db-card-lnk:hover { color:#1e40af; text-decoration:underline; }
        .db-card-bd { padding:10px 14px 14px; flex:1; display:flex; flex-direction:column; min-height:0; }
        .db-emp { text-align:center; padding:12px 10px; color:#94a3b8; font-size:.8rem; margin:auto; }
        .db-tag { font-size:.68rem; font-weight:700; padding:3px 9px; border-radius:20px; background:#eff6ff; color:#1e40af; white-space:nowrap; }

        /* ── Today's attendance ── */
        .db-today { display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
        .db-today-ring { position:relative; flex-shrink:0; }
        .db-today-ctr { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; }
        .db-today-pct { font-family:'Outfit',sans-serif; font-weight:700; font-size:1.35rem; color:#0f172a; line-height:1; }
        .db-today-sub { font-size:.66rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.4px; margin-top:3px; }
        .db-today-tiles { flex:1; min-width:220px; display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        .db-tile { border-radius:10px; padding:8px 11px; background:var(--bg); border:1px solid var(--bd); }
        .db-tile b { display:block; font-family:'Outfit',sans-serif; font-weight:700; font-size:1.05rem; color:var(--fg); line-height:1.1; }
        .db-tile span { font-size:.64rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.3px; }

        /* ── Needs attention ── */
        .db-att-list { display:flex; flex-direction:column; gap:6px; }
        .db-att-item { display:flex; align-items:center; gap:12px; padding:7px 10px; border-radius:10px; border:1px solid #eef2f7; text-decoration:none; transition:all .2s; background:#fff; }
        .db-att-item:hover { background:#f8fafc; border-color:#e2e8f0; transform:translateX(3px); }
        .db-att-ic { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .db-att-lb { flex:1; font-size:.8rem; font-weight:600; color:#334155; }
        .db-att-n { font-family:'Outfit',sans-serif; font-weight:700; font-size:1rem; min-width:22px; text-align:right; }
        .db-clear { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:10px; background:#ecfdf5; color:#065f46; font-weight:600; font-size:.85rem; margin-top:10px; }

        /* ── Attendance overview (monthly) ── */
        .db-att { display:flex; gap:18px; align-items:center; flex:1; min-height:0; }
        .db-att-cw { flex-shrink:0; position:relative; }
        .db-att-cw svg { filter:drop-shadow(0 2px 4px rgba(0,0,0,.06)); }
        .db-att-cl { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; pointer-events:none; }
        .db-att-cp { font-size:1rem; font-weight:700; color:#0f172a; font-family:'Outfit',sans-serif; line-height:1; }
        .db-att-cs { font-size:.66rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.3px; margin-top:2px; }
        .db-att-r { flex:1; display:flex; flex-direction:column; min-height:0; }
        .db-att-m { display:flex; flex-direction:column; gap:6px; }
        .db-att-row { display:flex; align-items:center; gap:8px; height:26px; border-radius:6px; padding:0 8px; margin:0 -8px; transition:background .2s; }
        .db-att-row:hover { background:#f8fafc; }
        .db-att-dot { width:11px; height:11px; border-radius:50%; flex-shrink:0; }
        .db-att-rl { flex:1; font-size:.8rem; font-weight:500; color:#475569; }
        .db-att-rc { font-size:.85rem; font-weight:700; color:#0f172a; min-width:34px; text-align:right; }
        .db-att-rp { font-size:.76rem; font-weight:600; color:#94a3b8; min-width:50px; text-align:right; }
        .db-att-rate { display:flex; align-items:center; justify-content:space-between; padding-top:10px; margin-top:10px; border-top:1px solid #f1f5f9; }
        .db-att-rlbl { font-size:.78rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.3px; }
        .db-att-rval { font-size:1rem; font-weight:700; color:#0f172a; font-family:'Outfit',sans-serif; line-height:1; }

        /* ── Lists (interviews, people) ── */
        .db-list { display:flex; flex-direction:column; }
        .db-li { display:flex; align-items:center; gap:10px; padding:7px 6px; margin:0 -8px; border-radius:10px; border-bottom:1px solid #f8fafc; transition:background .2s; }
        .db-li:last-child { border-bottom:none; }
        .db-li:hover { background:#f8fafc; }
        .db-av { width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:.7rem; font-weight:700; font-family:'Outfit',sans-serif; background:linear-gradient(135deg,#eff6ff,#dbeafe); color:#2563eb; }
        .db-li-info { flex:1; min-width:0; }
        .db-li-name { font-size:.82rem; font-weight:600; color:#0f172a; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .db-li-sub { font-size:.72rem; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .db-li-r { text-align:right; flex-shrink:0; }
        .db-li-d { font-size:.76rem; font-weight:700; color:#0f172a; }
        .db-li-t { font-size:.68rem; color:#64748b; }
        .db-today-dot { display:inline-flex; align-items:center; gap:5px; }
        .db-today-dot::before { content:''; width:7px; height:7px; border-radius:50%; background:#16a34a; animation:dbPulse 1.5s infinite; }

        /* ── Bars ── */
        .db-bars { display:flex; flex-direction:column; gap:9px; }
        .db-bar-top { display:flex; justify-content:space-between; font-size:.76rem; margin-bottom:4px; }
        .db-bar-top span { font-weight:600; color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:75%; }
        .db-bar-top b { color:#0f172a; font-weight:700; }
        .db-bar-tr { height:7px; background:#f1f5f9; border-radius:9px; overflow:hidden; }
        .db-bar-fl { height:100%; border-radius:9px; transform-origin:left; animation:dbGrow .8s cubic-bezier(.22,1,.36,1) both; }

        /* ── Column chart ── */
        .db-cols { display:flex; align-items:flex-end; justify-content:space-between; gap:8px; height:110px; padding-top:6px; }
        .db-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:6px; height:100%; }
        .db-col-v { font-size:.78rem; font-weight:700; color:#334155; }
        .db-col-b { width:100%; max-width:38px; border-radius:8px 8px 4px 4px; background:linear-gradient(180deg,#60a5fa,#2563eb); transform-origin:bottom; animation:dbRise .7s cubic-bezier(.22,1,.36,1) both; min-height:4px; }
        .db-col-b.zero { background:#e2e8f0; }
        .db-col-l { font-size:.72rem; font-weight:600; color:#94a3b8; text-transform:uppercase; }

        /* ── Holidays ── */
        .db-hol { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #f8fafc; }
        .db-hol:last-child { border-bottom:none; }
        .db-hol-d { width:38px; flex-shrink:0; text-align:center; border-radius:11px; padding:5px 0 6px; background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; }
        .db-hol-d b { display:block; font-family:'Outfit',sans-serif; font-size:.95rem; line-height:1.1; }
        .db-hol-d span { font-size:.62rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }

        .db-sub { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#94a3b8; margin:2px 0 6px; }


        /* ── page header + KPI strip (layout kit) ── */
        .db-datepill { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 12px; border:1px solid #e2e8f0; border-radius:9px; background:#fff; font-size:.8rem; font-weight:600; color:#475569; }
        .db-rf.spin svg { animation:dbspin .8s linear infinite; }
        .db-kpi { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:12px; }
        .db-kpi-c { background:#fff; border:1px solid #e8edf6; border-radius:12px; padding:12px 14px; box-shadow:0 1px 2px rgba(15,26,58,.04); display:flex; flex-direction:column; gap:6px; }
        .db-kpi-c::before { display:none; }
        .db-kpi-c:hover { box-shadow:0 6px 18px rgba(15,26,58,.07); transform:none; }
        .kc-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .kc-lbl { font-size:.74rem; font-weight:600; color:#64748b; }
        .kc-ic { width:30px; height:30px; border-radius:9px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
        .kc-val { font-family:'Outfit',sans-serif; font-weight:700; font-size:1.55rem; line-height:1.05; color:#0f172a; }
        .kc-foot { display:flex; align-items:center; gap:7px; min-height:18px; }
        /* ── leave trends ── */
        .db-lt-leg { display:flex; gap:14px; flex-wrap:wrap; justify-content:flex-end; margin-bottom:6px; font-size:.72rem; font-weight:600; color:#64748b; }
        .db-lt-leg span { display:inline-flex; align-items:center; gap:6px; }
        .db-lt-leg i { width:9px; height:9px; border-radius:50%; display:inline-block; }
        .db-lt { display:flex; align-items:flex-end; justify-content:space-between; gap:8px; height:130px; border-bottom:1px solid #eef2f7; padding-bottom:0; }
        .db-lt-g { flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:4px; min-width:0; }
        .db-lt-bars { flex:1; width:100%; display:flex; align-items:flex-end; justify-content:center; gap:3px; }
        .db-lt-b { width:100%; max-width:16px; border-radius:5px 5px 2px 2px; position:relative; transform-origin:bottom; animation:dbRise .7s cubic-bezier(.22,1,.36,1) both; }
        .db-lt-b em { position:absolute; top:-15px; left:50%; transform:translateX(-50%); font-style:normal; font-size:.62rem; font-weight:700; color:#475569; }
        .db-lt-l { font-size:.68rem; font-weight:600; color:#94a3b8; text-transform:uppercase; padding-top:4px; }
        .db-act-pill { display:inline-block; padding:2px 8px; border-radius:20px; font-size:.64rem; font-weight:700; text-transform:capitalize; }

        @media (max-width:1180px) {
          .db-kpi { grid-template-columns:repeat(2,1fr); gap:12px; }
          .s4,.s5,.s6,.s7,.s8 { grid-column:span 12; }
          .db-sk-3 { grid-template-columns:1fr; }
        }
        @media (max-width:700px) {
          .db-kpi, .db-sk-grid { grid-template-columns:1fr; gap:10px; }
          .db-hero { padding:18px; }
          .db-att { flex-direction:column; align-items:center; }
          .db-today-tiles { min-width:0; width:100%; }
        }
  `;

  if (loading) {
    return (
      <div className="db-page">
        <style>{styles}</style>
        <div className="db-hero" style={{ minHeight: 84 }}><div className="db-sk" style={{ width: 200, height: 26, opacity: .35 }} /></div>
        <div className="db-sk-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="db-sk-card"><Skeleton width="40%" height={16} /><Skeleton width="60%" height={34} /><Skeleton width="50%" height={14} /></div>)}
        </div>
        <div className="db-sk-3">
          {[1, 2].map(i => <div key={i} className="db-sk-card-lg"><Skeleton width="50%" height={16} /><Skeleton width="90%" height={10} /><Skeleton width="80%" height={10} /><Skeleton width="70%" height={10} /><Skeleton width="85%" height={10} /></div>)}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>
      {hiddenW.length > 0 && <style>{hiddenW.map(k => (k === 'quick_actions' ? '.db-quick{display:none}' : `.db-card[data-w="${String(k).replace(/[^a-z_]/g, '')}"]{display:none}`)).join('\n')}</style>}

      <div className="db-page">
        {/* ── Page header ── */}
        <div className="ph">
          <div>
            <h1>{greeting}, {profile?.full_name || profile?.email?.split('@')[0] || 'Admin'} <span aria-hidden="true">&#128075;</span></h1>
            <p>
              Here&apos;s what&apos;s happening in your organization today.
              {attentionTotal > 0 ? ` ${attentionTotal} item${attentionTotal === 1 ? '' : 's'} waiting for your review.` : ''}
            </p>
          </div>
          <div className="ph-actions">
            <span className="db-datepill"><Icon name="calendar" size={14} />{todayLabel}</span>
            <Link to="/preferences#dashboard" className="btn-o">Customize</Link>
            <button className={`btn-o db-rf ${refreshing ? 'spin' : ''}`} onClick={refresh} title="Refresh"><Icon name="refresh" size={14} />Refresh</button>
          </div>
        </div>

        {/* ── Quick actions ── */}
        {quick.length > 0 && (
          <div className="db-quick">
            {quick.map(q => (
              <Link key={q.to} to={q.to} className="db-q">
                <span className="db-q-ic"><Icon name={q.icon} size={15} /></span>
                {q.label}
                {q.badge > 0 && <span className="db-q-bd">{q.badge}</span>}
              </Link>
            ))}
          </div>
        )}

        {/* ── KPI cards ── */}
        <Stagger className="db-kpi">
          <Item className="db-kpi-c" key="emp">
            <div className="kc-top"><span className="kc-lbl">Total Employees</span><span className="kc-ic" style={{ background: '#eff6ff', color: '#2563eb' }}><Icon name="users" size={16} /></span></div>
            <div className="kc-val"><AnimatedValue value={stats.emps} /></div>
            <div className="kc-foot"><span className={`db-kpi-gr ${stats.empGrowth >= 0 ? 'up' : 'down'}`}>{stats.empGrowth >= 0 ? '+' : ''}{stats.empGrowth}%</span><span className="db-kpi-d">vs last 30 days</span><Link to="/employees/manage" className="db-kpi-lk">View &rarr;</Link></div>
          </Item>

          <Item className="db-kpi-c" key="present">
            <div className="kc-top"><span className="kc-lbl">Present Today</span><span className="kc-ic" style={{ background: '#ecfdf5', color: '#16a34a' }}><Icon name="check" size={16} /></span></div>
            <div className="kc-val">{at ? <AnimatedValue value={present} /> : '–'}</div>
            <div className="kc-foot"><span className="db-kpi-d">{at ? 'of ' + at.totalActive + ' employees' : 'Attendance not available'}</span><Link to="/attendance/daily" className="db-kpi-lk">View &rarr;</Link></div>
          </Item>

          <Item className="db-kpi-c" key="leave">
            <div className="kc-top"><span className="kc-lbl">On Leave</span><span className="kc-ic" style={{ background: '#fff1f2', color: '#e11d48' }}><Icon name="calendar" size={16} /></span></div>
            <div className="kc-val">{ov.leave ? <AnimatedValue value={onLeaveToday.length} /> : '–'}</div>
            <div className="kc-foot"><span className="db-kpi-d">Approved leave today</span><Link to="/leave/manage" className="db-kpi-lk">View &rarr;</Link></div>
          </Item>

          <Item className="db-kpi-c" key="open">
            <div className="kc-top"><span className="kc-lbl">Open Requests</span><span className="kc-ic" style={{ background: '#fffbeb', color: '#d97706' }}><Icon name="edit" size={16} /></span></div>
            <div className="kc-val"><AnimatedValue value={attentionTotal} /></div>
            <div className="kc-foot"><span className="db-kpi-d">Awaiting your review</span><Link to="/employees/pending" className="db-kpi-lk">View &rarr;</Link></div>
          </Item>

          <Item className="db-kpi-c" key="cand">
            <div className="kc-top"><span className="kc-lbl">Total Candidates</span><span className="kc-ic" style={{ background: '#f0fdf4', color: '#10b981' }}><Icon name="briefcase" size={16} /></span></div>
            <div className="kc-val"><AnimatedValue value={stats.candidates} /></div>
            <div className="kc-foot"><span className="db-kpi-d">All registered candidates</span><Link to="/candidates/data" className="db-kpi-lk">View &rarr;</Link></div>
          </Item>

          <Item className="db-kpi-c" key="dept">
            <div className="kc-top"><span className="kc-lbl">Departments</span><span className="kc-ic" style={{ background: '#f5f3ff', color: '#7c3aed' }}><Icon name="grid" size={16} /></span></div>
            <div className="kc-val"><AnimatedValue value={stats.depts} /></div>
            <div className="kc-foot"><span className="db-kpi-d">Active departments</span><Link to="/masters/departments" className="db-kpi-lk">View &rarr;</Link></div>
          </Item>

        </Stagger>

        {/* ── Row: attendance + leave trends ── */}
        <Stagger className="db-grid">
          {at && (
            <Item data-w="today_attendance" className="db-card s6">
              <div className="db-card-hdr">
                <span className="db-card-ttl"><i style={{ background: '#ecfdf5', color: '#10b981' }}><Icon name="clock" size={15} /></i>Today's Attendance</span>
                <Link to="/attendance/daily" className="db-card-lnk">Details &rarr;</Link>
              </div>
              <div className="db-card-bd">
                {at.totalActive === 0 ? (
                  <div className="db-emp">No active employees yet.</div>
                ) : (
                  <div className="db-today">
                    <div className="db-today-ring">
                      <DonutChart size={112} sw={18} segments={[
                        { value: at.present, color: '#16a34a' },
                        { value: at.wfh, color: '#0ea5e9' },
                        { value: onLeaveToday.length, color: '#f59e0b' },
                        { value: notIn, color: '#e2e8f0' },
                      ]} />
                      <div className="db-today-ctr">
                        <div className="db-today-pct">{attendanceToday}%</div>
                        <div className="db-today-sub">Working today</div>
                      </div>
                    </div>
                    <div className="db-today-tiles">
                      <div className="db-tile" style={{ '--bg': '#f0fdf4', '--bd': '#bbf7d0', '--fg': '#15803d' }}><b><AnimatedValue value={at.present} /></b><span>Present</span></div>
                      <div className="db-tile" style={{ '--bg': '#f0f9ff', '--bd': '#bae6fd', '--fg': '#0369a1' }}><b><AnimatedValue value={at.wfh} /></b><span>Work from home</span></div>
                      <div className="db-tile" style={{ '--bg': '#fffbeb', '--bd': '#fde68a', '--fg': '#b45309' }}><b><AnimatedValue value={onLeaveToday.length} /></b><span>On leave</span></div>
                      <div className="db-tile" style={{ '--bg': '#f8fafc', '--bd': '#e2e8f0', '--fg': '#475569' }}><b><AnimatedValue value={notIn} /></b><span>Not checked in</span></div>
                    </div>
                  </div>
                )}
                {at.recorded === 0 && at.totalActive > 0 && (
                  <div className="db-kpi-d" style={{ marginTop: 12 }}>No attendance has been synced for today yet. Open <Link to="/attendance/daily" style={{ color: '#2563eb', fontWeight: 700 }}>Daily Attendance</Link> to pull today's punches.</div>
                )}
                {at.offOrHoliday > 0 && <div className="db-kpi-d" style={{ marginTop: 12 }}>{at.offOrHoliday} employee(s) are on a weekly off / holiday today.</div>}
              </div>
            </Item>
          )}
          {ov.leaveTrends && (
            <Item data-w="leave_trends" className="db-card s6">
              <div className="db-card-hdr">
                <span className="db-card-ttl"><i style={{ background: '#eff6ff', color: '#2563eb' }}><Icon name="calendar" size={15} /></i>Leave Trends</span>
                <Link to="/leave/manage" className="db-card-lnk">Manage &rarr;</Link>
              </div>
              <div className="db-card-bd">
                {ov.leaveTrends.types.length === 0 ? (
                  <div className="db-emp">No leave requests in the last 6 months.</div>
                ) : (
                  <>
                    <div className="db-lt-leg">
                      {ov.leaveTrends.types.map((t, ti) => <span key={t}><i style={{ background: LT_COLORS[ti % LT_COLORS.length] }} />{t}</span>)}
                    </div>
                    <div className="db-lt">
                      {ov.leaveTrends.months.map((m, mi) => (
                        <div className="db-lt-g" key={m.ym}>
                          <div className="db-lt-bars">
                            {ov.leaveTrends.types.map((t, ti) => {
                              const v = ov.leaveTrends.series[t][mi];
                              return <div key={t} className="db-lt-b" title={t + ': ' + v} style={{ height: (v / ltMax) * 100 + '%', minHeight: v ? 4 : 2, background: v ? LT_COLORS[ti % LT_COLORS.length] : '#e2e8f0' }}>{v ? <em>{v}</em> : null}</div>;
                            })}
                          </div>
                          <span className="db-lt-l">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Item>
          )}
        </Stagger>

        {/* ── Row: recent activities + birthdays ── */}
        <Stagger className="db-grid">
          {ov.activities && (
            <Item data-w="recent_activities" className="db-card s6">
              <div className="db-card-hdr">
                <span className="db-card-ttl"><i style={{ background: '#ecfdf5', color: '#10b981' }}><Icon name="clock" size={15} /></i>Recent Activities</span>
              </div>
              <div className="db-card-bd">
                {ov.activities.length === 0 ? (
                  <div className="db-emp">Nothing has happened yet.</div>
                ) : (
                  <div className="db-list">
                    {ov.activities.map((a, i) => {
                      const sc = ACT_COLORS[String(a.status || '').toLowerCase()] || ACT_COLORS.default;
                      return (
                        <div className="db-li" key={i}>
                          <div className="db-av" style={{ background: '#eff6ff', color: '#2563eb' }}>{initialsOf(a.name)}</div>
                          <div className="db-li-info">
                            <div className="db-li-name">{a.name}</div>
                            <div className="db-li-sub">{a.text}</div>
                          </div>
                          <div className="db-li-r">
                            <span className="db-act-pill" style={{ background: sc.bg, color: sc.fg }}>{String(a.status || '').replace(/_/g, ' ') || a.kind}</span>
                            <div className="db-li-t">{timeAgo(a.at)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Item>
          )}
            {ov.celebrations && (
              <Item data-w="birthdays" className="db-card s6">
                <div className="db-card-hdr">
                  <span className="db-card-ttl"><i style={{ background: '#fdf2f8', color: '#ec4899' }}><Icon name="cake" size={15} /></i>Birthdays</span>
                  <span className="db-tag" style={{ background: '#fdf2f8', color: '#be185d' }}>Next 30 days</span>
                </div>
                <div className="db-card-bd">
                  {ov.celebrations.birthdays.length === 0 ? (
                    <div className="db-emp">No birthdays coming up.</div>
                  ) : (
                    <div className="db-list">
                      {ov.celebrations.birthdays.map((b, i) => (
                        <div className="db-li" key={i}>
                          <div className="db-av" style={{ background: '#fdf2f8', color: '#db2777' }}>{initialsOf(b.full_name)}</div>
                          <div className="db-li-info">
                            <div className="db-li-name">{b.full_name}</div>
                            <div className="db-li-sub">{b.designation || ''}</div>
                          </div>
                          <div className="db-li-r">
                            <div className="db-li-d">{b.days === 0 ? <span className="db-today-dot">Today</span> : shortDate(b.date)}</div>
                            <div className="db-li-t">{b.days === 0 ? '🎂' : inDays(b.days)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Item>
            )}
        </Stagger>

        {/* ── Row: needs attention + interviews ── */}
        <Stagger className="db-grid">
          <Item data-w="needs_attention" className={`db-card s6`}>
            <div className="db-card-hdr">
              <span className="db-card-ttl"><i style={{ background: '#fffbeb', color: '#f59e0b' }}><Icon name="check" size={15} /></i>Needs Your Attention</span>
              {attentionTotal > 0 && <span className="db-tag" style={{ background: '#fffbeb', color: '#b45309' }}>{attentionTotal} open</span>}
            </div>
            <div className="db-card-bd">
              <div className="db-att-list">
                {attention.map(a => (
                  <Link to={a.to} className="db-att-item" key={a.key}>
                    <span className="db-att-ic" style={{ background: a.color + '1a', color: a.color }}><Icon name={a.icon} size={17} /></span>
                    <span className="db-att-lb">{a.label}</span>
                    <span className="db-att-n" style={{ color: Number(a.value) > 0 ? a.color : '#cbd5e1' }}>{a.value ?? 0}</span>
                  </Link>
                ))}
              </div>
              {attentionTotal === 0 && <div className="db-clear"><Icon name="check" size={16} />Nothing is waiting for you right now.</div>}
            </div>
          </Item>
          <Item data-w="interviews" className="db-card s6">
            <div className="db-card-hdr">
              <span className="db-card-ttl"><i style={{ background: '#eff6ff', color: '#0284c7' }}><Icon name="calendar" size={15} /></i>Upcoming Interviews</span>
              <Link to="/candidates/data" className="db-card-lnk">View all</Link>
            </div>
            <div className="db-card-bd">
              {upcomingInterviews.length === 0 ? (
                <div className="db-emp">No upcoming interviews scheduled.</div>
              ) : (
                <div className="db-list">
                  {upcomingInterviews.map((iv, i) => {
                    const fmt = fmtInterview(iv.interview_date);
                    return (
                      <div className="db-li" key={iv.id || i} style={{ animation: `dbSlUp .3s ease both ${i * 0.05}s` }}>
                        <div className="db-av">{initialsOf(iv.candidate_name)}</div>
                        <div className="db-li-info">
                          <div className="db-li-name">{iv.candidate_name || 'Unknown'}</div>
                          <div className="db-li-sub">{iv.apply_post || 'No role'}</div>
                        </div>
                        <div className="db-li-r">
                          {fmt && <div className="db-li-d">{fmt.isToday ? <span className="db-today-dot">{fmt.date}</span> : fmt.date}</div>}
                          {fmt && <div className="db-li-t">{fmt.time}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Item>
        </Stagger>

        {/* ── Row: monthly attendance, interviews, hiring pipeline ── */}
        <Stagger className="db-grid">
          <Item data-w="attendance_overview" className="db-card s6">
            <div className="db-card-hdr">
              <span className="db-card-ttl"><i style={{ background: '#eff6ff', color: '#2563eb' }}><Icon name="clock" size={15} /></i>Attendance Overview</span>
            </div>
            <div className="db-card-bd">
              {attendanceSummaries.length === 0 ? (
                <div className="db-emp">No attendance data available yet.</div>
              ) : (
                <div className="db-att">
                  <div className="db-att-cw">
                    <DonutChart segments={[{ value: attendanceAgg.present, color: '#16a34a' }, { value: attendanceAgg.absent, color: '#ef4444' }, { value: attendanceAgg.late || 0, color: '#94a3b8' }]} size={112} sw={20} />
                    <div className="db-att-cl">
                      <div className="db-att-cp">{attRate}%</div>
                      <div className="db-att-cs">Rate</div>
                    </div>
                  </div>
                  <div className="db-att-r">
                    <div className="db-att-m">
                      <div className="db-att-row">
                        <div className="db-att-dot" style={{ background: '#16a34a', boxShadow: '0 0 0 2px #16a34a22' }} />
                        <span className="db-att-rl">Present</span>
                        <span className="db-att-rc">{attendanceAgg.present}</span>
                        <span className="db-att-rp">{attTotal > 0 ? ((attendanceAgg.present / attTotal) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                      <div className="db-att-row">
                        <div className="db-att-dot" style={{ background: '#ef4444', boxShadow: '0 0 0 2px #ef444422' }} />
                        <span className="db-att-rl">Absent</span>
                        <span className="db-att-rc">{attendanceAgg.absent}</span>
                        <span className="db-att-rp">{attTotal > 0 ? ((attendanceAgg.absent / attTotal) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                      <div className="db-att-row">
                        <div className="db-att-dot" style={{ background: '#94a3b8', boxShadow: '0 0 0 2px #94a3b822' }} />
                        <span className="db-att-rl">Late</span>
                        <span className="db-att-rc">{attendanceAgg.late || 0}</span>
                        <span className="db-att-rp">{attTotal > 0 ? (((attendanceAgg.late || 0) / attTotal) * 100).toFixed(1) : '0.0'}%</span>
                      </div>
                    </div>
                    <div className="db-att-rate">
                      <span className="db-att-rlbl">Attendance Rate</span>
                      <span className="db-att-rval">{attRate}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Item>


          <Item data-w="hiring_pipeline" className="db-card s6">
            <div className="db-card-hdr">
              <span className="db-card-ttl"><i style={{ background: '#ecfdf5', color: '#10b981' }}><Icon name="briefcase" size={15} /></i>Hiring Pipeline</span>
              <Link to="/candidates/data" className="db-card-lnk">View all</Link>
            </div>
            <div className="db-card-bd">
              {pipeline.length === 0 ? (
                <div className="db-emp">No candidates yet.</div>
              ) : (
                <div className="db-bars">
                  {pipeline.map(([label, count], i) => (
                    <div key={label}>
                      <div className="db-bar-top"><span>{label}</span><b>{count}</b></div>
                      <div className="db-bar-tr"><div className="db-bar-fl" style={{ width: `${(count / pipelineMax) * 100}%`, background: PALETTE[i % PALETTE.length], animationDelay: `${i * 0.06}s` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Item>
        </Stagger>

        {/* ── Row: people widgets ── */}
        {(ov.departments || ov.hiring || ov.leave || ov.wfh) && (
          <Stagger className="db-grid">
            {ov.departments && (
              <Item data-w="headcount" className="db-card s4">
                <div className="db-card-hdr">
                  <span className="db-card-ttl"><i style={{ background: '#eff6ff', color: '#0284c7' }}><Icon name="grid" size={15} /></i>Headcount by Department</span>
                </div>
                <div className="db-card-bd">
                  {ov.departments.length === 0 ? (
                    <div className="db-emp">No employees yet.</div>
                  ) : (
                    <div className="db-bars">
                      {ov.departments.map((d, i) => (
                        <div key={d.department}>
                          <div className="db-bar-top"><span>{d.department}</span><b>{d.count}</b></div>
                          <div className="db-bar-tr"><div className="db-bar-fl" style={{ width: `${(Number(d.count) / depMax) * 100}%`, background: PALETTE[i % PALETTE.length], animationDelay: `${i * 0.06}s` }} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Item>
            )}

            {ov.hiring && (
              <Item data-w="new_hires" className="db-card s4">
                <div className="db-card-hdr">
                  <span className="db-card-ttl"><i style={{ background: '#eff6ff', color: '#2563eb' }}><Icon name="userPlus" size={15} /></i>New Hires</span>
                  <span className="db-tag">Last 6 months</span>
                </div>
                <div className="db-card-bd">
                  <div className="db-cols">
                    {ov.hiring.map((h, i) => (
                      <div className="db-col" key={h.ym}>
                        <span className="db-col-v">{h.count}</span>
                        <div className={`db-col-b ${h.count === 0 ? 'zero' : ''}`} style={{ height: `${Math.max(4, (h.count / hireMax) * 100)}%`, animationDelay: `${i * 0.07}s` }} />
                        <span className="db-col-l">{h.label}</span>
                      </div>
                    ))}
                  </div>
                  {ov.joiners && ov.joiners.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="db-sub">Latest joiners</div>
                      <div className="db-list">
                        {ov.joiners.slice(0, 3).map(j => (
                          <div className="db-li" key={j.emp_code}>
                            <div className="db-av" style={{ width: 34, height: 34, fontSize: '.74rem' }}>{initialsOf(j.full_name)}</div>
                            <div className="db-li-info">
                              <div className="db-li-name">{j.full_name}</div>
                              <div className="db-li-sub">{j.designation || 'No designation'}</div>
                            </div>
                            <div className="db-li-r"><div className="db-li-t">{shortDate(j.joined)}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Item>
            )}

            {(ov.leave || ov.wfh) && (
              <Item data-w="out_of_office" className="db-card s4">
                <div className="db-card-hdr">
                  <span className="db-card-ttl"><i style={{ background: '#fffbeb', color: '#f59e0b' }}><Icon name="home" size={15} /></i>Out of Office Today</span>
                  <span className="db-tag" style={{ background: '#fffbeb', color: '#b45309' }}>{onLeaveToday.length + wfhToday.length}</span>
                </div>
                <div className="db-card-bd">
                  {onLeaveToday.length + wfhToday.length === 0 ? (
                    <div className="db-emp">Everyone is in the office today.</div>
                  ) : (
                    <div className="db-list">
                      {onLeaveToday.map((p, i) => (
                        <div className="db-li" key={'l' + i}>
                          <div className="db-av" style={{ background: '#fffbeb', color: '#d97706' }}>{initialsOf(p.full_name)}</div>
                          <div className="db-li-info">
                            <div className="db-li-name">{p.full_name}</div>
                            <div className="db-li-sub">{p.leave_type} · until {shortDate(p.end_date)}</div>
                          </div>
                          <span className="db-tag" style={{ background: '#fffbeb', color: '#b45309' }}>Leave</span>
                        </div>
                      ))}
                      {wfhToday.map((p, i) => (
                        <div className="db-li" key={'w' + i}>
                          <div className="db-av" style={{ background: '#f0f9ff', color: '#0284c7' }}>{initialsOf(p.full_name)}</div>
                          <div className="db-li-info">
                            <div className="db-li-name">{p.full_name}</div>
                            <div className="db-li-sub">Working from home</div>
                          </div>
                          <span className="db-tag" style={{ background: '#f0f9ff', color: '#0369a1' }}>WFH</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Item>
            )}
          </Stagger>
        )}

        {/* ── Row: celebrations + holidays ── */}
        {(ov.celebrations || (ov.holidays && ov.holidays.length >= 0)) && (
          <Stagger className="db-grid">

            {ov.celebrations && (
              <Item data-w="anniversaries" className="db-card s6">
                <div className="db-card-hdr">
                  <span className="db-card-ttl"><i style={{ background: '#eff6ff', color: '#3b82f6' }}><Icon name="award" size={15} /></i>Work Anniversaries</span>
                  <span className="db-tag" style={{ background: '#eff6ff', color: '#6d28d9' }}>Next 30 days</span>
                </div>
                <div className="db-card-bd">
                  {ov.celebrations.anniversaries.length === 0 ? (
                    <div className="db-emp">No work anniversaries coming up.</div>
                  ) : (
                    <div className="db-list">
                      {ov.celebrations.anniversaries.map((a, i) => (
                        <div className="db-li" key={i}>
                          <div className="db-av" style={{ background: '#eff6ff', color: '#2563eb' }}>{initialsOf(a.full_name)}</div>
                          <div className="db-li-info">
                            <div className="db-li-name">{a.full_name}</div>
                            <div className="db-li-sub">{a.years} year{a.years === 1 ? '' : 's'} with us</div>
                          </div>
                          <div className="db-li-r">
                            <div className="db-li-d">{a.days === 0 ? <span className="db-today-dot">Today</span> : shortDate(a.date)}</div>
                            <div className="db-li-t">{inDays(a.days)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Item>
            )}

            {ov.holidays && (
              <Item data-w="holidays" className="db-card s6">
                <div className="db-card-hdr">
                  <span className="db-card-ttl"><i style={{ background: '#fff7ed', color: '#ea580c' }}><Icon name="sun" size={15} /></i>Upcoming Holidays</span>
                  <Link to="/settings/holidays" className="db-card-lnk">Calendar</Link>
                </div>
                <div className="db-card-bd">
                  {ov.holidays.length === 0 ? (
                    <div className="db-emp">No upcoming holidays. Add them in Settings → Holiday Calendar.</div>
                  ) : (
                    <div>
                      {ov.holidays.map((h, i) => (
                        <div className="db-hol" key={i}>
                          <div className="db-hol-d"><b>{(h.holiday_date || '').slice(8, 10)}</b><span>{new Date(h.holiday_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</span></div>
                          <div className="db-li-info">
                            <div className="db-li-name">{h.name}</div>
                            <div className="db-li-sub">{weekday(h.holiday_date)} · {h.holiday_type}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Item>
            )}
          </Stagger>
        )}
      </div>
    </>
  );
}

export default Dashboard;
