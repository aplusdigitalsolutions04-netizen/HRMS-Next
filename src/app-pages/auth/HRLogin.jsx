import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCompany } from '../shared/useCompany';

// The sign-in page: a calm split screen in the app's brown. The sign-in itself is the same as before: POST /api/token, then the token,
// role and permissions are kept for the session and the person goes to the home page, or to the "set a new password" page when the
// server asks for it. The page always fits the screen (it never scrolls as a whole).
const THEME_KEY = 'login_theme';
const USER_KEY = 'login_remember_user';

const FEATURES = [
    'Automated Payroll & Payslips',
    'Attendance & Leave Tracking',
    'Recruitment & Onboarding',
    'Expiry Alerts & Notifications',
    'Role-Based Access Control (RBAC)',
    'Audit Trail for All Actions',
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
.ap-root{font-family:Inter,'Segoe UI',system-ui,sans-serif;--bg:#1b1411;--card:#241a15;--line:rgba(244,218,185,.16);--text:#f6ece2;--muted:#a8978a;--input:rgba(242,207,171,.05);--input-solid:#2a1f19;--brand:#c9915f;--brand-d:#b27a49;--on-brand:#2a1a10;--accent-text:#e6b886;--err-bg:rgba(220,70,60,.12);--err-line:rgba(240,120,110,.4);--err:#ff9d96;
 position:fixed;inset:0;height:100vh;height:100dvh;width:100%;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(400px,.95fr);background:var(--bg);color:var(--text);overflow:hidden;transition:background .35s,color .35s}
.ap-root[data-theme=light]{--bg:#f8f3ed;--card:#ffffff;--line:rgba(102,63,36,.16);--text:#33231a;--muted:#7a6656;--input:#fbf7f2;--input-solid:#fbf7f2;--brand:#8a5a36;--brand-d:#744a2b;--on-brand:#fff;--accent-text:#8a5a36;--err-bg:#fef2f2;--err-line:#fecaca;--err:#b91c1c}
.ap-root *{box-sizing:border-box}.ap-root button,.ap-root input{font:inherit}.ap-root button{cursor:pointer}
.ap-root button:focus-visible,.ap-root a:focus-visible,.ap-root input:focus-visible{outline:2px solid var(--brand);outline-offset:3px}
.ap-root a{color:var(--brand);text-decoration:none}.ap-root a:hover{text-decoration:underline}

.ap-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.ap-bg:before{content:'';position:absolute;inset:0;animation:apGrid 40s linear infinite;background-image:linear-gradient(color-mix(in srgb,var(--text) 5%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--text) 5%,transparent) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 28% 38%,#000,transparent 72%);-webkit-mask-image:radial-gradient(ellipse at 28% 38%,#000,transparent 72%)}
.ap-bg i{position:absolute;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--brand) 22%,transparent),transparent 70%)}
.ap-bg .g1{width:480px;height:480px;left:-160px;top:-160px;animation:apGlow 11s ease-in-out infinite alternate-reverse}
.ap-bg .g2{width:540px;height:540px;left:20%;bottom:-280px;animation:apGlow 9s ease-in-out infinite alternate}
.ap-bg .g3{width:420px;height:420px;right:-140px;top:-120px;animation:apDrift 14s ease-in-out infinite alternate}
@keyframes apGrid{to{background-position:48px 48px}}
@keyframes apGlow{from{transform:scale(.9);opacity:.7}to{transform:scale(1.15);opacity:1}}
@keyframes apDrift{to{transform:translate(40px,30px) scale(1.12)}}
.ap-show{position:relative;z-index:1;gap:clamp(14px,3vh,28px);padding:clamp(22px,4.6vh,44px) clamp(28px,5vw,72px);color:var(--text);display:flex;flex-direction:column;min-height:0}
.ap-brand{display:flex;align-items:center;min-height:40px}.ap-brand img{height:70px;width:auto;max-width:620px;object-fit:contain}
.ap-brand .ap-logo-l{display:none}.ap-root[data-theme=light] .ap-brand .ap-logo-l{display:block}.ap-root[data-theme=light] .ap-brand .ap-logo-d{display:none}
.ap-tag{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.14em;font-weight:600;text-transform:uppercase;color:var(--accent-text)}
.ap-tag:before{content:'';width:22px;height:2px;background:var(--brand);display:inline-block;transform-origin:left;animation:apLine .8s .1s ease both}
@keyframes apLine{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.ap-story{max-width:100%;margin:auto 0}
.ap-story h1{font-size:clamp(20px,1.8vw,32px);white-space:nowrap;line-height:1.2;letter-spacing:-1px;margin:14px 0 clamp(12px,2.6vh,28px);font-weight:700;color:var(--text)}
.ap-story h1 em{font-style:normal;color:var(--accent-text)}
.ap-ln{display:block;overflow:hidden;padding-bottom:3px;margin-bottom:-3px}.ap-ln>span{display:block;animation:apReveal .75s cubic-bezier(.2,.75,.25,1) both}
@keyframes apReveal{from{transform:translateY(105%)}to{transform:none}}
.ap-feats{margin:0;padding:0;list-style:none;display:grid;gap:clamp(6px,1.4vh,14px)}
.ap-feats li{display:flex;align-items:center;gap:12px;color:color-mix(in srgb,var(--text) 88%,transparent);font-size:14px;font-weight:500;animation:apFade .5s both}
.ap-feats li:hover i{transform:scale(1.15)}
.ap-feats i{flex:0 0 auto;width:22px;height:22px;border-radius:6px;background:color-mix(in srgb,var(--brand) 20%,transparent);color:var(--accent-text);display:grid;place-items:center;animation:apTick 7s ease-in-out infinite}
@keyframes apTick{0%,12%,100%{transform:scale(1);background:color-mix(in srgb,var(--brand) 20%,transparent)}5%{transform:scale(1.22);background:color-mix(in srgb,var(--brand) 48%,transparent)}}
.ap-feats i svg{width:13px;height:13px}
.ap-foot{display:flex;flex-wrap:wrap;gap:8px}
.ap-badge{animation:apFade .6s both;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:8px;background:var(--input);border:1px solid var(--line);color:color-mix(in srgb,var(--text) 85%,transparent);font-size:12px;font-weight:500}
.ap-badge svg{width:14px;height:14px;color:var(--accent-text)}
@keyframes apFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.ap-side{position:relative;z-index:1;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ap-top{display:flex;justify-content:flex-end;padding:20px 28px 0;flex:0 0 auto}
.ap-theme{border:1px solid var(--line);background:transparent;color:var(--muted);padding:8px 12px;border-radius:9px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500}
.ap-theme:hover{color:var(--text);border-color:var(--brand)}.ap-theme svg{width:15px;height:15px}
.ap-main{flex:1 1 auto;min-height:0;display:flex;overflow-x:hidden;overflow-y:auto;padding:12px 32px}
.ap-form{width:100%;max-width:390px;margin:auto}
.ap-form>*,.ap-form form>*{animation:apRise .6s cubic-bezier(.2,.75,.25,1) both}
.ap-form>:nth-child(1){animation-delay:.05s}.ap-form>:nth-child(2){animation-delay:.12s}.ap-form>:nth-child(3){animation-delay:.18s}.ap-form>:nth-child(4){animation-delay:.24s}.ap-form>:nth-child(5){animation-delay:.5s}.ap-form>:nth-child(6){animation-delay:.6s}
.ap-form form>:nth-child(1){animation-delay:.28s}.ap-form form>:nth-child(2){animation-delay:.36s}.ap-form form>:nth-child(3){animation-delay:.44s}.ap-form form>:nth-child(4){animation-delay:.5s}
@keyframes apRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.ap-mini{display:none}
.ap-form h2{font-size:26px;letter-spacing:-.5px;line-height:1.2;margin:0 0 6px;font-weight:700}
.ap-sub{font-size:13.5px;color:var(--muted);line-height:1.6;margin:0 0 22px}
.ap-field{margin-bottom:15px}
.ap-field label{font-size:12.5px;font-weight:600;color:var(--text);display:block;margin-bottom:7px}
.ap-in{position:relative;border:1px solid var(--line);border-radius:10px;background:var(--input);display:flex;align-items:center;transition:border-color .2s,box-shadow .2s}
.ap-in:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand) 18%,transparent)}
.ap-in>svg{width:17px;height:17px;margin-left:13px;flex-shrink:0;color:var(--muted);transition:color .2s,transform .25s}
.ap-in:focus-within>svg{color:var(--brand);transform:scale(1.12)}
.ap-in input:-webkit-autofill,.ap-in input:-webkit-autofill:hover,.ap-in input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 100px var(--input-solid) inset;-webkit-text-fill-color:var(--text);caret-color:var(--text);transition:background-color 9999s ease-in-out 0s}
.ap-in input{width:100%;height:46px;background:none;border:0;outline:none;color:var(--text);font-size:13.5px;padding:0 13px}
.ap-in input::placeholder{color:var(--muted);opacity:.85}
.ap-root .ap-in input:focus-visible{outline:none}
.ap-eye{width:42px;height:44px;background:none;border:0;color:var(--muted);display:grid;place-items:center}.ap-eye:hover{color:var(--text)}.ap-eye svg{width:18px;height:18px}
.ap-caps{display:flex;align-items:center;gap:6px;font-size:12px;color:#d99a3d;margin:-6px 0 12px}.ap-caps svg{width:14px;height:14px}
.ap-opts{display:flex;justify-content:space-between;align-items:center;gap:14px;font-size:12.5px;margin:16px 0 18px}
.ap-rem{display:flex;align-items:center;gap:8px;color:var(--muted);cursor:pointer}.ap-rem input{accent-color:var(--brand);width:15px;height:15px}
.ap-link{background:none;border:0;padding:0;color:var(--brand);font-weight:600;font-size:12.5px}.ap-link:hover{text-decoration:underline}
.ap-submit{height:48px;width:100%;border:0;color:var(--on-brand);font-weight:600;font-size:14px;border-radius:10px;background:var(--brand);display:flex;gap:10px;align-items:center;justify-content:center;transition:background .2s,transform .15s}
.ap-submit:hover:not(:disabled){background:var(--brand-d);transform:translateY(-1px)}
.ap-submit{position:relative;overflow:hidden}
.ap-submit svg{width:17px;height:17px;transition:transform .25s}.ap-submit:hover:not(:disabled) svg{transform:translateX(4px)}
.ap-submit.ok{background:#4d8a3a;color:#fff}
.ap-submit.ok svg path{stroke-dasharray:30;animation:apDraw .45s ease both}
@keyframes apDraw{from{stroke-dashoffset:30}to{stroke-dashoffset:0}}
.ap-prog{position:absolute;left:0;bottom:0;height:3px;width:40%;background:color-mix(in srgb,var(--on-brand) 55%,transparent);animation:apProg 1.1s ease-in-out infinite}
@keyframes apProg{from{transform:translateX(-100%)}to{transform:translateX(260%)}}.ap-submit:disabled{opacity:.8;cursor:wait}
.ap-spin{width:17px;height:17px;border:2px solid color-mix(in srgb,var(--on-brand) 30%,transparent);border-top-color:var(--on-brand);border-radius:50%;animation:apSpin .7s linear infinite}
@keyframes apSpin{to{transform:rotate(360deg)}}
.ap-err{display:flex;align-items:flex-start;gap:9px;padding:10px 13px;margin:0 0 16px;background:var(--err-bg);border:1px solid var(--err-line);color:var(--err);border-radius:10px;font-size:12.5px;line-height:1.5}
.ap-err svg{width:16px;height:16px;flex-shrink:0;margin-top:1px}
@keyframes apShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
.ap-shaking{animation:apShake .45s ease}
.ap-secure{display:flex;align-items:center;justify-content:center;gap:7px;color:var(--muted);font-size:12px;margin-top:18px}.ap-secure svg{width:15px;height:15px}
.ap-legal{flex:0 0 auto;padding:10px 24px 18px;text-align:center;font-size:11.5px;color:var(--muted)}
.ap-legal a{color:var(--muted)}.ap-legal a:hover{color:var(--brand)}
.ap-logo-l{display:none}.ap-root[data-theme=light] .ap-logo-l{display:block}.ap-root[data-theme=light] .ap-logo-d{display:none}

@media(max-width:1000px){.ap-root{grid-template-columns:.9fr 1.1fr}.ap-story h1{font-size:24px;white-space:normal;text-wrap:balance}}
@media(max-width:790px){.ap-root{grid-template-columns:1fr}.ap-show{display:none}.ap-mini{display:flex;align-items:center;margin-bottom:26px;min-height:38px}.ap-mini img{height:36px;width:auto;max-width:220px;object-fit:contain}.ap-top{padding:14px 18px 0}.ap-main{padding:8px 22px}}
@media(max-height:760px){.ap-feats li{font-size:13px}.ap-feats i{width:20px;height:20px}.ap-badge{padding:6px 10px}}
@media(max-height:640px){.ap-foot{display:none}.ap-sub{margin-bottom:14px}.ap-field{margin-bottom:11px}.ap-opts{margin:12px 0 14px}.ap-mini{margin-bottom:14px}.ap-secure{margin-top:12px}.ap-legal{padding-bottom:10px}}
@media(prefers-reduced-motion:reduce){.ap-root *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;

const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;

export default function HRLogin() {
    const company = useCompany();
    const navigate = useNavigate();
    const [email, setEmail] = useState(() => { try { return localStorage.getItem(USER_KEY) || ''; } catch { return ''; } });
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(() => { try { return !!localStorage.getItem(USER_KEY); } catch { return false; } });
    const [showPw, setShowPw] = useState(false);
    const [caps, setCaps] = useState(false);
    const [error, setError] = useState('');
    const [shaking, setShaking] = useState(false);
    const shake = () => { setShaking(false); requestAnimationFrame(() => { setShaking(true); setTimeout(() => setShaking(false), 500); }); };
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [theme, setTheme] = useState(() => { try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });

    const toggleTheme = () => setTheme(t => { const n = t === 'light' ? 'dark' : 'light'; try { localStorage.setItem(THEME_KEY, n); } catch { /* ignore */ } return n; });

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
                // only the username is remembered, never the password
                try { if (remember) localStorage.setItem(USER_KEY, email.trim()); else localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
                sessionStorage.setItem('token', data.access_token);
                sessionStorage.setItem('role', data.role || 'USER');
                sessionStorage.setItem('permissions', JSON.stringify(data.permissions || {}));
                if (data.employee_status) sessionStorage.setItem('employee_status', data.employee_status);
                else sessionStorage.removeItem('employee_status');
                if (data.hr_remarks) sessionStorage.setItem('hr_remarks', data.hr_remarks);
                else sessionStorage.removeItem('hr_remarks');
                const mcp = data.must_change_password === true;
                sessionStorage.setItem('must_change_password', mcp ? 'true' : 'false');
                // a short "welcome" moment on the button, then the same destination as before
                setDone(true);
                setTimeout(() => { if (mcp) navigate('/force-change-password', { replace: true }); else navigate('/'); }, 650);
            } else {
                setError(data.detail || 'Invalid username or password');
                shake();
            }
        } catch (err) {
            setError('Failed to connect to the server.');
            shake();
        } finally {
            setLoading(false);
        }
    };

    const forgot = () => (window.Swal
        ? window.Swal.fire('Forgot Password', 'Please contact your HR administrator to reset your password.', 'info')
        : alert('Please contact your HR administrator to reset your password.'));

    const name = company.company_name || '';
    return (
        <div className="ap-root" data-theme={theme}>
            <style>{css}</style>
            <div className="ap-bg" aria-hidden="true"><i className="g1" /><i className="g2" /><i className="g3" /></div>
            <section className="ap-show" aria-label="HR portal introduction">
                <div className="ap-brand"><img className="ap-logo-d" src="/api/company-logo?dark=1" alt={name} /><img className="ap-logo-l" src="/api/company-logo" alt={name} /></div>
                <div className="ap-story">
                    <div className="ap-tag">HR Management Portal</div>
                    <h1><span className="ap-ln"><span style={{ animationDelay: '.15s' }}>One platform for People, Payroll <em>&amp; Performance.</em></span></span></h1>
                    <ul className="ap-feats">
                        {FEATURES.map((f, i) => (
                            <li key={f} style={{ animationDelay: `${0.5 + i * 0.09}s` }}><i style={{ animationDelay: `${1.5 + i * 0.7}s` }}><Check /></i>{f}</li>
                        ))}
                    </ul>
                </div>
                <div className="ap-foot">
                    <span className="ap-badge" style={{ animationDelay: '1.1s' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>Smart attendance</span>
                    <span className="ap-badge" style={{ animationDelay: '1.2s' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>RBAC enabled</span>
                    <span className="ap-badge" style={{ animationDelay: '1.3s' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>Smart alerts</span>
                </div>
            </section>

            <section className="ap-side">
                <div className="ap-top">
                    <button type="button" className="ap-theme" onClick={toggleTheme} aria-label="Switch theme">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                        <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
                    </button>
                </div>
                <div className="ap-main">
                    <div className={`ap-form${shaking ? ' ap-shaking' : ''}`}>
                        <div className="ap-mini"><img className="ap-logo-d" src="/api/company-logo?dark=1" alt={name} /><img className="ap-logo-l" src="/api/company-logo" alt={name} /></div>
                        <h2>Sign in</h2>
                        <p className="ap-sub">Enter your credentials to continue to the HR Management Portal.</p>

                        {error && (
                            <div className="ap-err" role="alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleLogin}>
                            <div className="ap-field">
                                <label htmlFor="EmailId">Username or Email</label>
                                <div className="ap-in">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                                    <input type="text" id="EmailId" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your username or email" autoComplete="username" required />
                                </div>
                            </div>
                            <div className="ap-field">
                                <label htmlFor="Password">Password</label>
                                <div className="ap-in">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                                    <input type={showPw ? 'text' : 'password'} id="Password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required
                                        onKeyUp={e => setCaps(!!(e.getModifierState && e.getModifierState('CapsLock')))} onBlur={() => setCaps(false)} />
                                    <button type="button" className="ap-eye" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}>
                                        {showPw
                                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 5c6 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" /></svg>
                                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>}
                                    </button>
                                </div>
                            </div>
                            {caps && <div className="ap-caps" role="status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>Caps Lock is on</div>}
                            <div className="ap-opts">
                                <label className="ap-rem"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />Remember my username</label>
                                <button type="button" className="ap-link" onClick={forgot}>Forgot Password?</button>
                            </div>
                            <button type="submit" className={`ap-submit${done ? ' ok' : ''}`} disabled={loading || done}>
                                {done
                                    ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>Welcome back</>
                                    : loading
                                        ? <><span className="ap-spin" />Signing in…<span className="ap-prog" /></>
                                        : <>Log In<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></>}
                            </button>
                        </form>
                        <div className="ap-secure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Protected workspace · Authorized users only</div>
                    </div>
                </div>
                <div className="ap-legal">
                    &copy; {new Date().getFullYear()} {name}
                    <span style={{ margin: '0 8px' }}>·</span>
                    <Link to="/privacy-policy">Privacy Policy</Link><span style={{ margin: '0 8px' }}>·</span><Link to="/terms-conditions">Terms &amp; Conditions</Link>
                </div>
            </section>
        </div>
    );
}
