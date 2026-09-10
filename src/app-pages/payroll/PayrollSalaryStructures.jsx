import React, { useState, useEffect } from 'react';
import Pagination, { paginate } from '../shared/Pagination';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });
const PAGE_SIZE = 10;

export default function PayrollSalaryStructures() {
  const [structures, setStructures] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [form, setForm] = useState({ basic_pay: 0, hra: 0, conveyance_allowance: 0, food_vouchers: 0, medical_insurance: 0, other_deductions: 0, incentives: 0, el_encashment: 0, ctc: '', ctc_period: 'monthly' });
  const [defaultPercents, setDefaultPercents] = useState({ default_basic_percent: '50', default_hra_percent: '20' });
  const [showPercentModal, setShowPercentModal] = useState(false);
  const [percentForm, setPercentForm] = useState({ default_basic_percent: '50', default_hra_percent: '20' });

  const fetchDefaultPercents = () => {
    fetch(`${API}/settings/payroll`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setDefaultPercents(d); setPercentForm(d); })
      .catch(() => {});
  };

  useEffect(() => { fetchDefaultPercents(); }, []);

  const saveDefaultPercents = async () => {
    try {
      const res = await fetch(`${API}/settings/payroll`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(percentForm),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      setDefaultPercents(percentForm);
      setShowPercentModal(false);
    } catch (e) { alert(e.message); }
  };

  // Split the entered CTC into Basic Pay / HRA using the configured default
  // percentages - Conveyance/Food Vouchers stay manual (not CTC-derived).
  // Fields remain editable afterward, so this is just a starting point.
  const applySplit = () => {
    const ctcValue = parseFloat(form.ctc) || 0;
    const monthlyCtc = form.ctc_period === 'annual' ? ctcValue / 12 : ctcValue;
    const basicPct = parseFloat(defaultPercents.default_basic_percent) || 0;
    const hraPct = parseFloat(defaultPercents.default_hra_percent) || 0;
    setForm(f => ({
      ...f,
      basic_pay: Math.round(monthlyCtc * basicPct / 100 * 100) / 100,
      hra: Math.round(monthlyCtc * hraPct / 100 * 100) / 100,
    }));
  };

  const fetchStructures = () => {
    setLoading(true);
    fetch(`${API}/payroll/salary-structures?search=${search}`, { headers: auth() })
      .then(r => r.json())
      .then(d => setStructures(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStructures(); setPage(1); }, [search]);
  const pageItems = paginate(structures, page, pageSize);

  const openCreate = () => {
    setSelectedEmp(null);
    setForm({ basic_pay: 0, hra: 0, conveyance_allowance: 0, food_vouchers: 0, medical_insurance: 0, other_deductions: 0, incentives: 0, el_encashment: 0, ctc: '', ctc_period: 'monthly' });
    setEmpSearch('');
    setShowModal(true);
    fetch(`${API}/payroll/employees`, { headers: auth() })
      .then(r => r.json())
      .then(d => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  const openEdit = (ss) => {
    setSelectedEmp(ss);
    setForm({
      basic_pay: ss.basic_pay || 0,
      hra: ss.hra || 0,
      conveyance_allowance: ss.conveyance_allowance || 0,
      food_vouchers: ss.food_vouchers || 0,
      medical_insurance: ss.medical_insurance || 0,
      other_deductions: ss.other_deductions || 0,
      incentives: ss.incentives || 0,
      el_encashment: ss.el_encashment || 0,
      ctc: ss.ctc || '',
      ctc_period: ss.ctc_period || 'monthly',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const empCode = selectedEmp?.emp_code;
    if (!empCode) { alert('Please select an employee'); return; }
    const isEditing = structures.some(s => s.emp_code === empCode);
    try {
      const res = await fetch(`${API}/payroll/salary-structures`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_code: empCode, ...form }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      setShowModal(false);
      fetchStructures();
    } catch (e) { alert(e.message); }
  };

  const selectedEmployee = employees.find(e => e.emp_code === selectedEmp?.emp_code);

  return (
    <div className="pr-page">
      <style>{pgStyles}</style>
      <div className="pr-header">
        <div>
          <h2 className="pr-title">Salary Structures</h2>
          <p className="pr-subtitle">Manage employee salary components and structures</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="pr-btn pr-btn-secondary" onClick={() => { setPercentForm(defaultPercents); setShowPercentModal(true); }}>⚙️ Configure Split %</button>
          <button className="pr-btn pr-btn-primary" onClick={openCreate}>+ New Structure</button>
        </div>
      </div>

      <div className="pr-card">
        <div className="pr-toolbar">
          <input className="pr-search" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="pr-loading">Loading...</div>
        ) : structures.length === 0 ? (
          <div className="pr-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <p>No salary structures found. Create a new one to get started.</p>
          </div>
        ) : (
          <div className="pr-table-wrap">
            <table className="pr-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Employee</th>
                  <th>Designation</th>
                  <th>Basic Pay</th>
                  <th>HRA</th>
                  <th>Conveyance</th>
                  <th>Food Vouchers</th>
                  <th>Medical Ins.</th>
                  <th>Other Ded.</th>
                  <th>Incentives</th>
                  <th>EL Encash</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((ss, idx) => (
                  <tr key={ss.id}>
                    <td style={{ color: '#94a3b8', fontSize: 13 }}>{(page - 1) * pageSize + idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{ss.employee_name} <span style={{ color: '#94a3b8', fontSize: 12 }}>({ss.emp_code})</span></td>
                    <td>{ss.designation || '—'}</td>
                    <td>{formatNum(ss.basic_pay)}</td>
                    <td>{formatNum(ss.hra)}</td>
                    <td>{formatNum(ss.conveyance_allowance)}</td>
                    <td>{formatNum(ss.food_vouchers)}</td>
                    <td>{formatNum(ss.medical_insurance)}</td>
                    <td>{formatNum(ss.other_deductions)}</td>
                    <td>{formatNum(ss.incentives)}</td>
                    <td>{formatNum(ss.el_encashment)}</td>
                    <td>
                      <button className="pr-action-btn" onClick={() => openEdit(ss)}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalItems={structures.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="structures" />
          </div>
        )}
      </div>

      {showModal && (
        <div className="pr-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="pr-modal" onClick={e => e.stopPropagation()}>
            <div className="pr-modal-header">
              <h3>{selectedEmp?.emp_code ? 'Edit Salary Structure' : 'New Salary Structure'}</h3>
              <button className="pr-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="pr-modal-body">
              {!selectedEmp?.emp_code ? (
                <div className="pr-field">
                  <label className="pr-label">Select Employee</label>
                  <input className="pr-input" placeholder="Search employee..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                  <div className="pr-emp-list">
                    {employees.filter(e => !empSearch || e.full_name.toLowerCase().includes(empSearch.toLowerCase()) || e.emp_code.toLowerCase().includes(empSearch.toLowerCase())).map(emp => (
                      <div key={emp.emp_code} className={`pr-emp-item ${selectedEmp?.emp_code === emp.emp_code ? 'selected' : ''} ${emp.salary_structure_id ? 'has-ss' : ''}`} onClick={() => setSelectedEmp(emp)}>
                        <div>
                          <div className="pr-emp-name">{emp.full_name} <span style={{ color: '#94a3b8', fontSize: 12 }}>({emp.emp_code})</span></div>
                          <div className="pr-emp-desig">{emp.designation || '—'} {emp.salary_structure_id ? '· Has existing structure' : ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pr-field">
                  <label className="pr-label">Employee</label>
                  <div className="pr-selected-emp">
                    <div>
                      <strong>{selectedEmployee?.full_name}</strong>
                      <span style={{ color: '#94a3b8', fontSize: 13, marginLeft: 8 }}>({selectedEmp.emp_code})</span>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{selectedEmployee?.designation || ''}</div>
                    </div>
                    <button className="pr-action-btn" onClick={() => setSelectedEmp(null)}>✕</button>
                  </div>
                </div>
              )}
              <div className="pr-ctc-box">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="pr-field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
                    <label className="pr-label">CTC</label>
                    <input className="pr-input" type="number" step="0.01" placeholder="e.g. 30000" value={form.ctc} onChange={e => setForm({ ...form, ctc: e.target.value })} />
                  </div>
                  <div className="pr-field" style={{ flex: '0 0 140px', marginBottom: 0 }}>
                    <label className="pr-label">CTC Period</label>
                    <select className="pr-input" value={form.ctc_period} onChange={e => setForm({ ...form, ctc_period: e.target.value })}>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <button type="button" className="pr-btn pr-btn-secondary" onClick={applySplit} disabled={!form.ctc}>
                    Apply {defaultPercents.default_basic_percent}% / {defaultPercents.default_hra_percent}% Split
                  </button>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  Fills Basic Pay ({defaultPercents.default_basic_percent}% of monthly CTC) and HRA ({defaultPercents.default_hra_percent}% of monthly CTC) below — you can still edit them manually after.
                </p>
              </div>
              <div className="pr-form-grid">
                {[
                  { key: 'basic_pay', label: 'Basic Pay' },
                  { key: 'hra', label: 'House Rent Allowance' },
                  { key: 'conveyance_allowance', label: 'Conveyance Allowance' },
                  { key: 'food_vouchers', label: 'Food Vouchers' },
                  { key: 'medical_insurance', label: 'Medical Insurance' },
                  { key: 'other_deductions', label: 'Other Deductions' },
                  { key: 'incentives', label: 'Incentives' },
                  { key: 'el_encashment', label: 'EL Encashment' },
                ].map(f => (
                  <div key={f.key} className="pr-field">
                    <label className="pr-label">{f.label}</label>
                    <input className="pr-input" type="number" step="0.01" value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: parseFloat(e.target.value) || 0 })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="pr-modal-footer">
              <button className="pr-btn pr-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="pr-btn pr-btn-primary" onClick={handleSave}>Save Structure</button>
            </div>
          </div>
        </div>
      )}

      {showPercentModal && (
        <div className="pr-modal-overlay" onClick={() => setShowPercentModal(false)}>
          <div className="pr-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="pr-modal-header">
              <h3>Configure CTC Split %</h3>
              <button className="pr-modal-close" onClick={() => setShowPercentModal(false)}>✕</button>
            </div>
            <div className="pr-modal-body">
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
                Default percentage of monthly CTC that goes into Basic Pay and HRA when applying the split — same for every employee unless manually overridden afterward.
              </p>
              <div className="pr-form-grid">
                <div className="pr-field">
                  <label className="pr-label">Basic Pay %</label>
                  <input className="pr-input" type="number" step="0.01" min="0" max="100" value={percentForm.default_basic_percent} onChange={e => setPercentForm({ ...percentForm, default_basic_percent: e.target.value })} />
                </div>
                <div className="pr-field">
                  <label className="pr-label">HRA %</label>
                  <input className="pr-input" type="number" step="0.01" min="0" max="100" value={percentForm.default_hra_percent} onChange={e => setPercentForm({ ...percentForm, default_hra_percent: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="pr-modal-footer">
              <button className="pr-btn pr-btn-secondary" onClick={() => setShowPercentModal(false)}>Cancel</button>
              <button className="pr-btn pr-btn-primary" onClick={saveDefaultPercents}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNum(v) {
  const n = parseFloat(v) || 0;
  return '₹ ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const pgStyles = `
.pr-page { padding: 0; }
.pr-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.pr-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; color: #0f172a; }
.pr-subtitle { margin: 4px 0 0; font-size: .88rem; color: #64748b; }
.pr-card { background: #fff; border-radius: 16px; border: 1.5px solid #e2e8f0; overflow: hidden; }
.pr-toolbar { padding: 16px 20px; border-bottom: 1.5px solid #e2e8f0; }
.pr-search { width: 300px; max-width: 100%; padding: 9px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: .88rem; outline: none; font-family: 'Inter', sans-serif; }
.pr-search:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
.pr-loading { padding: 40px; text-align: center; color: #94a3b8; }
.pr-empty { padding: 48px 20px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.pr-empty p { margin: 0; font-size: .9rem; }
.pr-table-wrap { overflow-x: auto; }
.pr-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.pr-table th { padding: 12px 14px; text-align: left; font-weight: 600; color: #64748b; background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; white-space: nowrap; font-size: .78rem; text-transform: uppercase; letter-spacing: .03em; }
.pr-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
.pr-table tbody tr:hover { background: #f8fafc; }
.pr-action-btn { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px; font-size: 14px; }
.pr-action-btn:hover { background: #f1f5f9; }
.pr-btn { padding: 10px 22px; border-radius: 10px; font-size: .88rem; font-weight: 600; cursor: pointer; transition: all .2s; font-family: 'Outfit', sans-serif; border: none; display: inline-flex; align-items: center; gap: 6px; }
.pr-btn-primary { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; }
.pr-btn-primary:hover { box-shadow: 0 4px 14px rgba(99,102,241,.35); transform: translateY(-1px); }
.pr-btn-secondary { background: #fff; color: #475569; border: 1.5px solid #e2e8f0; }
.pr-btn-secondary:hover { background: #f1f5f9; }
.pr-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.pr-modal { background: #fff; border-radius: 16px; width: 700px; max-width: 94vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(15,23,42,.25); }
.pr-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1.5px solid #e2e8f0; }
.pr-modal-header h3 { margin: 0; font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; color: #1e293b; }
.pr-modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; padding: 4px 8px; border-radius: 6px; }
.pr-modal-close:hover { background: #f1f5f9; color: #475569; }
.pr-modal-body { padding: 20px 24px; }
.pr-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1.5px solid #e2e8f0; background: #f8fafc; }
.pr-field { margin-bottom: 14px; }
.pr-ctc-box { background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
.pr-label { display: block; font-size: .82rem; font-weight: 600; color: #334155; margin-bottom: 6px; }
.pr-input { width: 100%; padding: 9px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: .88rem; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; }
.pr-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
.pr-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 8px; }
.pr-emp-list { max-height: 200px; overflow-y: auto; border: 1.5px solid #e2e8f0; border-radius: 8px; margin-top: 4px; }
.pr-emp-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; }
.pr-emp-item:hover { background: #f8fafc; }
.pr-emp-item.selected { background: #eef2ff; }
.pr-emp-item.has-ss { opacity: .7; }
.pr-emp-name { font-size: .88rem; font-weight: 500; color: #0f172a; }
.pr-emp-desig { font-size: .78rem; color: #94a3b8; margin-top: 2px; }
.pr-selected-emp { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; }
`;
