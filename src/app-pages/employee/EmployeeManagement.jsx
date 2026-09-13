import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { employeeManagementStyles } from './employee-management/styles';
import { AnimatedValue, initials, statusBadge, canDeleteEmployee, formatDT } from './employee-management/helpers';

const EmployeeDrawer = lazy(() => import('./employee-management/EmployeeDrawer'));

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const EmployeeManagement = () => {
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
  const perPage = 25;

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

  const fetchPage = (p = page, s = search, st = statusFilter, d = deptFilter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: perPage });
    if (s.trim()) params.set('search', s.trim());
    if (st) params.set('status', st);
    if (d) params.set('department', d);
    fetch(`${API}/employee/manage?${params}`, { headers: auth() })
      .then(r => {
        if (r.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
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

  const applyFilters = () => {
    setPage(1);
    fetchPage(1, search, statusFilter, deptFilter);
  };

  const openDrawer = (emp) => {
    setDrawerOpen(true);
    setDrawerError('');
    setSelectedEmp(null);
    setDrawerLoading(true);
    fetch(`${API}/employee/detail/${emp.id}`, { headers: auth() })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || 'Failed to load employee details');
        setSelectedEmp(d);
        setDrawerLoading(false);
      })
      .catch(err => { setDrawerLoading(false); setDrawerError(err.message || 'Failed to load employee details'); });
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedEmp(null);
    setDrawerError('');
  };

  const handleDelete = (emp) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete "${emp.full_name}" (${emp.emp_code || emp.email_id})?\n\nThis will also remove all attendance records. This action cannot be undone.`);
    if (!confirmed) return;
    fetch(`${API}/employee/${emp.id}`, { method: 'DELETE', headers: auth() })
      .then(r => {
        if (!r.ok) throw new Error('Delete failed');
        fetchPage(page, search, statusFilter, deptFilter);
      })
      .catch(() => alert('Failed to delete employee.'));
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
      confirmButtonColor: '#4338ca',
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
        <div className="emp-hdr">
          <div className="emp-hdr-l">
            <div className="emp-breadcrumb" style={{ display: 'none' }}></div>
            <h1>Employee Management</h1>
            <div className="emp-hdr-g">{total} employee{total !== 1 ? 's' : ''} registered</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <a href={`${API}/employee/import-template`} onClick={handleDownloadTemplate} className="emp-add-btn" style={{ background: '#fff', color: '#4338ca', border: '1.5px solid #e0e7ff', cursor: 'pointer', padding: '6px 14px', fontSize: '.78rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Template
            </a>
            <label className="emp-add-btn" style={{ background: '#fff', color: '#4338ca', border: '1.5px solid #e0e7ff', cursor: importing ? 'default' : 'pointer', opacity: importing ? 0.6 : 1, padding: '6px 14px', fontSize: '.78rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {importing ? 'Importing...' : 'Import from Excel'}
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={importing} onChange={handleImportExcel} />
            </label>
            <button onClick={handleExportEmployees} disabled={exporting} className="emp-add-btn" style={{ background: '#fff', color: '#4338ca', border: '1.5px solid #e0e7ff', cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1, padding: '6px 14px', fontSize: '.78rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {exporting ? 'Exporting...' : 'Export (with Documents)'}
            </button>
            <Link to="/employees/add" className="emp-add-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Employee
            </Link>
          </div>
        </div>

        <div className="emp-grid">

          <div className="emp-card">
            <div className="emp-card-icon" style={{ background:'#dcfce7', color:'#15803d' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className="emp-card-lbl">Active</div>
            <div className="emp-card-val"><AnimatedValue value={stats.active} /></div>
            <div className="emp-card-sub green">● {total > 0 ? Math.round(stats.active / total * 100) : 0}% of total</div>
          </div>
          <div className="emp-card">
            <div className="emp-card-icon" style={{ background:'#fef9c3', color:'#a16207' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className="emp-card-lbl">Pending</div>
            <div className="emp-card-val"><AnimatedValue value={stats.pending} /></div>
            <div className="emp-card-sub" style={{color:'#a16207'}}>● {total > 0 ? Math.round(stats.pending / total * 100) : 0}% of total</div>
          </div>
          <div className="emp-card">
            <div className="emp-card-icon" style={{ background:'#fef2f2', color:'#dc2626' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div className="emp-card-lbl">Dropped</div>
            <div className="emp-card-val"><AnimatedValue value={stats.dropped} /></div>
            <div className="emp-card-sub red">● {total > 0 ? Math.round(stats.dropped / total * 100) : 0}% of total</div>
          </div>
        </div>

        <div className="emp-toolbar">
          <div className="emp-search">
            <svg className="s-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search name, email, mobile..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <select className="emp-select" value={deptFilter} onChange={e => setDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
          <select className="emp-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="dropped">Dropped</option>
          </select>
          <button className="emp-filter-btn" onClick={applyFilters}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter
          </button>
        </div>

        <div className="emp-table-wrap">
          <table className="emp-table">
            <thead>
              <tr>
                <th style={{width:40, color:'#94a3b8', fontWeight:600}}>#</th>
                <th className="col-name">Employee</th>
                <th className="col-contact">Email</th>
                <th className="col-dept">Department</th>
                <th className="col-status">Status</th>
                <th className="col-joined">Joined</th>
                <th className="col-actions" style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7">
                    <div className="emp-empty">
                      <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                      <p>Loading employees...</p>
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="7">
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
                    <td>
                      <div className="emp-name-cell">
                        {emp.profile_photo
                          ? <img src={emp.profile_photo} alt="" className="emp-avatar-img" />
                          : <div className="emp-avatar">{initials(emp.full_name)}</div>
                        }
                        <div>
                          <div className="name">{emp.full_name}</div>
                          <div className="code">{emp.emp_code || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="col-contact" style={{color:'#64748b', fontSize:'.78rem'}}>{emp.email_id}</td>
                    <td className="col-dept">
                      {emp.designation
                        ? <span className="emp-badge emp-badge-dept">{emp.designation}</span>
                        : <span style={{color:'#cbd5e1'}}>—</span>
                      }
                    </td>
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
                        <Link to={`/employees/edit/${emp.id}`} className="emp-action-btn edit" title="Edit" onClick={e => e.stopPropagation()}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </Link>
                        <button className="emp-action-btn download" title="Download Attendance" onClick={e => { e.stopPropagation(); downloadAttendance(emp); }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                        {canDeleteEmployee() && (
                          <button className="emp-action-btn delete" title="Delete" onClick={e => { e.stopPropagation(); handleDelete(emp); }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="emp-pagination">
              <div className="emp-page-info">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </div>
              <div className="emp-page-btns">
                <button className="emp-page-btn" disabled={page <= 1} onClick={() => fetchPage(page - 1, search, statusFilter, deptFilter)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (page <= 4) {
                    p = i + 1;
                  } else if (page >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = page - 3 + i;
                  }
                  return (
                    <button
                      key={p}
                      className={`emp-page-btn ${p === page ? 'active' : ''}`}
                      onClick={() => fetchPage(p, search, statusFilter, deptFilter)}
                    >
                      {p}
                    </button>
                  );
                })}
                <button className="emp-page-btn" disabled={page >= totalPages} onClick={() => fetchPage(page + 1, search, statusFilter, deptFilter)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
          )}
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
