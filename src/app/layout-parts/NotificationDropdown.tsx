// @ts-nocheck
'use client';

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const fetchData = () => {
    const token = sessionStorage.getItem('token');
    if (!token) return;
    fetch(`${API}/notifications?page=1&per_page=6`, { headers: auth() })
      .then(r => r.json()).then(d => setNotifications(d.notifications || [])).catch(() => {});
    fetch(`${API}/notifications/unread-count`, { headers: auth() })
      .then(r => r.json()).then(d => setUnreadCount(d.unread_count || 0)).catch(() => {});
  };

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 15000); return () => clearInterval(iv); }, []);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const markRead = (id) => { fetch(`${API}/notifications/${id}/read`, { method: 'PUT', headers: auth() }).then(() => fetchData()); };
  const markAllRead = () => { fetch(`${API}/notifications/read-all`, { method: 'PUT', headers: auth() }).then(() => fetchData()); };

  return (
    <div className="global-notif-wrap" ref={ref}>
      <button className="global-notif-icon" onClick={() => setOpen(!open)} title="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="global-notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications {unreadCount > 0 && `(${unreadCount})`}</span>
            {unreadCount > 0 && <button className="notif-mark-all-btn" onClick={markAllRead}>Mark All Read</button>}
          </div>
          <div className="notif-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notif-dropdown-empty">No notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`notif-dropdown-item ${!n.is_read ? 'notif-dd-unread' : ''}`}>
                  <div className="notif-dd-dot" />
                  <div className="notif-dd-body" onClick={() => { if (!n.is_read) markRead(n.id); }}>
                    <div className="notif-dd-title">{n.title}</div>
                    <div className="notif-dd-time">{new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="notif-dropdown-footer">
            <button onClick={() => { setOpen(false); navigate('/settings/view-notifications'); }}>View All Notifications</button>
          </div>
        </div>
      )}
    </div>
  );
}
