import React, { useState, useEffect } from 'react';
import { initials, statusBadge, formatDT } from './helpers';
import { openEmployeeDocument } from '@/lib/clientDocs';

function LeaveHistorySection({ employeeId, API, auth }) {
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!employeeId) return;
    fetch(`${API}/leave/employee/${employeeId}/requests?per_page=5`, { headers: auth() })
      .then(r => r.json()).then(d => { setRequests(d.requests || []); setTotal(d.total || 0); }).catch(() => {});
    fetch(`${API}/leave/employee/${employeeId}/balance`, { headers: auth() })
      .then(r => r.json()).then(d => setBalances(d.balances || [])).catch(() => {});
  }, [employeeId]);
  const pending = requests.filter(r => (r.status || '').toLowerCase() === 'pending').length;
  const approved = requests.filter(r => (r.status || '').toLowerCase() === 'approved').length;
  return (
    <div className="emp-drawer-group">
      <h3>Leave History</h3>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: '#efeafe' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{total}</div>
          <div style={{ fontSize: 10, color: '#6366f1' }}>Total</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: '#fffbeb' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>{pending}</div>
          <div style={{ fontSize: 10, color: '#d97706' }}>Pending</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: '#f0fdf4' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{approved}</div>
          <div style={{ fontSize: 10, color: '#16a34a' }}>Approved</div>
        </div>
      </div>
      {balances.length > 0 && (
        <div style={{ fontSize: 12, color: '#0f172a', marginBottom: 8 }}>
          {balances.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>{b.leave_type}</span>
              <span style={{ fontWeight: 600 }}>{(b.remaining_days ?? 0).toFixed(0)} days left</span>
            </div>
          ))}
        </div>
      )}
      {requests.length > 0 && (
        <div style={{ fontSize: 12 }}>
          {requests.slice(0, 3).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
              <span>{r.leave_type}</span>
              <span style={{ fontWeight: 500, color: r.status === 'approved' ? '#16a34a' : r.status === 'rejected' ? '#dc2626' : '#d97706' }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
      {total > 5 && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 6 }}>+{total - 5} more requests</div>}
    </div>
  );
}

export default function EmployeeDrawer({ selectedEmp, drawerLoading, drawerError, closeDrawer, API, auth }) {
  return (
    <>
      <div className="emp-drawer-overlay" onClick={closeDrawer} />
      <div className="emp-drawer">
        <div className="emp-drawer-hdr">
          <h2>Employee Profile</h2>
          <button className="emp-drawer-close" onClick={closeDrawer}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="emp-drawer-body">
          {drawerLoading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              Loading...
            </div>
          ) : drawerError || !selectedEmp ? (
            <div className="text-center py-5" style={{ color: '#dc2626' }}>
              {drawerError || 'Failed to load employee details.'}
            </div>
          ) : (
            <>
              <div className="emp-drawer-profile">
                {selectedEmp.profile_photo
                  ? <img src={selectedEmp.profile_photo} alt="" className="emp-drawer-avatar" style={{borderRadius:'50%', width:80, height:80, objectFit:'cover'}} />
                  : <div className="emp-drawer-avatar">{initials(selectedEmp.full_name)}</div>
                }
                <div className="emp-drawer-name">{selectedEmp.full_name}</div>
                <div className="emp-drawer-role">{selectedEmp.designation || 'No Designation'} {statusBadge(selectedEmp.status)}</div>
              </div>
              <div className="emp-drawer-groups">
                <div className="emp-drawer-group">
                  <h3>Contact</h3>
                  <div className="emp-drawer-row"><span className="lbl">Email</span><span className="val">{selectedEmp.email_id}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Mobile</span><span className="val">{selectedEmp.mobile_no}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Alternate</span><span className="val">{selectedEmp.alternate_mobile_no || '—'}</span></div>
                </div>
                <div className="emp-drawer-group">
                  <h3>Employment</h3>
                  <div className="emp-drawer-row"><span className="lbl">Employee Code</span><span className="val">{selectedEmp.emp_code}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Designation</span><span className="val">{selectedEmp.designation || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Department</span><span className="val">{selectedEmp.department || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Joining Date</span><span className="val">{formatDT(selectedEmp.created_on)}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Previous Company</span><span className="val">{selectedEmp.previous_company || '—'}</span></div>
                </div>
                <div className="emp-drawer-group">
                  <h3>Personal</h3>
                  <div className="emp-drawer-row"><span className="lbl">Father/Spouse</span><span className="val">{selectedEmp.father_spouse_name || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Date of Birth</span><span className="val">{selectedEmp.dob ? new Date(selectedEmp.dob).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Present Address</span><span className="val">{selectedEmp.present_address || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Permanent Address</span><span className="val">{selectedEmp.permanent_address || '—'}</span></div>
                </div>
                <div className="emp-drawer-group">
                  <h3>Education</h3>
                  <div className="emp-drawer-row"><span className="lbl">College</span><span className="val">{selectedEmp.college_name || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Course</span><span className="val">{selectedEmp.course_name || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Specialization</span><span className="val">{selectedEmp.specialization || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">Duration</span><span className="val">{selectedEmp.course_duration || '—'}</span></div>
                  <div className="emp-drawer-row"><span className="lbl">CGPA</span><span className="val">{selectedEmp.cgpa || '—'}</span></div>
                </div>
                <div className="emp-drawer-group">
                  <h3>Documents</h3>
                  {(() => {
                    let sources = {};
                    try { sources = JSON.parse(selectedEmp.document_sources || '{}'); } catch(e) {}
                    return [
                      { label: 'Identity Proof', field: 'identity_proof' },
                      { label: 'Address Proof', field: 'address_proof' },
                      { label: 'Resume', field: 'resume_path' },
                      { label: '10th Marksheet', field: 'marksheet10' },
                      { label: '12th Marksheet', field: 'marksheet12' },
                      { label: 'UG Degree', field: 'ug_document' },
                      { label: 'PG Degree', field: 'pg_document' },
                      { label: 'Offer Letter', field: 'offer_letter' },
                      { label: 'Appointment Letter', field: 'appointment_letter' },
                      { label: 'Internship Certificate', field: 'internship_certificate' },
                      { label: 'Photograph', field: 'photograph' },
                    ].map(({ label, field }) => {
                      const path = selectedEmp[field];
                      const isEmployeeUploaded = sources[field] === 'employee';
                      return (
                        <div key={field} className="emp-drawer-row">
                          <span className="lbl">{label}</span>
                          <span className="val">
                            {path ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <a href="#" onClick={(e) => { e.preventDefault(); openEmployeeDocument(selectedEmp.id, field); }} style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 500, fontSize: 13 }}>
                                  View &darr;
                                </a>
                                {isEmployeeUploaded && (
                                  <span style={{ fontSize: 10, background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    Employee Upload
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>No document uploaded</span>
                            )}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <LeaveHistorySection employeeId={selectedEmp.id} API={API} auth={auth} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
