export const API = '/api';
export const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

export function SettingsCard({ title, desc, actions, children }) {
  return (
    <div className="settings-card">
      <div className="settings-card-header" style={actions ? { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' } : undefined}>
        <div>
          <h3>{title}</h3>
          {desc && <p>{desc}</p>}
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{actions}</div>}
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
