import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized = () => (
  <>
    <style>{`
      .ua-page { display:flex; align-items:center; justify-content:center; min-height:100vh; background:linear-gradient(135deg,#f5f4ff 0%,#efeafe 50%,#f8f7ff 100%); }
      .ua-card { text-align:center; background:#fff; border-radius:20px; padding:48px 56px; max-width:480px; width:100%; box-shadow:0 8px 32px rgba(99,102,241,0.1); border:1px solid #f1f0ff; animation:uaFade .4s ease; }
      @keyframes uaFade { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      .ua-icon { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,#fef2f2,#fde8e8); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; color:#ef4444; }
      .ua-card h1 { font-family:'Outfit',sans-serif; font-weight:800; font-size:1.5rem; color:#0f172a; margin:0 0 8px; letter-spacing:-0.3px; }
      .ua-card p { color:#6b7280; font-size:.9rem; margin:0 0 24px; line-height:1.5; }
      .ua-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 24px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:10px; font-weight:600; font-size:.85rem; text-decoration:none; transition:all .2s; }
      .ua-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(99,102,241,0.35); color:#fff; }
    `}</style>
    <div className="ua-page">
      <div className="ua-card">
        <div className="ua-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1>Access Restricted</h1>
        <p>You do not have permission to access this page.<br />Please contact your administrator if you believe this is an error.</p>
        <Link to="/" className="ua-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  </>
);

export default Unauthorized;
