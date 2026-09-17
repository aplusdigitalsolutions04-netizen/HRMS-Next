import React, { useState, useEffect } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function PayrollGeneratePayslips() {
  const [employees, setEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/payroll/employees`, { headers: auth() })
      .then(r => r.json())
      .then(d => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!selectedEmp) { setError('Please select an employee'); return; }
    setGenerating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API}/payroll/generate-payslip`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_code: selectedEmp.emp_code, month, year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Generation failed');
      setMessage(`Payslip generated for ${selectedEmp.full_name}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API}/payroll/generate-all`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Generation failed');
      setMessage(`${data.count} payslip(s) generated successfully`);
    } catch (e) {
      setError(e.message);
    } finally {
      setGeneratingAll(false);
    }
  };

  const filteredEmployees = employees.filter(e =>
    !empSearch || e.full_name.toLowerCase().includes(empSearch.toLowerCase()) || e.emp_code.toLowerCase().includes(empSearch.toLowerCase())
  );

  return (
    <div className="pr-page">
      <style>{pgStyles}</style>
      <div className="pr-header">
        <div>
          <h2 className="pr-title">Generate Payslips</h2>
          <p className="pr-subtitle">Generate monthly payslips for employees</p>
        </div>
      </div>

      {message && (
        <div className="pr-toast pr-toast-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {message}
        </div>
      )}
      {error && (
        <div className="pr-toast pr-toast-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
        </div>
      )}

      <div className="pr-gen-grid">
        <div className="pr-card">
          <div className="pr-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            <h3>Single Employee</h3>
          </div>
          <div className="pr-card-body">
            <div className="pr-field">
              <label className="pr-label">Select Employee</label>
              <input className="pr-input" placeholder="Search by name or code..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
              <div className="pr-emp-list" style={{ maxHeight: 160 }}>
                {filteredEmployees.map(emp => (
                  <div key={emp.emp_code}
                    className={`pr-emp-item ${selectedEmp?.emp_code === emp.emp_code ? 'selected' : ''} ${!emp.salary_structure_id ? 'no-ss' : ''}`}
                    onClick={() => { if (emp.salary_structure_id) setSelectedEmp(emp); }}>
                    <div className="pr-emp-name">{emp.full_name} <span style={{ color: '#94a3b8', fontSize: 12 }}>({emp.emp_code})</span></div>
                    <div className="pr-emp-desig">{emp.designation || '—'} {!emp.salary_structure_id ? '· No salary structure' : ''}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pr-row">
              <div className="pr-field" style={{ flex: 1 }}>
                <label className="pr-label">Month</label>
                <select className="pr-input" value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="pr-field" style={{ flex: 1 }}>
                <label className="pr-label">Year</label>
                <select className="pr-input" value={year} onChange={e => setYear(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y =>
                    <option key={y} value={y}>{y}</option>
                  )}
                </select>
              </div>
            </div>
            <button className="pr-btn pr-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={generating || !selectedEmp} onClick={handleGenerate}>
              {generating ? 'Generating...' : 'Generate Payslip'}
            </button>
          </div>
        </div>

        <div className="pr-card">
          <div className="pr-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3>All Employees</h3>
          </div>
          <div className="pr-card-body">
            <p style={{ fontSize: '.88rem', color: '#64748b', margin: '0 0 16px' }}>
              Generate payslips for all employees who have a salary structure configured. Skips employees who already have a payslip for the selected period.
            </p>
            <div className="pr-row">
              <div className="pr-field" style={{ flex: 1 }}>
                <label className="pr-label">Month</label>
                <select className="pr-input" value={month} onChange={e => setMonth(Number(e.target.value))}>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="pr-field" style={{ flex: 1 }}>
                <label className="pr-label">Year</label>
                <select className="pr-input" value={year} onChange={e => setYear(Number(e.target.value))}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y =>
                    <option key={y} value={y}>{y}</option>
                  )}
                </select>
              </div>
            </div>
            <button className="pr-btn pr-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8, background: 'linear-gradient(135deg,#059669,#10b981)' }} disabled={generatingAll} onClick={handleGenerateAll}>
              {generatingAll ? 'Generating...' : 'Generate For All Employees'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const pgStyles = `
.pr-page { padding: 0; }
.pr-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.pr-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; color: #0f172a; }
.pr-subtitle { margin: 4px 0 0; font-size: .88rem; color: #64748b; }
.pr-card { background: #fff; border-radius: 16px; border: 1.5px solid #e2e8f0; overflow: hidden; }
.pr-card-header { display: flex; align-items: center; gap: 10px; padding: 16px 20px; border-bottom: 1.5px solid #e2e8f0; }
.pr-card-header h3 { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 600; color: #1e293b; }
.pr-card-body { padding: 16px 20px; }
.pr-field { margin-bottom: 14px; }
.pr-label { display: block; font-size: .82rem; font-weight: 600; color: #334155; margin-bottom: 6px; }
.pr-input { width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: .88rem; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; }
.pr-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
select.pr-input { cursor: pointer; appearance: auto; }
.pr-row { display: flex; gap: 14px; }
.pr-emp-list { max-height: 200px; overflow-y: auto; border: 1.5px solid #e2e8f0; border-radius: 8px; margin-top: 4px; }
.pr-emp-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; }
.pr-emp-item:hover { background: #f8fafc; }
.pr-emp-item.selected { background: #eef2ff; }
.pr-emp-item.no-ss { opacity: .5; cursor: not-allowed; }
.pr-emp-name { font-size: .88rem; font-weight: 500; color: #0f172a; }
.pr-emp-desig { font-size: .78rem; color: #94a3b8; margin-top: 2px; }
.pr-btn { padding: 10px 22px; border-radius: 10px; font-size: .88rem; font-weight: 600; cursor: pointer; transition: all .2s; font-family: 'Outfit', sans-serif; border: none; display: inline-flex; align-items: center; gap: 6px; }
.pr-btn-primary { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; }
.pr-btn-primary:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(99,102,241,.35); transform: translateY(-1px); }
.pr-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.pr-toast { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 12px; margin-bottom: 20px; font-size: .88rem; font-weight: 500; }
.pr-toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; }
.pr-toast-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.pr-gen-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 900px) { .pr-gen-grid { grid-template-columns: 1fr; } }
`;
