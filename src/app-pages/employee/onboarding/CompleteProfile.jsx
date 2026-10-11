import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { DOC_OPTIONS } from '@/lib/documents';
import { useNavigate } from 'react-router-dom';

const s = {
    page: { minHeight: '100vh', background: '#f8fafc', padding: '24px 15px', boxSizing: 'border-box' },
    card: { maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '21px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e8f0ff' },
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 },
    logoutBtn: { flexShrink: 0, padding: '8px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
    title: { fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" },
    subtitle: { fontSize: 13.5, color: '#64748b', margin: '0 0 20px' },
    remarksBox: { background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '14px 16px', marginBottom: 20 },
    remarksTitle: { fontSize: 13, fontWeight: 700, color: '#b91c1c', margin: '0 0 4px' },
    remarksText: { fontSize: 13.5, color: '#991b1b', margin: 0 },
    field: { marginBottom: 16 },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
    input: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' },
    textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', background: '#fff' },
    fileInput: { width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fafbfc' },
    sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 24, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #eff6ff', fontFamily: "'Outfit', sans-serif" },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
    submitBtn: { padding: '12px 24px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 24 },
};

const DOCS = DOC_OPTIONS.map(d => ({ label: d.label, name: d.key }));

export default function CompleteProfile({ onSubmitted }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState(null);

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('permissions');
        sessionStorage.removeItem('employee_status');
        sessionStorage.removeItem('hr_remarks');
        navigate('/login', { replace: true });
    };
    const [form, setForm] = useState({
        full_name: '', father_spouse_name: '', dob: '', present_address: '', permanent_address: '',
        mobile_no: '', college_name: '', course_name: '', specialization: '', course_duration: '', cgpa: '',
        alternate_mobile_no: '', previous_company: '', bank_name: '', account_number: '', pan: '',
        location: '', date_of_joining: '',
    });
    const [files, setFiles] = useState({});

    useEffect(() => {
        fetch('/api/profile', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
            .then(r => r.json())
            .then(data => {
                setProfile(data);
                setForm(prev => {
                    const next = { ...prev };
                    Object.keys(prev).forEach(k => {
                        if (data[k] != null) next[k] = k === 'dob' || k === 'date_of_joining' ? String(data[k]).slice(0, 10) : data[k];
                    });
                    return next;
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleFile = (e) => {
        const { name, multiple, files: fl } = e.target;
        setFiles(prev => ({ ...prev, [name]: multiple ? Array.from(fl) : fl[0] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.full_name.trim() || !form.father_spouse_name.trim() || !form.dob || !form.present_address.trim() || !form.mobile_no.trim()) {
            Swal.fire({ icon: 'warning', title: 'Missing details', text: 'Please fill in all the required fields (marked with *).' });
            return;
        }
        // compulsory documents set by HR: each needs a file now, or one uploaded earlier
        const requiredKeys = (profile && profile.required_documents) || [];
        const doneKeys = (profile && profile.uploaded_documents) || [];
        const missingKeys = requiredKeys.filter(k => !(files[k]) && !doneKeys.includes(k));
        if (missingKeys.length > 0) {
            const names = DOCS.filter(d => missingKeys.includes(d.name)).map(d => d.label).join(', ');
            Swal.fire({ icon: 'warning', title: 'Documents required', text: 'Please upload the compulsory document(s): ' + names });
            return;
        }
        setSubmitting(true);
        const data = new FormData();
        Object.entries(form).forEach(([k, v]) => data.append(k, v || ''));
        Object.entries(files).forEach(([k, v]) => {
            if (Array.isArray(v)) v.forEach(f => data.append(k, f));
            else if (v) data.append(k, v);
        });
        try {
            const res = await fetch('/api/employee/complete-profile', {
                method: 'PUT',
                headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') },
                body: data,
            });
            const result = await res.json();
            if (res.ok) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Details Saved',
                    text: 'Your details have been submitted to HR. You can use the portal once HR reviews and activates your account.',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#1e40af',
                });
                onSubmitted && onSubmitted();
            } else {
                Swal.fire({ icon: 'error', title: 'Could not save', text: result.detail || 'Failed to submit profile.' });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Connection error', text: 'Failed to connect to the server: ' + err.message });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 45, color: '#64748b' }}>Loading...</div>;

    return (
        <div style={s.page}>
            <div style={s.card}>
                <div style={s.header}>
                    <h2 style={s.title}>👋 Complete Your Profile</h2>
                    <button type="button" style={s.logoutBtn} onClick={handleLogout}>Log Out</button>
                </div>
                <p style={s.subtitle}>
                    Fill in your details below. Once submitted, HR will review and activate your account.
                    {profile?.emp_code && <> Your Employee ID is <strong>{profile.emp_code}</strong>.</>}
                </p>

                {profile?.hr_remarks && (
                    <div style={s.remarksBox}>
                        <p style={s.remarksTitle}>⚠️ HR requested a correction:</p>
                        <p style={s.remarksText}>{profile.hr_remarks}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} encType="multipart/form-data">
                    <div style={s.sectionTitle}>Personal Details</div>
                    <div style={s.grid2}>
                        <div style={s.field}>
                            <label style={s.label}>Full Name *</label>
                            <input style={s.input} name="full_name" value={form.full_name} onChange={handleChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Father / Spouse Name *</label>
                            <input style={s.input} name="father_spouse_name" value={form.father_spouse_name} onChange={handleChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Date of Birth *</label>
                            <input type="date" style={s.input} name="dob" value={form.dob} onChange={handleChange} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Mobile Number *</label>
                            <input style={s.input} name="mobile_no" value={form.mobile_no} onChange={handleChange} maxLength={10} required />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Alternate Mobile</label>
                            <input style={s.input} name="alternate_mobile_no" value={form.alternate_mobile_no} onChange={handleChange} maxLength={10} />
                        </div>
                        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Present Address *</label>
                            <textarea style={s.textarea} rows={2} name="present_address" value={form.present_address} onChange={handleChange} required />
                        </div>
                        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Permanent Address</label>
                            <textarea style={s.textarea} rows={2} name="permanent_address" value={form.permanent_address} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Education</div>
                    <div style={s.grid3}>
                        <div style={s.field}>
                            <label style={s.label}>College Name</label>
                            <input style={s.input} name="college_name" value={form.college_name} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Course</label>
                            <input style={s.input} name="course_name" value={form.course_name} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Specialization</label>
                            <input style={s.input} name="specialization" value={form.specialization} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Course Duration</label>
                            <input style={s.input} name="course_duration" value={form.course_duration} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>CGPA / Percentage</label>
                            <input style={s.input} name="cgpa" value={form.cgpa} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Previous Company</label>
                            <input style={s.input} name="previous_company" value={form.previous_company} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Bank &amp; Joining Details</div>
                    <div style={s.grid3}>
                        <div style={s.field}>
                            <label style={s.label}>Bank Name</label>
                            <input style={s.input} name="bank_name" value={form.bank_name} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Account Number</label>
                            <input style={s.input} name="account_number" value={form.account_number} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>PAN</label>
                            <input style={s.input} name="pan" value={form.pan} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Location</label>
                            <input style={s.input} name="location" value={form.location} onChange={handleChange} />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Date of Joining</label>
                            <input type="date" style={s.input} name="date_of_joining" value={form.date_of_joining} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={s.sectionTitle}>Documents</div>
                    <p style={{ fontSize: 12.5, color: '#94a3b8', margin: '-8px 0 14px' }}>
                        {profile && profile.required_documents && profile.required_documents.length > 0
                            ? <>Documents marked <b style={{ color: '#dc2626' }}>*</b> are compulsory - HR needs them before you can submit. The rest are optional.</>
                            : 'Upload whichever of these you have - none are required to submit, and you can add the rest later.'}
                    </p>
                    <div style={s.grid3}>
                        {DOCS.map(({ label, name }) => {
                            const isReq = !!(profile && profile.required_documents && profile.required_documents.includes(name));
                            const had = !!(profile && profile.uploaded_documents && profile.uploaded_documents.includes(name));
                            return (
                                <div style={s.field} key={name}>
                                    <label style={s.label}>{label}{isReq && <span style={{ color: '#dc2626' }}> *</span>}{had && <span style={{ color: '#16a34a', fontWeight: 500, fontSize: 11.5 }}> (already uploaded)</span>}</label>
                                    <input type="file" style={s.fileInput} name={name} accept="application/pdf,image/jpeg,image/jpg,image/png" onChange={handleFile} />
                                </div>
                            );
                        })}
                        <div style={{ ...s.field, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Additional Documents</label>
                            <input type="file" style={s.fileInput} name="AdditionalDocuments" multiple accept="application/pdf,image/jpeg,image/jpg,image/png" onChange={handleFile} />
                        </div>
                    </div>

                    <button type="submit" style={s.submitBtn} disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit for HR Review'}
                    </button>
                </form>
            </div>
        </div>
    );
}
