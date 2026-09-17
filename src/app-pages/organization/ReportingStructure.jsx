import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

export default function ReportingStructure() {
  const [employees, setEmployees] = useState([]);
  const [allManagers, setAllManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const perPage = 25;

  const [savingId, setSavingId] = useState(null);

  const fetchPage = (p = page, s = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, per_page: perPage });
    if (s.trim()) params.set('search', s.trim());

    fetch(`${API}/reporting-structure?${params}`, { headers: auth() })
      .then(r => r.json())
      .then(data => {
        setEmployees(data.data || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setLoading(false);
      })
      .catch(() => { setEmployees([]); setTotal(0); setLoading(false); });
  };

  const fetchAllManagers = () => {
    // Re-use the org-chart endpoint to get a flat list of all active employees for the dropdown
    fetch(`${API}/org-chart`, { headers: auth() })
      .then(r => r.json())
      .then(data => setAllManagers(data.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchPage(1, search);
    fetchAllManagers();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPage(1, search);
  };

  const handleManagerChange = async (employeeId, newManagerId) => {
    if (employeeId === newManagerId) {
      Swal.fire({ icon: 'error', title: 'Invalid Selection', text: 'An employee cannot report to themselves.' });
      return;
    }

    setSavingId(employeeId);
    try {
      const res = await fetch(`${API}/employee/edit/${employeeId}`, {
        method: 'PUT',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: newManagerId || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Update failed');
      
      // Update local state
      setEmployees(employees.map(emp => {
        if (emp.id === employeeId) {
          const mgr = allManagers.find(m => m.id === newManagerId);
          return { ...emp, manager_id: newManagerId, manager_name: mgr ? mgr.full_name : null };
        }
        return emp;
      }));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setSavingId(null);
    }
  };

  const totalPages = Math.ceil(total / perPage) || 1;

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, background: '#fff', padding: '16px 24px', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>
            Reporting Structure
            {!loading && <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', marginLeft: 8 }}>({total})</span>}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>Manage employee reporting relationships</p>
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input 
            type="text" 
            placeholder="Search name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', width: 250, fontSize: 14 }}
          />
          <button type="submit" style={{ padding: '8px 16px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Search
          </button>
        </form>
      </div>

      <div style={{ flex: 1, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 800 }}>
            <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 13, fontWeight: 600, width: 50 }}>#</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 13, fontWeight: 600 }}>Employee</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 13, fontWeight: 600 }}>Emp ID</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 13, fontWeight: 600 }}>Department</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 13, fontWeight: 600 }}>Designation</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 13, fontWeight: 600, width: 250 }}>Reporting Manager</th>
                <th style={{ padding: '12px 16px', color: '#475569', fontSize: 13, fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No records found.</td></tr>
              ) : (
                employees.map((emp, idx) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{(page - 1) * perPage + idx + 1}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{emp.full_name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{emp.emp_code || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{emp.department_name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{emp.designation || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select 
                          value={emp.manager_id || ''} 
                          onChange={(e) => handleManagerChange(emp.id, e.target.value)}
                          disabled={savingId === emp.id}
                          style={{ 
                            width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', 
                            background: '#f8fafc', fontSize: 13, color: '#0f172a', outline: 'none' 
                          }}
                        >
                          <option value="">-- No Manager --</option>
                          {allManagers.map(m => (
                            <option key={m.id} value={m.id} disabled={m.id === emp.id}>{m.full_name} ({m.emp_code || m.designation || 'N/A'})</option>
                          ))}
                        </select>
                        {savingId === emp.id && <span style={{ fontSize: 11, color: '#3b82f6' }}>Saving...</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 12,
                        background: emp.status === 'active' ? '#dcfce7' : emp.status === 'pending' ? '#fef3c7' : '#f1f5f9',
                        color: emp.status === 'active' ? '#16a34a' : emp.status === 'pending' ? '#d97706' : '#64748b'
                      }}>
                        {emp.status ? emp.status.toUpperCase() : 'UNKNOWN'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Showing {Math.min((page - 1) * perPage + 1, total)} to {Math.min(page * perPage, total)} of {total} entries
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button 
              disabled={page === 1} onClick={() => fetchPage(page - 1, search)}
              style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: page === 1 ? '#f1f5f9' : '#fff', color: page === 1 ? '#94a3b8' : '#334155', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              Previous
            </button>
            <button 
              disabled={page === totalPages} onClick={() => fetchPage(page + 1, search)}
              style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: page === totalPages ? '#f1f5f9' : '#fff', color: page === totalPages ? '#94a3b8' : '#334155', borderRadius: 6, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              Next
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
