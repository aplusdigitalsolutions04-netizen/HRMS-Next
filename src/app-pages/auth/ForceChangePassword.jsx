import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import aplusLogo from '../../assets/aplus.png';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const role = sessionStorage.getItem('role');
    if (!token) { navigate('/login', { replace: true }); return; }
    if (role !== 'USER') { navigate('/', { replace: true }); return; }
    const mcp = sessionStorage.getItem('must_change_password');
    if (mcp !== 'true') { navigate('/', { replace: true }); return; }
  }, [navigate]);

  const getStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getStrength(newPassword);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strength] || 'Weak';
  const strengthColor = ['', '#ef4444', '#f59e0b', '#eab308', '#10b981', '#059669'][strength] || '#ef4444';
  const strengthPct = (strength / 5) * 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (strength < 3) { setError('Password is too weak. Use uppercase, lowercase, numbers, and special characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/employee/change-password`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword })
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem('must_change_password', 'false');
        setSuccess(true);
        setTimeout(() => navigate('/', { replace: true }), 2000);
      } else {
        setError(data.detail || 'Failed to change password');
      }
    } catch {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f8f7ff', padding:24 }}>
        <div style={{ textAlign:'center', maxWidth:400 }}>
          <div style={{ width:64,height:64,borderRadius:'50%',background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontFamily:'Outfit,sans-serif',fontWeight:700,color:'#0f172a',margin:'0 0 6px' }}>Password Changed!</h2>
          <p style={{ color:'#64748b',fontSize:14 }}>Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f8f7ff' }}>
      <style>{`
        @keyframes fcpFade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .fcp-card { animation:fcpFade .4s ease both; }
        .fcp-input { width:100%; padding:10px 14px; border:1.5px solid #e2e8f0; border-radius:10px; font-size:.85rem; outline:none; background:#fff; color:#1f2937; transition:all .2s; box-sizing:border-box; }
        .fcp-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
      `}</style>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div className="fcp-card" style={{ width:'100%', maxWidth:440, background:'#fff', borderRadius:20, padding:'40px 36px', boxShadow:'0 8px 32px rgba(99,102,241,0.1)', border:'1px solid #f1f0ff' }}>
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <img src={aplusLogo} alt="A Plus" style={{ height:36, marginBottom:12 }} />
            <h2 style={{ fontFamily:'Outfit,sans-serif', fontWeight:800, fontSize:'1.25rem', color:'#0f172a', margin:0, letterSpacing:'-0.3px' }}>Create New Password</h2>
            <p style={{ margin:'6px 0 0', fontSize:13, color:'#64748b' }}>This is your first login. Please set a new password.</p>
          </div>

          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, color:'#dc2626', fontSize:13, fontWeight:500, marginBottom:18 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5 }}>New Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPwd ? 'text' : 'password'} className="fcp-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" required style={{ paddingRight:40 }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4, display:'flex' }}>
                  {showPwd ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {newPassword && (
                <div style={{ marginTop:8 }}>
                  <div style={{ height:4, background:'#e2e8f0', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${strengthPct}%`, background:strengthColor, borderRadius:4, transition:'all .3s' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                    <span style={{ fontSize:11, color:strengthColor, fontWeight:600 }}>{strengthLabel}</span>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>{strength}/5</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5 }}>Confirm Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPwd ? 'text' : 'password'} className="fcp-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" required style={{ paddingRight:40 }} />
                {confirmPassword && (
                  <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)' }}>
                    {newPassword === confirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    )}
                  </span>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width:'100%', padding:12, background:loading?'#94a3b8':'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:loading?'default':'pointer', transition:'all .25s'
            }}>
              {loading ? 'Changing Password...' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}