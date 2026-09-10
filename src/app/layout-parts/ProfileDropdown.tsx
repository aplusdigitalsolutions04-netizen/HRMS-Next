// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function ProfileDropdown() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchProfile = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API}/profile`, { headers: auth() })
      .then(r => r.json()).then(d => setProfile(d)).catch(() => {});
  };

  useEffect(() => {
    fetchProfile();
    // ProfilePage dispatches this after a successful save so the header
    // avatar/name update immediately instead of only on the next full load.
    window.addEventListener('profile-updated', fetchProfile);
    return () => window.removeEventListener('profile-updated', fetchProfile);
  }, []);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleLogout = () => {
    try {
      if (window.Swal) {
        window.Swal.fire({
          title: 'Are you sure you want to logout?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Logout',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#ef4444',
          cancelButtonColor: '#64748b',
        }).then(result => {
          if (result.isConfirmed) doLogout();
        });
      } else {
        doLogout();
      }
    } catch { doLogout(); }
  };

  const doLogout = () => {
    fetch(`${API}/logout`, { method: 'POST' }).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('permissions');
    navigate('/login');
  };

  return (
    <div className="global-profile-wrap" ref={ref}>
      <button className="global-notif-icon" onClick={() => setOpen(!open)} title="Profile" style={{ overflow: 'hidden' }}>
        {profile?.profile_photo ? (
          <img src={profile.profile_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        )}
      </button>
      {open && (
        <div className="global-profile-dropdown">
          <div className="dropdown-user">
            <div className="dropdown-user-avatar">
              {profile?.profile_photo
                ? <img src={profile.profile_photo} alt="" />
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
            </div>
            <div>
              <div className="dropdown-user-name">{profile?.full_name || profile?.email?.split('@')[0]}</div>
              <div className="dropdown-user-role">{profile?.role || 'User'}</div>
            </div>
          </div>
          {profile?.last_login && (
            <div className="dropdown-last-login">Last Login: {new Date(profile.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          )}
          <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/profile'); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            My Profile
          </button>
          <button className="dropdown-item" onClick={() => { setOpen(false); navigate('/change-password'); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Change Password
          </button>
          <div className="dropdown-divider" />
          <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
