import React, { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { employeeManagementStyles } from './employee-management/styles';
import { AnimatedValue, initials, statusBadge, canDeleteEmployee, formatDT } from './employee-management/helpers';
import useStatusMaster from '../shared/useStatusMaster';
import Pagination from '../shared/Pagination';
import { Menu, Tabs } from '@/lib/ui-motion';

const EmployeeDrawer = lazy(() => import('./employee-management/EmployeeDrawer'));

const API = '/api';
import useLiveRefresh from '@/lib/live';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const EmployeeManagement = () => {
  const navigate = useNavigate();
  const statusMaster = useStatusMaster(); // labels / colours of every employee status
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, dropped: 0, new_this_month: 0, growth_pct: 0 });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('');
  const [deptFilter, setDept] = useState('');
  const [departments, setDepartments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [perPage, setPerPage] = useState(25);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const fileRef = useRef(null);
  const searchReady = useRef(false);
  const perPageRef = useRef(25);

  const handleExportEmployees = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (deptFilter) params.set('department', deptFilter);
      const res = await fetch(`${API}/employee/export?${params}`, { headers: auth() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_export_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      Swal.fire('Error', err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/employee/import-template`, { headers: auth() });
      if (!res.ok) throw new Error('Could not download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      Swal.fire('Error', err.message || 'Could not download template', 'error');
    }
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    fetch(`${API}/employee/import`, { method: 'POST', headers: auth(), body: fd })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Import failed');
        const errorList = data.errors && data.errors.length > 0
          ? `<div style="text-align:left;max-height:200px;overflow:auto;margin-top:10px;font-size:12px;color:#b91c1c">${data.errors.map(x => `• ${x}`).join('<br/>')}</div>`
          : '';
        Swal.fire({
          icon: data.importCount > 0 ? 'success' : 'warning',
          title: 'Import Complete',
          html: `${data.message}${errorList}`,
        });
        fetchPage(1, search, statusFilter, deptFilter);
        fetch(`${API}/employee/stats`, { headers: auth() }).then(r => r.json()).then(d => setStats(d));
      })
      .catch(err => Swal.fire('Error', err.message || 'Import failed', 'error'))
      .finally(() => setImporting(false));
  };

  useLiveRefresh(() => fetchPage(page, search, statusFilter, deptFilter, true));
  const fetchPage = (p = page, s = search, st = statusFilter, d = deptFilter, silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: perPageRef.current });
    if (s.trim()) params.set('search', s.trim());
    if (st) params.set('status', st);
    if (d) params.set('department', d);
    fetch(`${API}/employee/manage?${params}`, { headers: auth() })
      .then(r => {
        if (r.status === 401) { sessionStorage.removeItem('token'); window.location.href = '/login'; }
        return r.json();
      })
      .then(data => {
        setEmployees(data.data || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setLoading(false);
      })
      .catch(() => { setEmployees([]); setTotal(0); setLoading(false); });
  };

  useEffect(() => {
    fetchPage(1, search, statusFilter, deptFilter);
  }, []);

  useEffect(() => {
    fetch(`${API}/employee/stats`, { headers: auth() })
      .then(r => r.json())
      .then(d => setStats(d))
    fetch(`${API}/departments/`, { headers: auth() })
      .then(r => r.json())
      .then(d => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`${API}/templates`, { headers: auth() })
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // typing in the search box filters after a short pause (Enter still applies it at once)
  useEffect(() => {
    if (!searchReady.current) { searchReady.current = true; return; }
    const t = setTimeout(() => { setPage(1); fetchPage(1, search, statusFilter, deptFilter); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const h = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pickStatus = (st) => { setStatus(st); setPage(1); fetchPage(1, search, st, deptFilter); };
  const pickDept = (d) => { setDept(d); setPage(1); fetchPage(1, search, statusFilter, d); };
  const resetFilters = () => { setSearch(''); setStatus(''); setDept(''); setPage(1); fetchPage(1, '', '', ''); };

  const applyFilters = () => {
    setPage(1);
    fetchPage(1, search, statusFilter, deptFilter);
  };

  // View opens the full Employee Profile page (details, documents and upload permission), not the side popup
  const openDrawer = (emp) => navigate(`/employees/detail/${emp.id}`);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedEmp(null);
    setDrawerError('');
  };

  const handleDelete = (emp) => {
    Swal.fire({
      title: `Delete "${emp.full_name}"?`,
      html: `Their record (${emp.emp_code || emp.email_id}) will be hidden, not erased - attendance, payroll, and other history stay intact and this can be undone from the "Deleted" filter.<br/><br/>
             Should their email/ID (<strong>${emp.email_id}</strong>) be freed up for a new invite right away?`,
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Delete & free email/ID',
      denyButtonText: 'Delete & keep locked',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      denyButtonColor: '#64748b',
    }).then(result => {
      if (!result.isConfirmed && !result.isDenied) return;
      const freeIdentity = result.isConfirmed;
      fetch(`${API}/employee/${emp.id}`, {
        method: 'DELETE',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ free_identity: freeIdentity }),
      })
        .then(async r => {
          if (!r.ok) {
            const d = await r.json().catch(() => ({}));
            throw new Error(d.detail || 'Delete failed');
          }
          fetchPage(page, search, statusFilter, deptFilter);
        })
        .catch((err) => Swal.fire({ icon: 'error', title: 'Could not delete employee', text: err.message || 'Failed to delete employee.' }));
    });
  };

  const handleRestore = (emp) => {
    Swal.fire({
      title: `Restore "${emp.full_name}"?`,
      text: 'They will reappear in the normal employee list and can log in again.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Restore',
      confirmButtonColor: '#1e40af',
    }).then(result => {
      if (!result.isConfirmed) return;
      fetch(`${API}/employee/${emp.id}/restore`, { method: 'POST', headers: auth() })
        .then(async r => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.detail || 'Restore failed');
          fetchPage(page, search, statusFilter, deptFilter);
        })
        .catch(e => Swal.fire({ icon: 'error', title: 'Error', text: e.message }));
    });
  };

  const handleDraftEmail = (emp) => {
    let optionsHtml = '<option value="">-- Select Template --</option>';
    templates.forEach(t => {
      optionsHtml += `<option value="${t.id}">${t.name}</option>`;
    });

    Swal.fire({
      title: 'Draft Email',
      html: `
        <p style="margin-bottom:16px;color:#475569">Select a template to draft an email for <strong>${emp.full_name}</strong>:</p>
        <select id="swal-template-select" class="swal2-input" style="width:100%;box-sizing:border-box">
          ${optionsHtml}
        </select>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Create Draft',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#1e40af',
      preConfirm: () => {
        const val = document.getElementById('swal-template-select').value;
        if (!val) {
          Swal.showValidationMessage('Please select a template');
          return false;
        }
        return val;
      }
    }).then(result => {
      if (!result.isConfirmed) return;
      const templateId = result.value;

      fetch(`${API}/email/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ employee_id: emp.id, template_id: templateId })
      })
      .then(r => { if(!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => {
        Swal.fire({ icon: 'success', title: 'Draft Created!', text: 'Check the Draft Emails section to review and send it.', timer: 3000, showConfirmButton: false });
      })
      .catch(() => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to create email draft.' });
      });
    });
  };

  const downloadAttendance = (emp) => {
    fetch(`${API}/admin/attendance/export/${emp.id}`, { headers: auth() })
      .then(r => {
        if (!r.ok) throw new Error('Export failed');
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Attendance_Report_${emp.emp_code}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert('Failed to download attendance report.'));
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <>
      <style>{employeeManagementStyles}</style>

      <div className="emp-page">
        <div className="ph">
          <div>
            <h1>Employee Management</h1>
            <p>Manage your team members, view details and update information.</p>
          </div>
          <div className="ph-actions" ref={moreRef}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={importing} onChange={e => { setMoreOpen(false); handleImportExcel(e); }} />
            <button className="btn-o" onClick={() => setMoreOpen(o => !o)} aria-haspopup="menu" aria-expanded={moreOpen}>
              More actions
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <Menu open={moreOpen} className="menu-pop">
              <button onClick={e => { setMoreOpen(false); handleDownloadTemplate(e); }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Template</button>
              <button onClick={() => fileRef.current && fileRef.current.click()} disabled={importing}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> {importing ? 'Importing...' : 'Import from Excel'}</button>
              <button onClick={() => { setMoreOpen(false); handleExportEmployees(); }} disabled={exporting}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> {exporting ? 'Exporting...' : 'Export (with Documents)'}</button>
              <Link to="/employees/invite" onClick={() => setMoreOpen(false)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg> Invite Employee</Link>
            </Menu>
            <Link to="/employees/add" className="btn-p">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Employee
            </Link>
          </div>
        </div>

        <div className="tabs-bar">
          <Tabs id="emp-status" value={statusFilter === '' || statusMaster.employee.some(x => x.code === statusFilter) ? (statusFilter || 'all') : ''}
            onChange={v => pickStatus(v === 'all' ? '' : v)}
            tabs={[{ id: 'all', label: <>All ({stats.total || 0})</> }, ...statusMaster.employee.map(st => ({ id: st.code, label: <>{st.label} ({(stats.by_status && stats.by_status[st.code]) || 0})</> }))]} />
        </div>

        <div className="filters">
          <div className="f-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search name, email, mobile..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilters()} />
          </div>
          <select value={deptFilter} onChange={e => pickDept(e.target.value)} aria-label="Department">
            <option value="">All Departments</option>
            {departments.map(d => (<option key={d.id} value={d.name}>{d.name}</option>))}
          </select>
          <select value={statusFilter} onChange={e => pickStatus(e.target.value)} aria-label="Status">
            <option value="">All Status</option>
            {statusMaster.employee.map(st => <option key={st.code} value={st.code}>{st.label}</option>)}
            <option value="deleted">Deleted (removed)</option>
          </select>
          <button className="btn-reset" onClick={resetFilters}>Reset</button>
        </div>

        <div className="emp-table-wrap">
          <table className="emp-table">
            <thead>
              <tr>
                <th style={{width:40, color:'#94a3b8', fontWeight:600}}>#</th>
                <th className="col-id">Employee ID</th>
                <th className="col-name">Employee</th>
                <th className="col-dept">Department</th>
                <th className="col-desig">Designation</th>
                <th className="col-status">Status</th>
                <th className="col-joined">Joined</th>
                <th className="col-actions" style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8">
                    <div className="emp-empty">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                      <p>Loading employees...</p>
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="emp-empty">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <h3>No employees found</h3>
                      <p>Try adjusting your search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp, index) => (
                  <tr key={emp.id} onClick={() => openDrawer(emp)}>
                    <td style={{color: '#64748b', fontSize: '0.85rem', fontWeight: 500}}>{(page - 1) * perPage + index + 1}</td>
                    <td className="col-id" style={{color:'#475569', fontSize:'.8rem', fontWeight:600}}>{emp.emp_code || '—'}</td>
                    <td>
                      <div className="emp-name-cell">
                        {emp.profile_photo
                          ? <img src={emp.profile_photo} alt="" className="emp-avatar-img" />
                          : <div className="emp-avatar">{initials(emp.full_name)}</div>
                        }
                        <div>
                          <div className="name">{emp.full_name}</div>
                          <div className="code">{emp.email_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="col-dept">
                      {emp.department
                        ? <span className="emp-badge emp-badge-dept">{emp.department}</span>
                        : <span style={{color:'#cbd5e1'}}>—</span>
                      }
                    </td>
                    <td className="col-desig" style={{color:'#475569', fontSize:'.8rem'}}>{emp.designation || <span style={{color:'#cbd5e1'}}>—</span>}</td>
                    <td className="col-status">{statusBadge(emp.status)}</td>
                    <td className="col-joined" style={{color:'#64748b', fontSize:'.78rem'}}>{formatDT(emp.created_on)}</td>
                    <td className="col-actions" style={{textAlign:'right'}}>
                      <div className="emp-actions" style={{justifyContent:'flex-end'}} onClick={e => e.stopPropagation()}>
                        <button className="emp-action-btn view" title="View" onClick={() => openDrawer(emp)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button className="emp-action-btn email" title="Draft Email" onClick={e => { e.stopPropagation(); handleDraftEmail(emp); }} style={{ color: '#0ea5e9' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        </button>
                        {['invited', 'needs_correction'].includes(emp.status) && (
                          <Link to={`/employees/detail/${emp.id}?tab=documents`} className="emp-action-btn view" title="Make documents compulsory" onClick={e => e.stopPropagation()} style={{ color: '#d97706' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>
                          </Link>
                        )}
                        <Link to={`/employees/edit/${emp.id}`} className="emp-action-btn edit" title="Edit" onClick={e => e.stopPropagation()}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </Link>
                        <button className="emp-action-btn download" title="Download Attendance" onClick={e => { e.stopPropagation(); downloadAttendance(emp); }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                        {canDeleteEmployee() && (statusFilter === 'deleted' ? (
                          <button className="emp-action-btn view" title="Restore" onClick={e => { e.stopPropagation(); handleRestore(emp); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
                          </button>
                        ) : (
                          <button className="emp-action-btn delete" title="Delete" onClick={e => { e.stopPropagation(); handleDelete(emp); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination onPageSizeChange={n => { perPageRef.current = n; setPerPage(n); setPage(1); fetchPage(1, search, statusFilter, deptFilter); }} page={page} totalItems={total} pageSize={perPage} itemLabel="employees" onPageChange={p => fetchPage(p, search, statusFilter, deptFilter)} />
        </div>
      </div>

      {drawerOpen && (
        <Suspense fallback={null}>
          <EmployeeDrawer selectedEmp={selectedEmp} drawerLoading={drawerLoading} drawerError={drawerError} closeDrawer={closeDrawer} API={API} auth={auth} />
        </Suspense>
      )}
    </>
  );
};

export default EmployeeManagement;
