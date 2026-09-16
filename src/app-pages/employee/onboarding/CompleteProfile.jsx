import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const s = {
    page: { minHeight: '100vh', background: '#f8fafc', padding: '32px 20px', boxSizing: 'border-box' },
    card: { maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff' },
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 4 },
    logoutBtn: { flexShrink: 0, padding: '8px 18px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
    title: { fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" },
    subtitle: { fontSize: 13.5, color: '#64748b', margin: '0 0 20px' },
    remarksBox: { background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '14px 16px', marginBottom: 20 },
    remarksTitle: { fontSize: 13, fontWeight: 700, color: '#b91c1c', margin: '0 0 4px' },
    remarksText: { fontSize: 13.5, color: '#991b1b', margin: 0 },
    field: { marginBottom: 16 },
    label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
    input: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' },
    textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', background: '#fff' },
    fileInput: { width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fafbfc' },
    sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1e293b', marginTop: 24, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #eef2ff', fontFamily: "'Outfit', sans-serif" },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
    submitBtn: { padding: '12px 32px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 24 },
};

export default function CompleteProfile({ onSubmitted }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [profile, setProfile] = useState(null);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('permissions');
        localStorage.removeItem('employee_status');
        localStorage.removeItem('hr_remarks');
        navigate('/login', { replace: true });
    };
    const [form, setForm] = useState({
        full_name: '', father_spouse_name: '', dob: '', present_address: '', permanent_address: '',
        college_name: '', course_name: '', specialization: '', course_duration: '', cgpa: '',
        alternate_mobile_no: '', previous_company: '', bank_name: '', account_number: '', pan: '',
        location: '', date_of_joining: '',
    });
    const [files, setFiles] = useState({});

    useEffect(() => {
        fetch('/api/profile', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })
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
        if (!form.full_name.trim() || !form.father_spouse_name.trim() || !form.dob || !form.present_address.trim()) {
            alert('Please fill in all required fields.');
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
                headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
                body: data,
            });
            const result = await res.json();
            if (res.ok) {
                alert('Profile submitted! HR will review and activate your account.');
                onSubmitted && onSubmitted();
            } else {
                alert(result.detail || 'Failed to submit profile.');
            }
        } catch (err) {
            alert('Failed to connect to the server: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Loading...</div>;

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
                        Upload whichever of these you have - none are required to submit, and you can add the rest later.
                    </p>
                    <div style={s.grid3}>
                        {[
                            { label: 'Identity Proof', name: 'IdentityProof' },
                            { label: 'Address Proof', name: 'AddressProof' },
                            { label: 'Resume', name: 'Resume' },
                            { label: 'UG Degree', name: 'UGDegree' },
                            { label: '10th Marksheet', name: 'Marksheet10' },
                            { label: '12th Marksheet', name: 'Marksheet12' },
                            { label: 'Offer Letter', name: 'OfferLetter' },
                            { label: 'PG Degree', name: 'PGDegree' },
                            { label: 'Appointment Letter', name: 'AppointmentLetter' },
                            { label: 'Internship Certificate', name: 'InternshipCertificate' },
                            { label: 'Photograph', name: 'Photograph' },
                            { label: 'Bank Document', name: 'BankDocument' },
                        ].map(({ label, name }) => (
                            <div style={s.field} key={name}>
                                <label style={s.label}>{label}</label>
                                <input type="file" style={s.fileInput} name={name} accept="application/pdf,image/jpeg,image/jpg,image/png" onChange={handleFile} />
                            </div>
                        ))}
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
