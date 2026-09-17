import React, { useState, useEffect } from 'react';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

const thStyle = { textAlign: 'left', padding: '12px 16px', borderBottom: '2px solid var(--border, #e2e8f0)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px 16px', borderBottom: '1px solid var(--border, #f1f5f9)', fontSize: '0.9rem' };

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ emp_code: '', email_id: '', full_name: '', mobile_no: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [employees.length]);
  const pageItems = paginate(employees, page, pageSize);

  const fetchEmployees = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch('/api/employee/management', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : []);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.error(err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/employee/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ emp_code: '', email_id: '', full_name: '', mobile_no: '' });
        fetchEmployees();
      } else {
        alert("Registration failed");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Employees <span style={{fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)'}}>({employees.length})</span></h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add Employee
        </button>
      </div>

      <div className="glass-card table-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{...thStyle, width: 40}}>#</th>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Mobile</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((emp, idx) => (
              <tr key={emp.id}>
                <td style={{...tdStyle, color: 'var(--text-secondary)'}}>{(page - 1) * pageSize + idx + 1}</td>
                <td style={{...tdStyle, fontWeight: 600, color: 'var(--accent)'}}>{emp.emp_code}</td>
                <td style={{...tdStyle, fontWeight: 500}}>{emp.full_name}</td>
                <td style={{...tdStyle, color: 'var(--text-secondary)'}}>{emp.email_id}</td>
                <td style={tdStyle}>{emp.mobile_no}</td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: emp.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : emp.status === 'dropped' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(250, 204, 21, 0.2)',
                    color: emp.status === 'active' ? 'var(--success)' : emp.status === 'dropped' ? 'var(--danger)' : '#a16207'
                  }}>
                    {emp.status === 'active' ? 'Active' : emp.status === 'dropped' ? 'Dropped' : 'Pending'}
                  </span>
                </td>
                <td style={tdStyle}>{new Date(emp.created_on).toLocaleDateString()}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan="7" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)'}}>
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalItems={employees.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="employees" />
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Onboard New Employee</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div className="form-group">
                  <label className="form-label">Employee Code</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.emp_code}
                    onChange={e => setFormData({...formData, emp_code: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    required 
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={formData.email_id}
                  onChange={e => setFormData({...formData, email_id: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.mobile_no}
                  onChange={e => setFormData({...formData, mobile_no: e.target.value})}
                  required 
                />
              </div>
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem'}}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Employees;
