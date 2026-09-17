import React, { useState, useEffect, useMemo } from 'react';
import Pagination, { paginate } from '../shared/Pagination';

const API = '/api';
const PAGE_SIZE = 10;

const s = {
  wrap: { maxWidth: 1800, margin: '0 auto', fontFamily: "'Inter', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 16 },
  title: { fontSize: 24, fontWeight: 700, color: '#1e293b', margin: 0 },
  sub: { fontSize: 14, color: '#64748b', margin: '4px 0 0 0' },
  ctrls: { display: 'flex', gap: 12, alignItems: 'center' },
  sel: { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, color: '#334155', background: '#fff', outline: 'none' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' },
  tableWrap: { width: '100%', overflowX: 'auto' },
  th: { padding: '12px 16px', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 },
  td: { padding: '12px 16px', fontSize: 14, color: '#334155', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' },
  tr: { transition: 'background 0.2s', cursor: 'pointer' },
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  empHdr: { display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  empAvatar: { width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  statusBadge: (status) => {
    let bg = '#f1f5f9', color = '#64748b';
    if (status === 'P') { bg = '#dcfce7'; color = '#166534'; }
    else if (status === 'A') { bg = '#fee2e2'; color = '#991b1b'; }
    else if (status === 'HD') { bg = '#fef3c7'; color = '#92400e'; }
    else if (status === 'WO') { bg = '#e0e7ff'; color = '#3730a3'; }

    return {
      padding: '4px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: bg, color: color, display: 'inline-block', textAlign: 'center', minWidth: 24
    };
  },
  countPill: (color, bg) => ({
    padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color
  }),
};

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};

export default function DailyAttendance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmpCode, setSelectedEmpCode] = useState(null);

  const d = new Date();
  const [month, setMonth] = useState(d.getMonth() + 1);
  const [year, setYear] = useState(d.getFullYear());

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const fetchData = async () => {
    setLoading(true);
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

  const fmtDate = (dstr) => {
    if (!dstr) return '';
    try {
      const d = new Date(dstr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dstr;
    }
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
        map.set(r.emp_code, { emp_code: r.emp_code, name: r.name, department: r.department, present: 0, absent: 0, days: [] });
      }
      const entry = map.get(r.emp_code);
      if (!r.id) continue; // no attendance record for this employee this month
      entry.days.push(r);
      if (r.status === 'P' || r.status === 'HD') entry.present++;
      else if (r.status === 'A') entry.absent++;
    }
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [records]);

  const selectedEmployee = useMemo(
    () => employees.find(e => e.emp_code === selectedEmpCode) || null,
    [employees, selectedEmpCode]
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [employees.length]);
  const pageEmployees = paginate(employees, page, pageSize);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Daily Attendance Records</h2>
          <p style={s.sub}>
            {selectedEmployee
              ? `Day-by-day IN/OUT punches for ${selectedEmployee.name || selectedEmployee.emp_code}.`
              : 'Select an employee to view their day-by-day IN/OUT punches.'}
          </p>
        </div>
        <div style={s.ctrls}>
          {selectedEmployee && (
            <button style={s.backBtn} onClick={() => setSelectedEmpCode(null)}>
              &larr; Back to employees
            </button>
          )}
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
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployee.days
                    .slice()
                    .sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date))
                    .map((r) => (
                      <tr key={r.id} style={{ ...s.tr, cursor: 'default' }}>
                        <td style={{ ...s.td, fontWeight: 500 }}>{fmtDate(r.attendance_date)}<div style={{ fontSize: 12, color: '#94a3b8' }}>{r.day}</div></td>
                        <td style={s.td}>{r.in_time || '--:--'}</td>
                        <td style={s.td}>{r.out_time || '--:--'}</td>
                        <td style={s.td}>{fmtHours(r.working_hours)} hrs</td>
                        <td style={s.td}>
                          <span style={s.statusBadge(r.status)}>{r.status}</span>
                        </td>
                        <td style={{ ...s.td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.remark}>{r.remark || '-'}</td>
                      </tr>
                    ))}
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
                  <th style={s.th}>Present</th>
                  <th style={s.th}>Absent</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ ...s.td, textAlign: 'center', padding: '40px 0' }}>Loading records...</td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan="6" style={{ ...s.td, textAlign: 'center', padding: '40px 0' }}>No attendance records found for this month.</td></tr>
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
                      <td style={{ ...s.td, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ ...s.empAvatar, width: 32, height: 32, fontSize: 12 }}>{initials(emp.name)}</div>
                        {emp.name || '-'}
                      </td>
                      <td style={s.td}>{emp.emp_code}</td>
                      <td style={s.td}>{emp.department || '-'}</td>
                      <td style={s.td}><span style={s.countPill('#166534', '#dcfce7')}>{emp.present}</span></td>
                      <td style={s.td}><span style={s.countPill('#991b1b', '#fee2e2')}>{emp.absent}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && <Pagination page={page} totalItems={employees.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="employees" />}
          </div>
        )}
      </div>
    </div>
  );
}
