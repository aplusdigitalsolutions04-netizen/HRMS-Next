export const API = '/api';
export const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export function SettingsCard({ title, desc, children }) {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <h3>{title}</h3>
        {desc && <p>{desc}</p>}
      </div>
      <div className="settings-card-body">{children}</div>
    </div>
  );
}

export function FormField({ label, children, fullWidth }) {
  return (
    <div className={`form-field ${fullWidth ? 'full-width' : ''}`}>
      <label className="premium-label">{label}</label>
      {children}
    </div>
  );
}

export function SaveButton({ onClick, saving }) {
  return (
    <button className="btn-premium" onClick={onClick} disabled={saving}>
      {saving ? <><span className="spinner-sm" /> Saving...</> : '💾 Save Settings'}
    </button>
  );
}
