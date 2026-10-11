import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { DOC_OPTIONS } from '@/lib/documents';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

export default function InviteEmployee() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ full_name: '', email_id: '', emp_code: '' });
    const [submitting, setSubmitting] = useState(false);
    const [reqDocs, setReqDocs] = useState([]);
    const toggleDoc = (k) => setReqDocs(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/employee/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify({ ...form, required_documents: reqDocs }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data.email_sent) {
                    await Swal.fire({
                        icon: 'success',
                        title: 'Invite Sent',
                        html: `Login details were emailed to <strong>${form.email_id}</strong>.<br/>Employee ID: <strong>${data.emp_code}</strong>`,
                    });
                } else {
                    await Swal.fire({
                        icon: 'warning',
                        title: 'Invite created, email NOT sent',
                        html: `Employee ID <strong>${data.emp_code}</strong> was created, but the email could not be sent${data.email_error ? `:<br/><em>${data.email_error}</em>` : '.'}<br/>Fix the issue and press <strong>Send</strong> on the Employee Credentials page.`,
                    });
                }
                navigate('/employee-credentials');
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: data.detail || 'Failed to invite employee' });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to connect to the server: ' + err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const s = {
        card: { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e8f0ff' },
        h3: { fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: '0 0 12px', fontFamily: "'Outfit', sans-serif" },
        field: { marginBottom: 14 },
        label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 5 },
        input: { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
        backBtn: { padding: '9px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' },
        submitBtn: { padding: '9px 20px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
        link: { border: 'none', background: 'none', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 },
    };

    // Everything fits on one screen: details on the left, the compulsory documents on the right, buttons below.
    return (
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <div className="ph" style={{ marginBottom: 12 }}>
                <div>
                    <h1>Invite Employee</h1>
                    <p>Create a login for a new employee. They get a temporary password, fill in the rest of their own details (including mobile number) and it then lands in Pending Approval for your review.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 14, alignItems: 'start' }} className="inv-grid">
                <style>{`@media (max-width: 900px) { .inv-grid { grid-template-columns: 1fr !important; } }`}</style>
                <div style={s.card}>
                    <h3 style={s.h3}>Employee details</h3>
                    <div style={s.field}>
                        <label style={s.label}>Full Name *</label>
                        <input style={s.input} name="full_name" value={form.full_name} onChange={handleChange} placeholder="e.g. Rahul Sharma" required />
                    </div>
                    <div style={s.field}>
                        <label style={s.label}>Email *</label>
                        <input type="email" style={s.input} name="email_id" value={form.email_id} onChange={handleChange} placeholder="name@example.com" required />
                    </div>
                    <div style={{ ...s.field, marginBottom: 0 }}>
                        <label style={s.label}>Employee ID *</label>
                        <input style={s.input} name="emp_code" value={form.emp_code} onChange={handleChange} placeholder="e.g. 0042" required />
                    </div>
                </div>

                <div style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                        <h3 style={{ ...s.h3, margin: 0 }}>Compulsory documents <span style={{ fontWeight: 500, color: '#94a3b8', fontSize: 12 }}>(optional)</span></h3>
                        <span style={{ display: 'flex', gap: 12 }}>
                            <button type="button" style={s.link} onClick={() => setReqDocs(DOC_OPTIONS.map(d => d.key))}>Select all</button>
                            <button type="button" style={s.link} onClick={() => setReqDocs([])}>Clear</button>
                        </span>
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#64748b' }}>The employee cannot submit their profile without the documents you tick here.{reqDocs.length > 0 && <b style={{ color: '#2563eb' }}> {reqDocs.length} selected</b>}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                        {DOC_OPTIONS.map(d => (
                            <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', border: '1px solid ' + (reqDocs.includes(d.key) ? '#2563eb' : '#e2e8f0'), background: reqDocs.includes(d.key) ? '#eff6ff' : '#fff', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#0f172a' }}>
                                <input type="checkbox" checked={reqDocs.includes(d.key)} onChange={() => toggleDoc(d.key)} />
                                {d.label}
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <Link to="/employees/manage" style={s.backBtn}>Cancel</Link>
                <button type="submit" style={s.submitBtn} disabled={submitting}>
                    {submitting ? 'Sending Invite...' : 'Create Invite'}
                </button>
            </div>
        </form>
    );
}
