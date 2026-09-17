import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function HRLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                sessionStorage.setItem('token', data.access_token);
                sessionStorage.setItem('role', data.role || 'USER');
                sessionStorage.setItem('permissions', JSON.stringify(data.permissions || {}));
                if (data.employee_status) sessionStorage.setItem('employee_status', data.employee_status);
                else sessionStorage.removeItem('employee_status');
                if (data.hr_remarks) sessionStorage.setItem('hr_remarks', data.hr_remarks);
                else sessionStorage.removeItem('hr_remarks');
                const mcp = data.must_change_password === true;
                sessionStorage.setItem('must_change_password', mcp ? 'true' : 'false');
                if (mcp) { navigate('/force-change-password', { replace: true }); }
                else { navigate('/'); }
            } else {
                setError(data.detail || 'Invalid username or password');
            }
        } catch (err) {
            setError('Failed to connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    const features = [
        'Automated payroll & payslips',
        'Attendance & leave tracking',
        'Recruitment & onboarding',
        'Expiry alerts & notifications',
        'Role-based access control (RBAC)',
        'Audit trail for all actions',
    ];

    return (
        <>
            <style>{`
                @keyframes lrFadeInLeft { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
                @keyframes lrZoomIn { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
                @keyframes lrBackInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
                @keyframes lrBackInUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
                @keyframes lrSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
                @keyframes lrFadeIn { from{opacity:0} to{opacity:1} }
                @keyframes lrHeartBeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.12)} 28%{transform:scale(1)} 42%{transform:scale(1.08)} 70%{transform:scale(1)} }
                @keyframes lrPulseBlob { 0%,100%{transform:scale(1) translate(0,0)} 50%{transform:scale(1.15) translate(20px,-10px)} }
                @keyframes lrSpin { to{transform:rotate(360deg)} }

                .lr-root { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#e6f7ef 0%,#eef2f7 45%,#e9edf5 100%); padding:24px; box-sizing:border-box; position:relative; overflow:hidden; }

                .lr-blob { position:absolute; width:384px; height:384px; border-radius:50%; filter:blur(64px); opacity:.2; pointer-events:none; mix-blend-mode:multiply; }
                .lr-blob-1 { top:-10%; left:-10%; background:#10b981; animation:lrPulseBlob 8s ease-in-out infinite; }
                .lr-blob-2 { bottom:-10%; right:-10%; background:#059669; animation:lrPulseBlob 8s ease-in-out infinite 1s; }

                .lr-wrap { width:100%; max-width:1180px; display:flex; align-items:center; justify-content:space-between; gap:64px; position:relative; z-index:1; }

                .lr-left { flex:1; max-width:600px; animation:lrFadeInLeft .6s ease both; }
                .lr-eyebrow { display:flex; align-items:center; gap:10px; font-size:.78rem; font-weight:700; letter-spacing:.12em; color:#0f766e; text-transform:uppercase; margin-bottom:20px; }
                .lr-eyebrow::before { content:''; width:22px; height:2px; background:#10b981; display:inline-block; }

                .lr-hero h1 { font-family:'Outfit',sans-serif; font-weight:800; font-size:2.7rem; line-height:1.15; color:#0f172a; margin:0 0 28px; letter-spacing:-0.5px; }
                .lr-hero h1 .accent { color:#10b981; }

                .lr-features { display:flex; flex-direction:column; gap:14px; margin-bottom:32px; }
                .lr-feature { display:flex; align-items:center; gap:12px; font-size:1rem; color:#334155; font-weight:500; animation:lrSlideUp .35s ease both; }
                .lr-feature-check { width:22px; height:22px; border-radius:50%; background:#d1fae5; color:#059669; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

                .lr-badges { display:flex; gap:10px; flex-wrap:wrap; }
                .lr-badge { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:999px; background:rgba(255,255,255,.6); backdrop-filter:blur(4px); border:1px solid #fff; font-size:.78rem; font-weight:700; color:#334155; box-shadow:0 1px 2px rgba(15,23,42,.04); animation:lrSlideUp .35s ease both; }
                .lr-badge svg { color:#10b981; }

                .lr-right { flex-shrink:0; width:420px; }
                .lr-card { background:rgba(255,255,255,.9); backdrop-filter:blur(8px); border-radius:18px; padding:36px 34px; box-shadow:0 20px 50px rgba(15,23,42,.1); border:1px solid rgba(255,255,255,.6); animation:lrZoomIn .5s ease .1s both; }
                .lr-card-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:30px; }
                .lr-brand { display:flex; align-items:center; gap:8px; }
                .lr-brand-logo-img { height:32px; width:auto; max-width:150px; object-fit:contain; }
                .lr-card-top .lr-login-label { font-family:'Outfit',sans-serif; font-weight:800; font-size:.95rem; color:#0f172a; letter-spacing:.04em; animation:lrBackInRight .5s ease .3s both; }

                .lr-error { display:flex; align-items:center; gap:8px; padding:10px 14px; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; color:#dc2626; font-size:.8rem; font-weight:500; margin-bottom:18px; animation:lrSlideUp .25s ease; }

                .lr-form-anim { animation:lrBackInUp .5s ease .35s both; }

                .lr-field { margin-bottom:18px; }
                .lr-field label { display:block; font-size:.72rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#64748b; margin-bottom:8px; }
                .lr-field input { width:100%; padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:.92rem; outline:none; background:#fff; color:#0f172a; transition:all .15s; box-sizing:border-box; }
                .lr-field input:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,0.12); }

                .lr-submit { width:100%; padding:13px; background:#10b981; color:#fff; border:none; border-radius:10px; font-weight:700; font-size:.9rem; letter-spacing:.04em; text-transform:uppercase; cursor:pointer; transition:all .2s; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:8px; }
                .lr-submit:hover:not(:disabled) { background:#059669; transform:translateY(-1px); box-shadow:0 8px 20px rgba(16,185,129,.3); }
                .lr-submit:active:not(:disabled) { transform:scale(.97); }
                .lr-submit:disabled { opacity:.7; cursor:default; }
                .lr-spinner { animation:lrSpin .8s linear infinite; }

                .lr-forgot { display:block; text-align:center; margin-top:16px; font-size:.82rem; color:#64748b; text-decoration:none; cursor:pointer; background:none; border:none; width:100%; transition:color .15s; }
                .lr-forgot:hover { color:#10b981; }

                .lr-footer { text-align:center; margin-top:24px; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:#94a3b8; animation:lrFadeIn .6s ease .5s both; }

                @media (max-width:980px) {
                    .lr-wrap { flex-direction:column; gap:40px; }
                    .lr-left { max-width:100%; text-align:center; }
                    .lr-eyebrow { justify-content:center; }
                    .lr-hero h1 { font-size:2rem; }
                    .lr-feature { justify-content:center; }
                    .lr-badges { justify-content:center; }
                    .lr-right { width:100%; max-width:420px; }
                }
            `}</style>

            <div className="lr-root">
                <div className="lr-blob lr-blob-1" />
                <div className="lr-blob lr-blob-2" />

                <div className="lr-wrap">
                    <div className="lr-left">
                        <div className="lr-eyebrow">HR Management Portal</div>
                        <div className="lr-hero">
                            <h1>One Platform for<br /><span className="accent">People,</span> Payroll &amp; Performance.</h1>
                        </div>

                        <div className="lr-features">
                            {features.map((f, i) => (
                                <div className="lr-feature" key={f} style={{ animationDelay: `${i * 0.05}s` }}>
                                    <span className="lr-feature-check">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </span>
                                    {f}
                                </div>
                            ))}
                        </div>

                        <div className="lr-badges">
                            <span className="lr-badge" style={{ animationDelay: '.3s' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Smart Attendance
                            </span>
                            <span className="lr-badge" style={{ animationDelay: '.36s' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                RBAC Enabled
                            </span>
                            <span className="lr-badge" style={{ animationDelay: '.42s' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                Smart Alerts
                            </span>
                        </div>
                    </div>

                    <div className="lr-right">
                        <div className="lr-card">
                            <div className="lr-card-top">
                                <div className="lr-brand">
                                    <img src="/aplus.png" alt="A Plus Digital Solutions" className="lr-brand-logo-img" />
                                </div>
                                <div className="lr-login-label">LOG IN</div>
                            </div>

                            {error && (
                                <div className="lr-error">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <div className="lr-form-anim">
                                <form onSubmit={handleLogin}>
                                    <div className="lr-field">
                                        <label htmlFor="EmailId">Username or Email</label>
                                        <input type="text" id="EmailId" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your username or email" autoComplete="username" autoFocus required />
                                    </div>

                                    <div className="lr-field">
                                        <label htmlFor="Password">Password</label>
                                        <input type="password" id="Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                                    </div>

                                    <button type="submit" className="lr-submit" disabled={loading}>
                                        {loading ? (
                                            <svg className="lr-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-9-9"/></svg>
                                        ) : 'Log In'}
                                    </button>
                                </form>

                                <button type="button" className="lr-forgot" onClick={() => window.Swal ? window.Swal.fire('Forgot Password', 'Please contact your HR administrator to reset your password.', 'info') : alert('Please contact your HR administrator to reset your password.')}>
                                    Forgot Password?
                                </button>
                            </div>
                        </div>

                        <div className="lr-footer">
                            &copy; 2026 A Plus Digital Solutions
                            <div style={{ marginTop: 6, textTransform: 'none', letterSpacing: 'normal' }}>
                                <Link to="/privacy-policy" style={{ color: '#64748b', textDecoration: 'none' }}>Privacy Policy</Link>
                                <span style={{ margin: '0 8px' }}>·</span>
                                <Link to="/terms-conditions" style={{ color: '#64748b', textDecoration: 'none' }}>Terms &amp; Conditions</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
