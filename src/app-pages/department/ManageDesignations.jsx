import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import Pagination, { paginate } from '../shared/Pagination';

const PAGE_SIZE = 10;

export default function ManageDesignations() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { setPage(1); }, [designations.length]);
  const pageItems = paginate(designations, page, pageSize);

  useEffect(() => {
    Promise.all([
      fetch('/api/departments/', {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
      }).then(res => res.json()),
      fetch('/api/designations/', {
        headers: { 'Authorization': 'Bearer ' + sessionStorage.getItem('token') }
      }).then(res => res.json())
    ])
      .then(([deps, desigs]) => {
        setDepartments(deps || []);
        setDesignations(desigs || []);
      })
      .catch(err => console.error(err));
  }, []);

  const deleteDesignation = (id) => {
    Swal.fire({
      title: 'Delete Designation?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes'
    }).then(r => {
      if (!r.isConfirmed) return;

      fetch(`/api/designations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + sessionStorage.getItem('token')
        }
      })
        .then(res => {
          if (res.ok) {
            setDesignations(prev => prev.filter(d => d.id !== id));
            Swal.fire('Designation deleted successfully', '', 'success');
          } else {
            Swal.fire('Error', 'Failed to delete designation', 'error');
          }
        });
    });
  };

  return (
    <div className="animate-in">
      <div className="glass-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="page-title m-0" style={{ fontSize: '1.75rem' }}>👔 Designations <span style={{fontSize: '0.85rem', fontWeight: 500, color: '#64748b'}}>({designations.length})</span></h4>
          <button className="btn-premium" style={{ padding: '6px 14px', fontSize: '0.85rem' }} onClick={() => navigate('/masters/designations/add')}>
            ➕ Add Designation
          </button>
        </div>

        <div className="premium-table-wrapper">
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{width: 40}}>#</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Description</th>
                <th width="160">Action</th>
              </tr>
            </thead>
            <tbody>
              {designations && designations.length > 0 ? (
                pageItems.map((d, idx) => (
                  <tr key={d.id}>
                    <td style={{color:'#64748b', fontSize:'.85rem'}}>{(page - 1) * pageSize + idx + 1}</td>
                    <td><strong>{d.name}</strong></td>
                    <td>
                      <span className="badge-premium badge-primary">
                        {departments.find(dept => dept.id === d.department_id)?.name || d.department_name}
                      </span>
                    </td>
                    <td className="text-muted">{d.description}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <Link className="btn-premium-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} to={`/masters/designations/edit/${d.id}`}>Edit</Link>
                        <button className="btn-danger-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => deleteDesignation(d.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                    No designations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination page={page} totalItems={designations.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={n => { setPageSize(n); setPage(1); }} itemLabel="designations" />
        </div>
      </div>
    </div>
  );
}
