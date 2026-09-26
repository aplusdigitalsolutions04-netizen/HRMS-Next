import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API, auth, SettingsCard, FormField, SaveButton } from './shared';

// Shrink the uploaded image so it fits the settings table, and keep it as PNG
// so a transparent signature background stays transparent on the payslip.
function shrinkImage(file, maxW = 360, maxH = 120) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Please choose a PNG, JPG or WEBP image'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL('image/png');
        if (out.length > 60000) reject(new Error('Signature image is too detailed. Use a simpler or smaller image.'));
        else resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function Signatory({ title, nameLabel, name, signature, onName, onSignature }) {
  const pick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { onSignature(await shrinkImage(file)); }
    catch (err) { Swal.fire({ icon: 'error', title: 'Error', text: err.message }); }
  };
  return (
    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>{title}</h4>
      <FormField label={nameLabel}>
        <input className="settings-input" placeholder="Full name" value={name} onChange={e => onName(e.target.value)} />
      </FormField>
      <FormField label="Signature (optional)">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
      </FormField>
      {name.trim() || signature ? (
        <div style={{ marginTop: 10, textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12 }}>
          {signature ? <img src={signature} alt="Signature" style={{ maxHeight: 46 }} /> : <div style={{ height: 46 }} />}
          <div style={{ fontWeight: 700, marginTop: 4 }}>{name.trim() ? `(${name.trim()})` : ''}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{title}</div>
          {signature && <button type="button" className="btn-premium" style={{ marginTop: 8, background: '#ef4444' }} onClick={() => onSignature('')}>Remove signature</button>}
        </div>
      ) : null}
    </div>
  );
}

export default function PayslipSettings({ saving, setSaving }) {
  const [form, setForm] = useState({ prepared_by: '', authorised_by: '', prepared_signature: '', authorised_signature: '', ew_pay_multiplier: '1', el_payout_interval_months: '1', salary_month_days_mode: 'actual' });
  const [loading, setLoading] = useState(true);
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch(`${API}/settings/payslip`, { headers: auth() }).then(r => r.json()).then(d => {
      setForm({
        prepared_by: d.prepared_by || '', authorised_by: d.authorised_by || '',
        prepared_signature: d.prepared_signature || '', authorised_signature: d.authorised_signature || '',
        ew_pay_multiplier: d.ew_pay_multiplier || '1',
        el_payout_interval_months: d.el_payout_interval_months || '1',
        salary_month_days_mode: d.salary_month_days_mode || 'actual',
      });
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/settings/payslip`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Save failed');
      Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <SettingsCard title="Payslip Settings" desc="Names and signatures printed at the bottom of every salary slip. Names appear in brackets, with the signature above.">
      <div className="settings-grid">
        <Signatory title="Prepared By" nameLabel="Prepared By (name)" name={form.prepared_by} signature={form.prepared_signature} onName={set('prepared_by')} onSignature={set('prepared_signature')} />
        <Signatory title="Authorised By" nameLabel="Authorised By (name)" name={form.authorised_by} signature={form.authorised_signature} onName={set('authorised_by')} onSignature={set('authorised_signature')} />
      </div>
      <div style={{ marginTop: 16, maxWidth: 360 }}>
        <FormField label="Extra Work pay rate (x one day's pay)">
          <input type="number" min="0" max="10" step="0.25" className="settings-input" value={form.ew_pay_multiplier} onChange={e => setForm(f => ({ ...f, ew_pay_multiplier: e.target.value }))} />
        </FormField>
        <div style={{ fontSize: 12, color: '#64748b' }}>Paid for each Extra Work (EW) day: monthly gross / days in month x this rate. Use 1 for a normal day, 2 for double pay.</div>
      </div>
      <div style={{ marginTop: 16, maxWidth: 360 }}>
        <FormField label="Month Days (for Paid Days and PerDay Salary)">
          <select className="settings-input" value={form.salary_month_days_mode} onChange={e => setForm(f => ({ ...f, salary_month_days_mode: e.target.value }))}>
            <option value="actual">Actual days in the month (28 / 29 / 30 / 31)</option>
            <option value="30">Fixed 30 days every month</option>
          </select>
        </FormField>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>PerDay Salary = monthly salary / Month Days. Paid Days = Month Days - Unpaid Days (absent days + half of each half day).</div>
        <FormField label="EL Encashment paid every (months)">
          <input type="number" min="1" max="12" step="1" className="settings-input" value={form.el_payout_interval_months} onChange={e => setForm(f => ({ ...f, el_payout_interval_months: e.target.value }))} />
        </FormField>
        <div style={{ fontSize: 12, color: '#64748b' }}>1 = paid in every month's payslip. 3 = paid together once every 3 months (in March, June, September and December) as the monthly EL amount x 3; the payslips in between show 0.</div>
      </div>
      <div className="settings-actions"><SaveButton onClick={save} saving={saving} /></div>
    </SettingsCard>
  );
}
