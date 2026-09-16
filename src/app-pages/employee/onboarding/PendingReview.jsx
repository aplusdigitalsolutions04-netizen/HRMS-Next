import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PendingReview() {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('permissions');
        localStorage.removeItem('employee_status');
        localStorage.removeItem('hr_remarks');
        navigate('/login', { replace: true });
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
            <div style={{ maxWidth: 460, textAlign: 'center', background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f0ff' }}>
                <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 10px', fontFamily: "'Outfit', sans-serif" }}>
                    Your profile is under review
                </h2>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: '0 0 24px' }}>
                    Thanks for submitting your details. Our HR team is reviewing your profile.
                    You'll be able to access your dashboard once it's approved.
                </p>
                <button
                    onClick={handleLogout}
                    style={{ padding: '10px 24px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13.5, fontWeight: 600 }}
                >
                    Log Out
                </button>
            </div>
        </div>
    );
}
