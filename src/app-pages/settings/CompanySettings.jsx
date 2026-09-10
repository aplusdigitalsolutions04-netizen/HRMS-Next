import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField, SaveButton } from './shared';

export default function CompanySettings({ saving, setSaving }) {
  const [form, setForm] = useState({ company_name: '', company_website: '', company_email: '', company_phone: '', company_address: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/settings/company`, { headers: auth() }).then(r => r.json()).then(d => { if (d && d.company_name !== undefined) setForm(d); }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/company`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      Swal.fire({ icon: 'success', title: 'Saved!', text: 'Company settings updated.', timer: 1500, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: e.message });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <SettingsCard title="Company Settings" desc="Manage your organization details">
      <div className="settings-grid">
        <FormField label="Company Name">
          <input className="settings-input" value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
        </FormField>
        <FormField label="Company Logo">
          <input type="file" className="settings-input" accept="image/*" onChange={e => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => setForm(f => ({ ...f, company_logo: reader.result }));
              reader.readAsDataURL(file);
            }
          }} />
          {form.company_logo && <div style={{marginTop: '10px'}}><img src={form.company_logo} alt="Logo preview" style={{maxHeight: '40px', borderRadius: '4px'}} /></div>}
        </FormField>
        <FormField label="Company Website">
          <input className="settings-input" value={form.company_website || ''} onChange={e => setForm(f => ({ ...f, company_website: e.target.value }))} />
        </FormField>
        <FormField label="Company Email">
          <input className="settings-input" value={form.company_email || ''} onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))} />
        </FormField>
        <FormField label="Company Phone">
          <input className="settings-input" value={form.company_phone || ''} onChange={e => setForm(f => ({ ...f, company_phone: e.target.value }))} />
        </FormField>
        <FormField label="Company Address" fullWidth>
          <textarea className="settings-input" rows={3} value={form.company_address || ''} onChange={e => setForm(f => ({ ...f, company_address: e.target.value }))} />
        </FormField>
      </div>
      <div className="settings-actions"><SaveButton onClick={save} saving={saving} /></div>
    </SettingsCard>
  );
}
