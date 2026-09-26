import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (v) => (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const days = (v) => (Number(v) || 0).toString();

// Editable number cell: saves when you leave the field or press Enter.
function NumberCell({ value, placeholder, onSave, overridden, width = 92 }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => { setText(value === null || value === undefined ? '' : String(value)); }, [value]);
  const commit = () => {
    const current = value === null || value === undefined ? '' : String(value);
    if (text.trim() === current) return;
    onSave(text.trim() === '' ? null : Number(text));
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number" min="0" step="0.01" value={text} placeholder={placeholder}
        onChange={e => setText(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{ width, padding: '5px 8px', border: `1.5px solid ${overridden ? '#86efac' : '#e2e8f0'}`, borderRadius: 8, fontSize: 13, textAlign: 'right', background: overridden ? '#f0fdf4' : '#fff' }}
      />
      {overridden && (
        <button type="button" title="Reset to the salary structure value" onClick={() => onSave(null)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14, padding: 0 }}>↺</button>
      )}
    </span>
  );
}

export default function PayrollSalarySheet() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [modeLabel, setModeLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/payroll/salary-sheet?month=${month}&year=${year}`, { headers: auth() })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Failed to load'); return d; })
      .then(d => { setRows(d.rows || []); setModeLabel(d.month_days_mode === '30' ? 'Fixed 30 days' : 'Actual days in the month'); })
      .catch(e => { setRows([]); Swal.fire({ icon: 'error', title: 'Error', text: e.message }); })
      .finally(() => setLoading(false));
  }, [month, year]);
  useEffect(() => { load(); setPage(1); }, [load]);

  const save = async (empCode, patch) => {
    try {
      const res = await fetch(`${API}/payroll/salary-sheet`, {
        method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_code: empCode, month, year, ...patch }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      setRows(prev => prev.map(r => (r.emp_code === empCode ? d.row : r)));
    } catch (e) { Swal.fire({ icon: 'error', title: 'Could not save', text: e.message }); }
  };

  // Pull this month's attendance from TeamOffice, then recalculate the sheet from it.
  // Days HR fixed by hand in Daily Attendance (WFH, corrections) are kept.
  const syncAttendance = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/attendance/import-teamoffice`, {
        method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Sync failed');
      await Swal.fire({ icon: 'success', title: 'Attendance synced', text: d.message || 'Attendance updated from TeamOffice.', timer: 2500, showConfirmButton: false });
      load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Could not sync attendance', text: e.message }); }
    finally { setSyncing(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API}/payroll/salary-sheet/export?month=${month}&year=${year}`, { headers: auth() });
      if (!res.ok) throw new Error((await res.json()).detail || 'Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Salary_Sheet_${MONTHS[month - 1]}_${year}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setExporting(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(r => r.full_name.toLowerCase().includes(q) || r.emp_code.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const pageRows = paginate(filtered, page, pageSize);
  const total = (key) => filtered.reduce((t, r) => t + (Number(r[key]) || 0), 0);
  const missingAttendance = rows.filter(r => !r.has_attendance).length;

  return (
    <div className="ss-page">
      <style>{styles}</style>
      <div className="ss-header">
        <div>
          <h2 className="ss-title">Salary Sheet</h2>
          <p className="ss-sub">Month days: {modeLabel || '-'}. Paid/Unpaid days come from TeamOffice attendance: press Sync first, then fix any day by hand. Edit a day in <Link to="/attendance/daily">Daily Attendance</Link> and this sheet updates.</p>
        </div>
        <div className="ss-ctrls">
          <select className="ss-input" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="ss-input" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="ss-btn ss-btn-alt" onClick={syncAttendance} disabled={syncing || loading}>{syncing ? 'Syncing...' : '⟳ Sync attendance from TeamOffice'}</button>
          <button className="ss-btn" onClick={exportExcel} disabled={exporting || loading}>{exporting ? 'Exporting...' : '⬇ Export Excel'}</button>
        </div>
      </div>

      {missingAttendance > 0 && !loading && (
        <div className="ss-warn">{missingAttendance} employee(s) have no attendance for {MONTHS[month - 1]} {year}, so they are treated as fully paid. Sync attendance first if that is not right.</div>
      )}

      <div className="ss-card">
        <div className="ss-toolbar">
          <input className="ss-search" placeholder="Search employee..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <span className="ss-hint">Variable Pay, Incentive, EL Days and Extra Work Days can be typed here for this month. Green = changed from the default (↺ resets it).</span>
        </div>
        <div className="ss-wrap">
          <table className="ss-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="n">Month Days</th>
                <th className="n">Paid Days</th>
                <th className="n">UnPaid Days</th>
                <th className="n">PerDay Salary</th>
                <th className="n">Net Payable</th>
                <th className="n">Insurance</th>
                <th className="n">Other Ded.</th>
                <th className="n">Variable Pay</th>
                <th className="n">Incentive / Payback</th>
                <th className="n">EL Days</th>
                <th className="n">EL Pay</th>
                <th className="n">Extra Work Days</th>
                <th className="n">Extra Work Pay</th>
                <th className="n final">Final Salary Transfer</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} className="ss-empty">Loading...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={15} className="ss-empty">No employees with a salary structure found.</td></tr>
              ) : pageRows.map(r => (
                <tr key={r.emp_code}>
                  <td><div className="nm">{r.full_name}</div><div className="cd">{r.emp_code}{!r.has_attendance ? ' · no attendance' : ''}</div></td>
                  <td className="n">{r.month_days}</td>
                  <td className="n">{days(r.paid_days)}</td>
                  <td className="n" style={{ color: r.unpaid_days > 0 ? '#b91c1c' : undefined, fontWeight: r.unpaid_days > 0 ? 700 : 400 }}>{days(r.unpaid_days)}</td>
                  <td className="n">{money(r.per_day_salary)}</td>
                  <td className="n">{money(r.net_payable)}</td>
                  <td className="n">{r.insurance ? '- ' + money(r.insurance) : money(0)}</td>
                  <td className="n">{r.other_deductions ? '- ' + money(r.other_deductions) : money(0)}</td>
                  <td className="n"><NumberCell value={r.variable_pay || ""} placeholder="0" onSave={v => save(r.emp_code, { variable_pay: v })} /></td>
                  <td className="n"><NumberCell value={r.incentive} overridden={r.incentive_overridden} onSave={v => save(r.emp_code, { incentive: v })} /></td>
                  <td className="n"><NumberCell value={r.el_days} overridden={r.el_days !== null} placeholder="auto" width={70} onSave={v => save(r.emp_code, { el_days: v })} /></td>
                  <td className="n">{money(r.el_pay)}</td>
                  <td className="n"><NumberCell value={r.extra_work_days} overridden={r.extra_work_days_overridden} width={70} onSave={v => save(r.emp_code, { ew_days: v })} /></td>
                  <td className="n">{money(r.extra_work_pay)}</td>
                  <td className="n final">{money(r.final_salary)}</td>
                </tr>
              ))}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total ({filtered.length})</td>
                  <td></td><td></td><td></td><td></td>
                  <td className="n">{money(total('net_payable'))}</td>
                  <td className="n">- {money(total('insurance'))}</td>
                  <td className="n">- {money(total('other_deductions'))}</td>
                  <td className="n">{money(total('variable_pay'))}</td>
                  <td className="n">{money(total('incentive'))}</td>
                  <td></td>
                  <td className="n">{money(total('el_pay'))}</td>
                  <td></td>
                  <td className="n">{money(total('extra_work_pay'))}</td>
                  <td className="n final">{money(total('final_salary'))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!loading && <Pagination page={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="employees" />}
      </div>

      <p className="ss-foot">Final Salary Transfer = Net Payable − Insurance − Other Deductions + Variable Pay + Incentive + EL Pay + Extra Work. EL Pay = PerDay Salary × EL Days. Government holidays come from Settings → Holiday Calendar and are paid. Net Payable = PerDay Salary × Paid Days. Payslips generated for this month use exactly these numbers.</p>
    </div>
  );
}

const styles = `
.ss-page { padding: 0; }
.ss-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.ss-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; color: #0f172a; }
.ss-sub { margin: 4px 0 0; font-size: .86rem; color: #64748b; max-width: 720px; }
.ss-sub a { color: #4338ca; font-weight: 600; }
.ss-ctrls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.ss-input { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; background: #fff; }
.ss-btn { padding: 10px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; font-weight: 600; font-size: .88rem; cursor: pointer; }
.ss-btn-alt { background: #fff; color: #4338ca; border: 1.5px solid #c7d2fe; }
.ss-btn:disabled { opacity: .6; cursor: not-allowed; }
.ss-warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 10px; padding: 10px 14px; font-size: .84rem; margin-bottom: 14px; }
.ss-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
.ss-toolbar { display: flex; align-items: center; gap: 16px; padding: 14px 16px; border-bottom: 1.5px solid #e2e8f0; flex-wrap: wrap; }
.ss-search { padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; width: 240px; }
.ss-hint { font-size: .78rem; color: #94a3b8; }
.ss-wrap { overflow-x: auto; }
.ss-table { width: 100%; border-collapse: collapse; font-size: .86rem; }
.ss-table th { background: #f8fafc; color: #64748b; font-size: .72rem; text-transform: uppercase; letter-spacing: .6px; padding: 12px 12px; text-align: left; white-space: nowrap; border-bottom: 1.5px solid #e2e8f0; }
.ss-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; vertical-align: middle; }
.ss-table .n { text-align: right; font-variant-numeric: tabular-nums; }
.ss-table .nm { font-weight: 600; color: #0f172a; }
.ss-table .cd { font-size: .75rem; color: #94a3b8; }
.ss-table .final { font-weight: 800; color: #166534; background: #f0fdf4; }
.ss-table tfoot td { font-weight: 700; background: #f8fafc; border-top: 1.5px solid #cbd5e1; border-bottom: 0; }
.ss-empty { text-align: center; color: #94a3b8; padding: 36px 0 !important; }
.ss-foot { margin: 12px 2px 0; font-size: .78rem; color: #94a3b8; }
`;
