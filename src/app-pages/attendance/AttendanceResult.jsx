import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '00:00';
  const h = Math.floor(n);
  const m = Math.floor((n - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const cols = {
  p: { bg: '#d1f7c4', color: '#14532d' },
  a: { bg: '#ffd6d6', color: '#7f1d1d' },
  wo: { bg: '#e5e7eb', color: '#111827' },
  cl: { bg: '#bfdbfe', color: '#1e3a8a' },
  wfh: { bg: '#fde68a', color: '#78350f' },
  nh: { bg: '#bfdbfe', color: '#4c1d95' },
  cl2: { bg: '#dfa', color: '#111827' },
  sl: { bg: '#fee2e2', color: '#991b1b' },
  upl: { bg: '#fecaca', color: '#7f1d1d' },
};

const AttendanceResult = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([1,2,3,4,5,6,7,8,9,10,11,12]);
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(0);
  const [yearListOpen, setYearListOpen] = useState(false);
  const yearDropdownRef = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [vFilter, setVFilter] = useState('');
  const isVer = (x) => !!(x.is_verified || x.isVerified || x.IsVerified);
  const depts = [...new Set(summary.map(x => x.department).filter(Boolean))].sort();
  const filtered = summary.filter(x => {
    const q = search.trim().toLowerCase();
    if (q && !((x.employee_name || x.full_name || '') + ' ' + (x.employee_code || x.emp_code || '')).toLowerCase().includes(q)) return false;
    if (deptFilter && x.department !== deptFilter) return false;
    if (vFilter === 'verified' && !isVer(x)) return false;
    if (vFilter === 'pending' && isVer(x)) return false;
    return true;
  });
  useEffect(() => { setPage(1); }, [summary.length, search, deptFilter, vFilter]);
  const pageItems = paginate(filtered, page, pageSize);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) setYearListOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { fetchAttendanceData(); }, []);

  const fetchAttendanceData = (o = {}) => {
    const month = o && o.month !== undefined ? o.month : selectedMonth;
    const year = o && o.year !== undefined ? o.year : selectedYear;
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    const qs = params.toString();
    const url = "/api/attendance/result" + (qs ? "?" + qs : "");

    fetch(url, { headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') } })
      .then(res => res.json())
      .then(data => {
        if (data.summary) setSummary(data.summary);
        if (data.availableMonths) setAvailableMonths(data.availableMonths);
        if (data.availableYears) setAvailableYears(data.availableYears);
        if (data.selectedMonth !== null && data.selectedMonth !== undefined) setSelectedMonth(data.selectedMonth);
        if (data.selectedYear !== null && data.selectedYear !== undefined) setSelectedYear(data.selectedYear);
      })
      .catch(err => console.error("Failed to fetch attendance data", err));
  };


  const verifyAttendance = (id) => {
    Swal.fire({ title: 'Verify Attendance?', text: 'Once verified, data will be locked.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, Verify' })
      .then(r => { if (!r.isConfirmed) return; fetch('/api/attendance/verify/' + id, { method: 'POST', headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') } }).then(() => fetchAttendanceData()); });
  };

  const verifyAll = () => {
    Swal.fire({ title: 'Verify All Attendance?', text: 'Once verified, data will be locked.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, Verify All' })
      .then(r => {
        if (!r.isConfirmed) return;
        Swal.fire({ title: 'Verifying...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        fetch('/api/attendance/verify_all', { method: 'POST', headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') } })
          .then(() => { Swal.close(); fetchAttendanceData(); });
      });
  };

  const extract = (perf, key) => {
    if (!perf) return 0;
    const part = perf.split(',').find(x => x.trim().startsWith(key + "="));
    return part ? parseInt(part.split('=')[1], 10) : 0;
  };

  const fmtDate = (d) => {
    if (!d) return '\u2014';
    try { return new Date(d).toLocaleDateString("en-GB").replace(/\//g, "-"); } catch(e) { return '\u2014'; }
  };

  const s = {
    card: { background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e8f0ff', overflow: 'hidden' },
    sel: { padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' },
    btn: { padding: '9px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnAct: { padding: '6px 12px', borderRadius: 7, border: 'none', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
    btnVfy: { padding: '6px 12px', borderRadius: 7, border: 'none', background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
    btnDis: { padding: '6px 12px', borderRadius: 7, border: 'none', background: '#f1f5f9', color: '#94a3b8', fontSize: 12, fontWeight: 500, cursor: 'not-allowed', whiteSpace: 'nowrap' },
    btnVer: { padding: '6px 12px', borderRadius: 7, border: 'none', background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 600, cursor: 'not-allowed', whiteSpace: 'nowrap' },
  };

  return (
    <div style={{ maxWidth: 2000, margin: '0 auto' }}>
      <style>{`
        .ar-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:12px}
        .ar-f{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .ar-yd{position:relative;width:150px}
        .ar-yl{display:none;position:absolute;width:100%;max-height:200px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        .ar-yi{padding:8px 12px;cursor:pointer;font-size:13px;color:#334155}
        .ar-yi:hover{background:#2563eb;color:#fff}
        .ar-tw{overflow-x:auto}
        .ar-t{width:100%;border-collapse:collapse;font-size:13px}
        .ar-t th{background:#f8fafc;padding:11px 14px;text-align:left;font-weight:600;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;border-bottom:2px solid #e2e8f0;white-space:nowrap}
        .ar-t td{padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#334155}
        .ar-t tbody tr:hover td{background:#fafaff}
        .ar-pw{display:flex;flex-wrap:wrap;gap:5px;max-width:280px}
        .ar-pt{display:inline-block;padding:3px 7px;border-radius:5px;font-weight:600;font-size:11px}
        .ar-ftr{display:flex;justify-content:flex-end;padding:14px 15px;border-top:1px solid #e2e8f0}
        .ar-nr td{text-align:center;font-weight:600;color:#94a3b8;padding:30px!important}
      `}</style>

      <div className="ph">
        <div>
          <h1>Attendance Summary <span style={{ fontSize: '.8rem', fontWeight: 500, color: '#94a3b8' }}>({filtered.length} record{filtered.length === 1 ? '' : 's'})</span></h1>
          <p>View and verify employee attendance records by month.</p>
        </div>
        <div className="ph-actions">
          <select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); fetchAttendanceData({ month: e.target.value }); }} aria-label="Month" style={s.sel}>
            <option value="">All Months</option>
            {availableMonths.map(m => <option key={m} value={m}>{monthNames[m - 1]}</option>)}
          </select>
          <select value={selectedYear} onChange={e => { const y = Number(e.target.value); setSelectedYear(y); fetchAttendanceData({ year: y }); }} aria-label="Year" style={s.sel}>
            <option value={0}>All Years</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {summary.some(x => !isVer(x)) && (
            <button className="btn-p" onClick={verifyAll}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Verify All
            </button>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="f-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search by employee name or code..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} aria-label="Department">
          <option value="">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={vFilter} onChange={e => setVFilter(e.target.value)} aria-label="Verification">
          <option value="">All Status</option>
          <option value="pending">Pending verification</option>
          <option value="verified">Verified</option>
        </select>
        <button className="btn-reset" onClick={() => { setSearch(''); setDeptFilter(''); setVFilter(''); setSelectedMonth(''); setSelectedYear(0); fetchAttendanceData({ month: '', year: 0 }); }}>Reset</button>
      </div>

      <div style={s.card}>
        <div className="ar-tw">
          <table className="ar-t">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Emp Code</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Period</th>
                <th>Performance</th>
                <th style={{ textAlign: 'center' }}>Present</th>
                <th style={{ textAlign: 'center' }}>Absent</th>
                <th style={{ textAlign: 'center' }}>Hours</th>
                <th style={{ width: 175 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                pageItems.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13, color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 500, color: '#0f172a' }}>{row.employee_code || row.emp_code || '\u2014'}</td>
                    <td style={{ fontWeight: 500, color: '#0f172a' }}>{row.employee_name || row.full_name || '\u2014'}</td>
                    <td style={{ color: '#64748b' }}>{row.department || '\u2014'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#64748b' }}>
                      {fmtDate(row.attendance_from_date)} — {fmtDate(row.attendance_to_date)}
                    </td>
                    <td>
                      <div className="ar-pw">
                        {[{k:'P',c:'p'},{k:'A',c:'a'},{k:'WO',c:'wo'},{k:'CL',c:'cl'},{k:'SL',c:'sl'},{k:'NH',c:'nh'},{k:'CL/2',c:'cl2'},{k:'UPL',c:'upl'},{k:'WFH',c:'wfh'}].map(({k,c}) => {
                          const v = extract(row.performance, k);
                          const col = cols[c] || { bg: '#f1f5f9', color: '#64748b' };
                          return v > 0 ? <span key={k} className="ar-pt" style={{ background: col.bg, color: col.color }}>{k}:{v}</span> : null;
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{row.total_present_days ?? 0}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>{row.total_absent_days ?? 0}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{fmtNum(row.total_working_hours)}</td>
                    <td>
                      {(row.is_verified || row.isVerified || row.IsVerified) ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button style={s.btnDis} disabled>Update</button>
                          <button style={s.btnVer} disabled>Verified</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button style={s.btnAct} onClick={() => navigate(`/attendance/update?empCode=${row.employee_code || row.emp_code}`)}>Update</button>
                          <button style={s.btnVfy} onClick={() => verifyAttendance((row.summary_ids || '').split(',')[0] || row.id || row.attendanceSummaryId)}>Verify</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="ar-nr"><td colSpan="10">No attendance records found for the selected period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="records" />
      </div>
    </div>
  );
};

export default AttendanceResult;
