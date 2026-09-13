import React, { useState, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';

const NotificationsPage = lazy(() => import('../communication/NotificationsPage'));
const CompanySettings = lazy(() => import('./CompanySettings'));
const SMTPSettings = lazy(() => import('./SMTPSettings'));
const UserManagement = lazy(() => import('./UserManagement'));
const InterviewSettings = lazy(() => import('./InterviewSettings'));
const AttendanceSettings = lazy(() => import('./AttendanceSettings'));
const NotificationSettings = lazy(() => import('./NotificationSettings'));
const CommunicationSettings = lazy(() => import('./CommunicationSettings'));
const TemplateManagement = lazy(() => import('./TemplateManagement'));
const RoleManagement = lazy(() => import('./RoleManagement'));
const GoogleDriveSettings = lazy(() => import('./GoogleDriveSettings'));

export default function SettingsWorkspace() {
  const { section } = useParams();
  const [saving, setSaving] = useState(false);
  const activeSection = section || 'company';

  return (
    <div className="animate-in" style={{ maxWidth: '100%' }}>
      <div className="settings-workspace-section">
        <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
          {renderSection(activeSection, saving, setSaving)}
        </Suspense>
      </div>
    </div>
  );
}

function renderSection(key, saving, setSaving) {
  switch (key) {
    case 'view-notifications':
      return <NotificationsPage />;
    case 'company':
      return <CompanySettings saving={saving} setSaving={setSaving} />;
    case 'smtp':
      return <SMTPSettings saving={saving} setSaving={setSaving} />;
    case 'users':
      return <UserManagement />;
    case 'roles':
      return <RoleManagement />;
    case 'interviews':
      return <InterviewSettings saving={saving} setSaving={setSaving} />;
    case 'attendance':
      return <AttendanceSettings saving={saving} setSaving={setSaving} />;
    case 'notifications':
      return <NotificationSettings saving={saving} setSaving={setSaving} />;
    case 'communication':
      return <CommunicationSettings saving={saving} setSaving={setSaving} />;
    case 'templates':
      return <TemplateManagement />;
    case 'google-drive':
      return <GoogleDriveSettings />;
    default:
      return <PlaceholderSection />;
  }
}

function PlaceholderSection() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0',
      padding: '48px 32px', textAlign: 'center', color: '#94a3b8'
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🚧</div>
      <h4 style={{ fontFamily: "'Outfit', sans-serif", color: '#64748b', marginBottom: 6 }}>Coming Soon</h4>
      <p style={{ fontSize: '.9rem' }}>This section is under development and will be available in a future update.</p>
    </div>
  );
}
