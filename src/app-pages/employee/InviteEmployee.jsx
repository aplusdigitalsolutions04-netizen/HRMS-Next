import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function InviteEmployee() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ full_name: '', email_id: '', emp_code: '' });
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/employee/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...auth() },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Invite Created',
                    html: `Employee ID <strong>${data.emp_code}</strong> was generated.<br/>Go to <strong>Employee Credentials</strong> to view/send the login details.`,
                });
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
        card: { maxWidth: 560, margin: '40px auto', background: '#fff', borderRadius: 16, padding: '28px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff' },
        title: { fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', fontFamily: "'Outfit', sans-serif" },
        subtitle: { fontSize: 13.5, color: '#64748b', margin: '0 0 22px' },
        field: { marginBottom: 16 },
        label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
        input: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
        actions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
        backBtn: { padding: '10px 20px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' },
        submitBtn: { padding: '10px 24px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    };

    return (
        <div style={s.card}>
            <h2 style={s.title}>📨 Invite Employee</h2>
            <p style={s.subtitle}>
                Create a login for a new employee. They'll receive a temporary password to log in
                and fill in the rest of their own details (including mobile number) themselves -
                which then lands in Pending Approval for your review.
            </p>
            <form onSubmit={handleSubmit}>
                <div style={s.field}>
                    <label style={s.label}>Full Name *</label>
                    <input style={s.input} name="full_name" value={form.full_name} onChange={handleChange} required />
                </div>
                <div style={s.field}>
                    <label style={s.label}>Email *</label>
                    <input type="email" style={s.input} name="email_id" value={form.email_id} onChange={handleChange} required />
                </div>
                <div style={s.field}>
                    <label style={s.label}>Employee ID *</label>
                    <input style={s.input} name="emp_code" value={form.emp_code} onChange={handleChange} required />
                </div>
                <div style={s.actions}>
                    <Link to="/employees/manage" style={s.backBtn}>Cancel</Link>
                    <button type="submit" style={s.submitBtn} disabled={submitting}>
                        {submitting ? 'Sending Invite...' : 'Create Invite'}
                    </button>
                </div>
            </form>
        </div>
    );
}
