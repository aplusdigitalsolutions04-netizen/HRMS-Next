import React, { useState, useEffect } from 'react';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

function Departments() {
  const [departments, setDepartments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [departments.length]);
  const pageItems = paginate(departments, page, pageSize);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments/');
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/departments/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: '', description: '' });
        fetchDepartments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Departments <span style={{fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)'}}>({departments.length})</span></h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add Department
        </button>
      </div>

      <div className="glass-card table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((dept, idx) => (
              <tr key={dept.id}>
                <td style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>{(page - 1) * pageSize + idx + 1}</td>
                <td><span style={{color: 'var(--text-secondary)', fontSize: '0.875rem'}}>{dept.id.substring(0, 8)}...</span></td>
                <td style={{fontWeight: 500}}>{dept.name}</td>
                <td style={{color: 'var(--text-secondary)'}}>{dept.description || '-'}</td>
                <td>{new Date(dept.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan="5" style={{textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)'}}>
                  No departments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalItems={departments.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="departments" />
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Department</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>
              <div style={{display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem'}}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Department</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Departments;
