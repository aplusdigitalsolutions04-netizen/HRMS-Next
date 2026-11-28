import React, { useState, useEffect, useMemo } from 'react';
import Pagination, { paginate } from '../shared/Pagination';
import useStatusMaster, { pillStyle } from '../shared/useStatusMaster';
import { Link, useLocation } from 'react-router-dom';

const API = '/api';
const PAGE_SIZE = 10;

const s = {
  wrap: { maxWidth: 1800, margin: '0 auto', fontFamily: "'Inter', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 16 },
  title: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 },
  sub: { fontSize: 14, color: '#64748b', margin: '4px 0 0 0' },
  ctrls: { display: 'flex', gap: 12, alignItems: 'center' },
  sel: { height: 36, padding: '0 28px 0 11px', borderRadius: 9, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff', outline: 'none', cursor: 'pointer' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #eadfd5', overflow: 'hidden' },
  tableWrap: { width: '100%', overflowX: 'auto' },
  th: { padding: '9px 12px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #eadfd5', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '8px 12px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f4f6fa', whiteSpace: 'nowrap' },
  tr: { transition: 'background 0.2s', cursor: 'pointer' },
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', borderRadius: 9, border: '1px solid var(--brand-line)', background: '#fff', color: 'var(--brand)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' },
  empHdr: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  empAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),var(--brand-mid))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  countPill: (color, bg) => ({
    padding: '2px 9px', borderRadius: 14, fontSize: 11.5, fontWeight: 600, background: bg, color
  }),
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};


export default function DailyAttendance() {
  // Every attendance status (label, colour, meaning, how it counts) comes from Settings > Status Master.
  const sm = useStatusMaster();
  const L = (behavior, fallback) => (sm.attendance.find(x => x.behavior === behavior) || {}).label || fallback;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpCode, setSelectedEmpCode] = useState(null);

  const d = new Date();
  // opened from the dashboard (?date=today&status=present) the page shows that one day, with the filter already set
  const loc = useLocation();
  const q0 = new URLSearchParams(loc.search);
  const p2 = (n) => String(n).padStart(2, '0');
  const todayYmd = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  const [day, setDay] = useState(() => { const v = q0.get('date'); return v === 'today' ? todayYmd : (YMD.test(v || '') ? v : ''); });
  const [stFilter, setStFilter] = useState(q0.get('status') || '');
  const [month, setMonth] = useState(day ? Number(day.slice(5, 7)) : d.getMonth() + 1);
  const [year, setYear] = useState(day ? Number(day.slice(0, 4)) : d.getFullYear());
  useEffect(() => { if (YMD.test(day)) { setMonth(Number(day.slice(5, 7))); setYear(Number(day.slice(0, 4))); } }, [day]);

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const syncTeamOffice = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch(`${API}/attendance/import-teamoffice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
        body: JSON.stringify({ month, year })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Sync failed');
      setSyncMsg(json.message || 'Synced');
      await fetchData();
    } catch (e) {
      setSyncMsg(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Auto-update: while viewing the current month, pull today's punches from
  // TeamOffice every 30s (and when the tab is shown again) and refresh quietly.
  const fetchRef = React.useRef(null);
  useEffect(() => {
    const now = new Date();
    if (month !== now.getMonth() + 1 || year !== now.getFullYear()) return;
    const tick = () => {
      if (document.hidden) return;
      fetch(`${API}/attendance/live-sync`, { method: 'POST', headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` } })
        .catch(() => {})
        .finally(() => fetchRef.current(true)); // the server also syncs in the background; always re-read
    };
    tick();
    const id = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [month, year]);

  // The selected month is pulled from TeamOffice by itself when the page opens (the server also
  // does it in the background): no Sync button needed. The list is re-read only if it imported.
  useEffect(() => {
    let alive = true;
    fetch(`${API}/attendance/auto-sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }, body: JSON.stringify({ month, year }) })
      .then(r => r.json())
      .then(d => { if (alive && d && d.ran) fetchRef.current(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [month, year]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API}/attendance/daily?month=${month}&year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
      } else {
        console.error('Error fetching daily records:', json.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  fetchRef.current = fetchData;

  // Manual add/edit of one day (Work From Home, Extra Work on a holiday, corrections).
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const startEdit = (r) => setEditing({
    date: String(r.attendance_date).slice(0, 10),
    status: r.missing
      ? ((sm.attendance.find(x => x.behavior === 'wfh') || sm.attendance[0] || {}).code || '')
      : (r.status || (sm.attendance.find(x => x.behavior === 'present') || {}).code || ''),
    in_time: r.in_time || '', out_time: r.out_time || '', remark: '',
  });
  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch(`${API}/attendance/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
        body: JSON.stringify({ emp_code: selectedEmpCode, ...editing }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Save failed');
      setEditing(null);
      await fetchData(true);
    } catch (e) {
      setSyncMsg(e.message || 'Save failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const fmtDate = (dstr) => {
    if (!dstr) return '';
    // API sends plain YYYY-MM-DD; build a local date so the day never shifts with timezone.
    const [y, m, dd] = String(dstr).slice(0, 10).split('-').map(Number);
    if (!y || !m || !dd) return dstr;
    return new Date(y, m - 1, dd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fmtHours = (hrs) => {
    const n = Number(hrs);
    return isNaN(n) ? '0.0' : n.toFixed(1);
  };

  // Group flat records into one row per employee, sorted by name.
  // Employees with no punches yet this month still get an entry (with an
  // empty days list) since the API now includes every active employee.
  const employees = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      if (!map.has(r.emp_code)) {
        map.set(r.emp_code, { emp_code: r.emp_code, name: r.name, department: r.department, present: 0, half: 0, wfh: 0, ew: 0, absent: 0, days: [] });
      }
      const entry = map.get(r.emp_code);
      if (!r.id) continue; // no attendance record for this employee this month
      entry.days.push(r);
      const st = sm.find('attendance', r.status);
      entry.present += Number(st.present_weight) || 0;
      if (st.behavior === 'half_day') entry.half++;
      else if (st.behavior === 'wfh') entry.wfh++;
      else if (st.behavior === 'extra_work') entry.ew++;
      else if (st.behavior === 'absent') entry.absent++;
    }
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [records, sm.attendance]);

  const selectedEmployee = useMemo(
    () => employees.find(e => e.emp_code === selectedEmpCode) || null,
    [employees, selectedEmpCode]
  );

  // One row per calendar day of the selected month (up to today), so every
  // date lines up with TeamOffice even when no punch record exists for it.
  const calendarDays = useMemo(() => {
    if (!selectedEmployee) return [];
    const byDate = new Map(selectedEmployee.days.map(r => [String(r.attendance_date).slice(0, 10), r]));
    const today = new Date();
    const last = new Date(year, month, 0).getDate();
    const rows = [];
    for (let day = last; day >= 1; day--) {
      const dt = new Date(year, month - 1, day);
      if (dt > today) continue;
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      rows.push(byDate.get(key) || { id: key, attendance_date: key, day: dt.toLocaleDateString('en-US', { weekday: 'long' }), missing: true });
    }
    return rows;
  }, [selectedEmployee, month, year]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [mq, setMq] = useState('');
  const [mDept, setMDept] = useState('');
  const mDepts = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);
  // the record of one day, and which group of statuses it belongs to
  const dayRec = (e) => e.days.find(r => String(r.attendance_date).slice(0, 10) === day) || null;
  const groupOf = (rec) => {
    if (!rec) return 'nomark';
    const b = sm.find('attendance', rec.status).behavior;
    if (['present', 'half_day', 'extra_work'].includes(b)) return 'present';
    if (b === 'wfh') return 'wfh';
    if (b === 'absent') return 'absent';
    if (['week_off', 'holiday'].includes(b)) return 'off';
    return 'leave';
  };
  const matchesStatus = (rec) => !stFilter || (['present', 'wfh', 'absent', 'off', 'leave', 'nomark'].includes(stFilter) ? groupOf(rec) === stFilter : !!rec && rec.status === stFilter);
  const baseEmployees = employees.filter(e => {
    const t = mq.trim().toLowerCase();
    if (t && !((e.name || '') + ' ' + e.emp_code).toLowerCase().includes(t)) return false;
    if (mDept && e.department !== mDept) return false;
    return true;
  });
  const shownEmployees = day ? baseEmployees.filter(e => matchesStatus(dayRec(e))) : baseEmployees;
  const dayCounts = day ? baseEmployees.reduce((c, e) => { const g = groupOf(dayRec(e)); c[g] = (c[g] || 0) + 1; return c; }, {}) : {};
  useEffect(() => { setPage(1); }, [employees.length, mq, mDept, day, stFilter]);
  const pageEmployees = paginate(shownEmployees, page, pageSize);

  return (
    <div style={s.wrap}>
      <div className="ph">
        <div>
          <h1>Daily Attendance Records</h1>
          <p>
            {selectedEmployee
              ? `Day-by-day IN/OUT punches for ${selectedEmployee.name || selectedEmployee.emp_code}.`
              : 'Each employee\'s month at a glance. Click an employee to see their day-by-day punches.'}
          </p>
        </div>
        <div style={s.ctrls}>
          {selectedEmployee && (
            <button style={s.backBtn} onClick={() => setSelectedEmpCode(null)}>
              &larr; Back to employees
            </button>
          )}
          <button style={{ ...s.backBtn, opacity: syncing ? 0.6 : 1 }} disabled={syncing} onClick={syncTeamOffice}>
            {syncing ? 'Syncing...' : '⟳ Refresh now'}
          </button>
          <select style={s.sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {monthNames.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select style={s.sel} value={year} onChange={e => setYear(Number(e.target.value))}>
            {[d.getFullYear() - 1, d.getFullYear(), d.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {syncMsg && <div style={{ marginBottom: 12, fontSize: 13, color: '#334155' }}>{syncMsg}</div>}

      {sm.attendance.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Status key:</span>
          {sm.attendance.map(st => (
            <span key={st.code} style={pillStyle(st.color)} title={st.description + (st.used_for ? ' - ' + st.used_for : '')}>{st.code} = {st.label}</span>
          ))}
          <Link to="/settings/statuses" style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>What do these mean?</Link>
        </div>
      )}

      {!selectedEmployee && (
        <>
          <div className="filters">
            <div className="f-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search by employee name or code..." value={mq} onChange={e => setMq(e.target.value)} />
            </div>
            <select value={mDept} onChange={e => setMDept(e.target.value)} aria-label="Department">
              <option value="">All Departments</option>
              {mDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input type="date" value={day} max={todayYmd} onChange={e => setDay(e.target.value)} aria-label="Day" title="Show one day" style={{ height: 36, padding: '0 10px', borderRadius: 9, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', background: '#fff' }} />
            {day && (
              <select value={stFilter} onChange={e => setStFilter(e.target.value)} aria-label="Status">
                <option value="">All statuses</option>
                <option value="present">Present (incl. half day, extra work)</option>
                <option value="wfh">Work from home</option>
                <option value="absent">Absent</option>
                <option value="leave">On leave / other</option>
                <option value="off">Week off / holiday</option>
                <option value="nomark">Not marked</option>
              </select>
            )}
            <button className="btn-reset" onClick={() => { setMq(''); setMDept(''); setDay(''); setStFilter(''); }}>Reset</button>
          </div>
          {day && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 12px', fontSize: 12.5, color: '#475569', alignItems: 'center' }}>
              <b>{fmtDate(day)}</b>
              {[['present', 'Present'], ['wfh', 'WFH'], ['absent', 'Absent'], ['leave', 'Leave / other'], ['off', 'Off / holiday'], ['nomark', 'Not marked']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setStFilter(stFilter === k ? '' : k)} style={{ border: '1px solid ' + (stFilter === k ? 'var(--brand)' : '#e2e8f0'), background: stFilter === k ? 'var(--brand-soft)' : '#fff', borderRadius: 14, padding: '3px 11px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#334155' }}>{l}: <b>{dayCounts[k] || 0}</b></button>
              ))}
            </div>
          )}
        </>
      )}

      <div style={s.card}>
        {selectedEmployee ? (
          <>
            <div style={s.empHdr}>
              <div style={s.empAvatar}>{initials(selectedEmployee.name)}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{selectedEmployee.name || '-'}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{selectedEmployee.emp_code}{selectedEmployee.department ? ` • ${selectedEmployee.department}` : ''}</div>
              </div>
            </div>
            <div style={s.tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={s.th}>Date</th>
                    <th style={s.th}>In Time</th>
                    <th style={s.th}>Out Time</th>
                    <th style={s.th}>Work Hrs</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Remarks</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {calendarDays.map((r) => {
                    const isEditing = editing && editing.date === String(r.attendance_date).slice(0, 10);
                    const inp = { ...s.sel, padding: '4px 6px', fontSize: 13 };
                    return (
                      <tr key={r.id} style={{ ...s.tr, cursor: 'default' }}>
                        <td style={{ ...s.td, fontWeight: 500 }}>{fmtDate(r.attendance_date)}<div style={{ fontSize: 12, color: '#94a3b8' }}>{r.day}</div></td>
                        {isEditing ? (
                          <>
                            <td style={s.td}><input type="time" style={inp} value={editing.in_time} onChange={e => setEditing({ ...editing, in_time: e.target.value })} /></td>
                            <td style={s.td}><input type="time" style={inp} value={editing.out_time} onChange={e => setEditing({ ...editing, out_time: e.target.value })} /></td>
                            <td style={s.td}>-</td>
                            <td style={s.td}>
                              <select style={inp} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                                {sm.attendance.map(st => <option key={st.code} value={st.code}>{st.code} - {st.label}</option>)}
                              </select>
                            </td>
                            <td style={s.td}><input style={{ ...inp, width: 160 }} placeholder="Remark (optional)" value={editing.remark} onChange={e => setEditing({ ...editing, remark: e.target.value })} /></td>
                            <td style={s.td}>
                              <button style={s.backBtn} disabled={savingEdit} onClick={saveEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>{' '}
                              <button style={s.backBtn} onClick={() => setEditing(null)}>Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={s.td}>{r.in_time || '--:--'}</td>
                            <td style={s.td}>{r.out_time || '--:--'}</td>
                            <td style={s.td}>{fmtHours(r.working_hours)} hrs</td>
                            <td style={s.td}>
                              {r.missing ? <span style={{ color: '#94a3b8' }}>No record</span> : <span style={pillStyle(sm.find('attendance', r.status).color)} title={sm.find('attendance', r.status).description}>{sm.find('attendance', r.status).label}</span>}
                            </td>
                            <td style={{ ...s.td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.remark}>{r.remark || '-'}</td>
                            <td style={s.td}><button style={s.backBtn} onClick={() => startEdit(r)}>{r.missing ? 'Add' : 'Edit'}</button></td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={s.tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width: 40 }}>#</th>
                  <th style={s.th}>Employee</th>
                  <th style={s.th}>Emp Code</th>
                  <th style={s.th}>Department</th>
                  {day ? (<>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>In</th>
                    <th style={s.th}>Out</th>
                    <th style={s.th}>Hours</th>
                    <th style={s.th}>Remark</th>
                  </>) : (<>
                    <th style={s.th}>{L('present', 'Present')}</th>
                    <th style={s.th}>{L('half_day', 'Half Day')}</th>
                    <th style={s.th}>{L('wfh', 'WFH')}</th>
                    <th style={s.th}>{L('extra_work', 'Extra Work')}</th>
                    <th style={s.th}>{L('absent', 'Absent')}</th>
                  </>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ ...s.td, textAlign: 'center', padding: '30px 0' }}>Loading records...</td></tr>
                ) : shownEmployees.length === 0 ? (
                  <tr><td colSpan="9" style={{ ...s.td, textAlign: 'center', padding: '30px 0' }}>No attendance records found for this month.</td></tr>
                ) : (
                  pageEmployees.map((emp, idx) => (
                    <tr
                      key={emp.emp_code}
                      style={s.tr}
                      onClick={() => setSelectedEmpCode(emp.emp_code)}
                      onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={s.td}>{(page - 1) * pageSize + idx + 1}</td>
                      <td style={{ ...s.td, fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ ...s.empAvatar, width: 28, height: 28, fontSize: 11 }}>{initials(emp.name)}</div>
                          {emp.name || '-'}
                        </div>
                      </td>
                      <td style={s.td}>{emp.emp_code}</td>
                      <td style={s.td}>{emp.department || '-'}</td>
                      {day ? (() => {
                        const r = dayRec(emp);
                        const t = (v) => (v ? String(v).slice(0, 5) : '-');
                        return (<>
                          <td style={s.td}>{r ? <span style={pillStyle(sm.find('attendance', r.status).color)} title={sm.find('attendance', r.status).label}>{r.status}</span> : <span style={{ color: '#94a3b8' }}>Not marked</span>}</td>
                          <td style={s.td}>{r ? t(r.in_time) : '-'}</td>
                          <td style={s.td}>{r ? t(r.out_time) : '-'}</td>
                          <td style={s.td}>{r ? fmtHours(r.working_hours) : '-'}</td>
                          <td style={{ ...s.td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r ? r.remark : ''}>{(r && r.remark) || '-'}</td>
                        </>);
                      })() : (<>
                        <td style={s.td}><span style={s.countPill('#166534', '#dcfce7')}>{emp.present}</span></td>
                        <td style={s.td}><span style={s.countPill('#92400e', '#fef3c7')}>{emp.half}</span></td>
                        <td style={s.td}><span style={s.countPill('#155e75', '#cffafe')}>{emp.wfh}</span></td>
                        <td style={s.td}><span style={s.countPill('#6b21a8', '#f3e8ff')}>{emp.ew}</span></td>
                        <td style={s.td}><span style={s.countPill('#991b1b', '#fee2e2')}>{emp.absent}</span></td>
                      </>)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && <Pagination page={page} totalItems={shownEmployees.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="employees" />}
          </div>
        )}
      </div>
    </div>
  );
}
