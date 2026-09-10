import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

export default function ManageDepartments() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [departments.length]);
  const pageItems = paginate(departments, page, pageSize);

  useEffect(() => {
    fetch('/api/departments/', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
    })
      .then(res => res.json())
      .then(deps => setDepartments(deps || []))
      .catch(err => console.error(err));
  }, []);

  const deleteDepartment = (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Department will be removed',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete'
    }).then((result) => {
      if (!result.isConfirmed) return;

      fetch(`/api/departments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token')
        }
      })
        .then(res => {
          if (res.ok) {
            Swal.fire('Deleted!', 'Department deleted successfully', 'success')
              .then(() => window.location.reload());
          } else {
            Swal.fire('Error', 'Failed to delete department', 'error');
          }
        });
    });
  };

  return (
    <div className="animate-in">
      <div className="glass-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="page-title m-0" style={{ fontSize: '1.75rem' }}>🏢 Departments <span style={{fontSize: '0.85rem', fontWeight: 500, color: '#64748b'}}>({departments.length})</span></h4>
          <button className="btn-premium" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => navigate('/masters/departments/add')}>
            ➕ Add Department
          </button>
        </div>

        <div className="premium-table-wrapper">
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{width: 40}}>#</th>
                <th>Department Name</th>
                <th>Description</th>
                <th width="160">Action</th>
              </tr>
            </thead>
            <tbody>
              {departments && departments.length > 0 ? (
                pageItems.map((d, idx) => (
                  <tr key={d.id}>
                    <td style={{color:'#64748b', fontSize:'.85rem'}}>{(page - 1) * pageSize + idx + 1}</td>
                    <td><strong>{d.name}</strong></td>
                    <td className="text-muted">{d.description}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <Link className="btn-premium-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} to={`/masters/departments/edit/${d.id}`}>Edit</Link>
                        <button className="btn-danger-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => deleteDepartment(d.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                    No departments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalItems={departments.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="departments" />
        </div>
      </div>
    </div>
  );
}
