import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function EditEmployee() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [loading, setLoading] = useState(true);
    const [employee, setEmployee] = useState({
        id: '', emp_code: '', full_name: '', email_id: '', mobile_no: '', alternate_mobile_no: '',
        official_email: '', official_no: '', father_spouse_name: '', dob: '', present_address: '', permanent_address: '',
        college_name: '', course_name: '', specialization: '', course_duration: '', cgpa: '',
        previous_company: '', designation: '', manager_id: '', status: 'pending',
        marksheet_12: '', pg_document: '', appointment_letter: '', internship_certificate: '', photograph: '',
        date_of_joining: '', account_number: '', bank_name: '', pan: '', uan: '', location: 'Gurgaon, HR', pay_mode: 'Online'
    });
    const [employeeOptions, setEmployeeOptions] = useState([]);

    useEffect(() => {
        if (id) {
            fetch(`/api/employee/detail/${id}`, {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            })
                .then(res => res.json())
                .then(data => {
                    const dob = data.dob ? new Date(data.dob).toISOString().split('T')[0] : '';
                    const date_of_joining = data.date_of_joining ? new Date(data.date_of_joining).toISOString().split('T')[0] : '';
                    setEmployee({ ...data, dob, date_of_joining, manager_id: data.manager_id || '' });
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            setLoading(false);
        }

        fetch('/api/employee/management', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        })
            .then(res => res.json())
            .then(data => setEmployeeOptions(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEmployee(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {};
        Object.keys(employee).forEach(key => {
            const val = employee[key];
            if (val === null || val === undefined || key.endsWith('File')) return;
            if (key === 'dob' && val === '') return;
            payload[key] = val;
        });

        fetch(`/api/employee/edit/${employee.id || id}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token'), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(async res => {
            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(errBody || `HTTP ${res.status}`);
            }
            return res.text();
        })
        .then(() => {
            Swal.fire({
                icon: 'success', title: 'Updated Successfully',
                text: 'Employee details have been updated', confirmButtonText: 'OK'
            }).then(() => navigate('/employees/manage'));
        })
        .catch(err => {
            Swal.fire('Error', 'Update failed: ' + err.message, 'error');
        });
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</div>;
    if (!employee.id && !id) return <div style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>No Employee Selected</div>;

    const s = {
        page: { background: '#f8fafc', minHeight: '100vh', padding: '10px 24px' },
        card: { background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 28, border: '1px solid #f1f0ff' },
        sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16, fontFamily: "'Outfit', sans-serif" },
        field: { marginBottom: 16 },
        label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
        input: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' },
        textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', background: '#fff' },
        select: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' },
        fileInput: { width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fafbfc' },
        divider: { border: 'none', borderTop: '2px solid #eef2ff', margin: '24px 0' },
        grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
        grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
        grid4: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 },
        gridFull: { gridColumn: '1 / -1' },
        submitBtn: { width: '100%', padding: '12px 24px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 24 },
        link: { color: '#6366f1', fontSize: 12, textDecoration: 'none', fontWeight: 500 },
        badge: { fontSize: 9, background: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: 3, fontWeight: 600 },
    };

    let ds = {};
    try { ds = JSON.parse(employee.document_sources || '{}'); } catch (e) {}

    const docFields = [
        { label: 'Identity Proof', field: 'identity_proof' },
        { label: 'Address Proof', field: 'address_proof' },
        { label: 'Resume', field: 'resume_path' },
        { label: 'UG Degree', field: 'ug_document' },
        { label: '10th Marksheet', field: 'marksheet10' },
        { label: '12th Marksheet', field: 'marksheet12' },
        { label: 'Offer Letter', field: 'offer_letter' },
        { label: 'PG Degree', field: 'pg_document' },
        { label: 'Appointment Letter', field: 'appointment_letter' },
        { label: 'Internship Certificate', field: 'internship_certificate' },
        { label: 'Photograph', field: 'photograph' },
    ];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '24px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #eef2ff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                                Back
                            </button>
                            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Edit Employee</h2>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={s.sectionTitle}>Personal Details</div>
                        <div style={s.grid2}>
                            <div style={{...s.field, ...s.gridFull}}>
                                <label style={s.label}>Employee ID</label>
                                <input style={s.input} name="emp_code" value={employee.emp_code} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Name</label>
                                <input style={s.input} name="full_name" value={employee.full_name} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Email</label>
                                <input style={s.input} name="email_id" value={employee.email_id} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Father / Spouse Name</label>
                                <input style={s.input} name="father_spouse_name" value={employee.father_spouse_name} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Mobile</label>
                                <input style={s.input} name="mobile_no" value={employee.mobile_no} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Alternate Mobile</label>
                                <input style={s.input} name="alternate_mobile_no" value={employee.alternate_mobile_no} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>DOB</label>
                                <input type="date" style={s.input} name="dob" value={employee.dob} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Present Address</label>
                                <textarea style={s.textarea} name="present_address" value={employee.present_address} onChange={handleChange} rows={2}></textarea>
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Permanent Address</label>
                                <textarea style={s.textarea} name="permanent_address" value={employee.permanent_address} onChange={handleChange} rows={2}></textarea>
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Employee Status</label>
                                <select style={s.select} name="status" value={employee.status || 'pending'} onChange={handleChange}>
                                    <option value="active">Active</option>
                                    <option value="pending">Pending</option>
                                    <option value="dropped">Dropped</option>
                                </select>
                            </div>
                        </div>

                        <hr style={s.divider} />

                        <div style={s.sectionTitle}>Education / Work</div>
                        <div style={s.grid2}>
                            <div style={s.field}>
                                <label style={s.label}>College</label>
                                <input style={s.input} name="college_name" value={employee.college_name} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Course</label>
                                <input style={s.input} name="course_name" value={employee.course_name} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Specialization</label>
                                <input style={s.input} name="specialization" value={employee.specialization} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Course Duration</label>
                                <input style={s.input} name="course_duration" value={employee.course_duration} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>CGPA</label>
                                <input style={s.input} name="cgpa" value={employee.cgpa} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Company</label>
                                <input style={s.input} name="previous_company" value={employee.previous_company} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Designation</label>
                                <input style={s.input} name="designation" value={employee.designation} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Reporting Manager</label>
                                <select style={s.select} name="manager_id" value={employee.manager_id || ''} onChange={handleChange}>
                                    <option value="">— None —</option>
                                    {employeeOptions.filter(o => o.id !== (employee.id || id)).map(o => (
                                        <option key={o.id} value={o.id}>{o.full_name} ({o.emp_code})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <hr style={s.divider} />

                        <div style={s.sectionTitle}>Official Details</div>
                        <div style={s.grid2}>
                            <div style={s.field}>
                                <label style={s.label}>Official Email</label>
                                <input style={s.input} name="official_email" value={employee.official_email || ''} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Official No.</label>
                                <input style={s.input} name="official_no" value={employee.official_no || ''} onChange={handleChange} />
                            </div>
                        </div>

                        <hr style={s.divider} />

                        <div style={s.sectionTitle}>Bank Details</div>
                        <div style={s.grid3}>
                            <div style={s.field}>
                                <label style={s.label}>Date of Joining</label>
                                <input type="date" style={s.input} name="date_of_joining" value={employee.date_of_joining || ''} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Account No.</label>
                                <input style={s.input} name="account_number" value={employee.account_number || ''} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Bank Name</label>
                                <input style={s.input} name="bank_name" value={employee.bank_name || ''} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>PAN</label>
                                <input style={s.input} name="pan" value={employee.pan || ''} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Location</label>
                                <input style={s.input} name="location" value={employee.location || ''} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>UAN</label>
                                <input style={s.input} name="uan" value={employee.uan || ''} onChange={handleChange} />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Pay Mode</label>
                                <select style={s.input} name="pay_mode" value={employee.pay_mode || 'Online'} onChange={handleChange}>
                                    <option value="Online">Online</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>
                            <div style={s.field}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Bank Document (PDF/Photo, Max 5MB)</label>
                                {employee.bank_document && (
                                    <div style={{ fontSize: 11, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <a href={`/${employee.bank_document.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" style={s.link}>View current</a>
                                        {ds['bank_document'] === 'employee' && <span style={s.badge}>Employee Upload</span>}
                                    </div>
                                )}
                                <input type="file" accept="application/pdf,image/jpeg,image/jpg,image/png" style={s.fileInput} />
                            </div>
                        </div>

                        <hr style={s.divider} />

                        <div style={s.sectionTitle}>Uploaded Documents</div>
                        <div style={s.grid3}>
                            {docFields.map(({ label, field }) => {
                                const path = employee[field];
                                const isEmpUploaded = ds[field] === 'employee';
                                return (
                                    <div key={field} style={s.field}>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
                                        {path && (
                                            <div style={{ fontSize: 11, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <a href={`/${path.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" style={s.link}>View current</a>
                                                {isEmpUploaded && <span style={s.badge}>Employee Upload</span>}
                                            </div>
                                        )}
                                        <input type="file" accept="application/pdf,image/jpeg,image/jpg,image/png" style={s.fileInput} />
                                    </div>
                                );
                            })}
                            <div style={s.field}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>📁 Additional Documents (PDF/Photo)</label>
                                <input type="file" multiple accept="application/pdf,image/jpeg,image/jpg,image/png" style={s.fileInput} />
                            </div>
                        </div>

                        <button type="submit" style={s.submitBtn}>Update Details</button>
                    </form>
                </div>
            </div>
    );
}
