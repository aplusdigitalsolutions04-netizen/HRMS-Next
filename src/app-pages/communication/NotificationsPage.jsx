import React, { useState, useEffect, useCallback } from 'react';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

const TYPE_COLORS = {
  INTERVIEW: '#4338ca',
  EMAIL: '#0284c7',
  CANDIDATE: '#10b981',
  EMPLOYEE: '#f59e0b',
  ATTENDANCE: '#8b5cf6',
  TEMPLATE: '#ec4899',
  SETTINGS: '#64748b',
  REMINDER: '#f97316',
};

const TYPE_ICONS = {
  INTERVIEW: '🤝',
  EMAIL: '📧',
  CANDIDATE: '👤',
  EMPLOYEE: '👥',
  ATTENDANCE: '📋',
  TEMPLATE: '📄',
  SETTINGS: '⚙️',
  REMINDER: '⏰',
};

export default function NotificationsPage() {
  const role = sessionStorage.getItem('role');
  const notifBase = role === 'USER' ? '/my-notifications' : '/notifications';
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(15);
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    let url = `${API}${notifBase}?page=${page}&per_page=${perPage}`;
    if (typeFilter !== 'all') url += `&category=${typeFilter}`;
    fetch(url, { headers: auth() })
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, perPage, typeFilter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = (id) => {
    fetch(`${API}${notifBase}/${id}/read`, { method: 'PUT', headers: auth() })
      .then(() => fetchNotifications());
  };

  const markAllRead = () => {
    fetch(`${API}${notifBase}/read-all`, { method: 'PUT', headers: auth() })
      .then(() => fetchNotifications());
  };

  const deleteNote = (id) => {
    fetch(`${API}${notifBase}/${id}`, { method: 'DELETE', headers: auth() })
      .then(() => fetchNotifications());
  };

  const deleteAll = () => {
    fetch(`${API}${notifBase}`, { method: 'DELETE', headers: auth() })
      .then(() => fetchNotifications());
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h2>Notifications</h2>
        <div className="notifications-toolbar">
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="all">All Types</option>
            <option value="INTERVIEW">Interview</option>
            <option value="EMAIL">Email</option>
            <option value="CANDIDATE">Candidate</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="TEMPLATE">Template</option>
            <option value="SETTINGS">Settings</option>
            <option value="REMINDER">Reminder</option>
          </select>
          {notifications.some(n => !n.is_read) && (
            <button className="btn-sm" onClick={markAllRead}>Mark All Read</button>
          )}
          {notifications.length > 0 && (
            <button className="btn-sm btn-sm-danger" onClick={deleteAll}>Delete All</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="notif-loading" />
      ) : notifications.length === 0 ? (
        <div className="notif-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <p>No notifications available</p>
        </div>
      ) : (
        <>
          <div className="notif-list">
            {notifications.map(n => (
              <div key={n.id} className={`notif-item ${!n.is_read ? 'notif-unread' : ''}`}>
                <div className="notif-icon" style={{ backgroundColor: TYPE_COLORS[n.category] + '18', color: TYPE_COLORS[n.category] }}>
                  {TYPE_ICONS[n.category] || '🔔'}
                </div>
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  {n.message && <div className="notif-message">{n.message}</div>}
                  <div className="notif-meta">
                    <span className="notif-type-badge" style={{ backgroundColor: TYPE_COLORS[n.category] + '18', color: TYPE_COLORS[n.category] }}>{n.category}</span>
                    <span className="notif-date">{new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <div className="notif-actions">
                  {!n.is_read && (
                    <button className="notif-btn" onClick={() => markRead(n.id)} title="Mark as read">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    </button>
                  )}
                  <button className="notif-btn notif-btn-delete" onClick={() => deleteNote(n.id)} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="notif-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
