import React, { useState } from 'react';
import MailFrom from '../mail/MailFrom';

const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' };
const lab = { display: 'block', fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 };
const btnO = { padding: '11px 22px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnP = (off) => ({ padding: '11px 28px', borderRadius: 10, border: 'none', background: off ? '#93c5fd' : '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600, cursor: off ? 'not-allowed' : 'pointer' });

const today = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const niceDate = (d) => { try { return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

// The mail that goes to the reporting manager, written from the details the employee just filled in.
const buildLetter = (f, dur, profile) => [
  'Dear Sir/Madam,',
  '',
  'I hope this message finds you well.',
  '',
  `I am writing to request ${f.leave_type} from ${niceDate(f.start_date)} to ${niceDate(f.end_date)} (total ${dur} day${dur > 1 ? 's' : ''}).`,
  `Reason: ${f.reason.trim()}`,
  '',
  'I will hand over my pending work before I leave and will stay reachable on phone/email for anything urgent.',
  'Kindly approve my leave request at your earliest convenience.',
  '',
  'Thanking you,',
  profile?.full_name || '',
  [profile?.designation, profile?.emp_code].filter(Boolean).join(' | '),
  `Date: ${today()}`,
].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

// Full page to apply for leave (or to change a request that is still waiting), in two steps:
//   1. fill the leave details   2. see the mail to the reporting manager, change it if needed, then send.
export default function LeaveApplyPage({ form, setForm, editing, onBack, onSubmit, submitting, formErr, dur, profile, balance, leaveTypes = [] }) {
  const [canMail, setCanMail] = useState(true);
  const [fromAcc, setFromAcc] = useState('');
  const [step, setStep] = useState(1);
  const [localErr, setLocalErr] = useState('');
  const [subject, setSubject] = useState('Leave Application');
  const [body, setBody] = useState('');
  const [editMail, setEditMail] = useState(false);

  const goNext = (e) => {
    e.preventDefault();
    setLocalErr('');
    if (!form.leave_type) return setLocalErr('Please pick a leave type');
    if (!form.start_date || !form.end_date) return setLocalErr('Please select the start and end dates');
    if (dur <= 0) return setLocalErr('End date must not be before the start date');
    if (!form.reason.trim()) return setLocalErr('Please enter a reason');
    if (!editing && balance && dur > (balance.remaining || 0)) return setLocalErr(`Insufficient ${form.leave_type} balance. Available: ${(balance.remaining || 0).toFixed(0)} days`);
    setBody(buildLetter(form, dur, profile));
    setEditMail(false);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const send = () => onSubmit({ mail_subject: subject.trim(), mail_message: body.trim(), from_account_id: fromAcc });

  const stepper = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      {[['1', 'Leave details'], ['2', 'Email to your manager']].map(([n, l], i) => {
        const on = step === Number(n), done = step > Number(n);
        return (
          <React.Fragment key={n}>
            {i > 0 && <div style={{ width: 36, height: 2, background: step > 1 ? '#2563eb' : '#e2e8f0' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: on || done ? '#2563eb' : '#e2e8f0', color: on || done ? '#fff' : '#64748b' }}>{done ? '✓' : n}</span>
              <span style={{ fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? '#0f172a' : '#64748b' }}>{l}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>{editing ? 'Edit Leave Request' : 'Apply for Leave'}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {editing ? 'Your changes are sent to the person who is reviewing this request.' : 'The request goes to your reporting manager first, then to HR.'}
          </p>
        </div>
        <button type="button" onClick={onBack} style={{ ...btnO, padding: '9px 16px', fontSize: 13 }}>&larr; Back to Leave</button>
      </div>
      {stepper}

      {step === 1 && (
        <form onSubmit={goNext} className="el-card" style={{ padding: 24, width: '100%', boxSizing: 'border-box' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#0f172a' }}>Leave details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lab}>Leave Type</label>
              <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))} style={inp}>
                {[...new Set([...leaveTypes, form.leave_type].filter(Boolean))].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {balance && <div style={{ marginTop: 5, fontSize: 12, color: '#64748b' }}>Balance: <b>{Number(balance.remaining || 0).toFixed(1).replace('.0', '')}</b> day(s)</div>}
            </div>
            <div><label style={lab}>Start Date</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} /></div>
            <div><label style={lab}>End Date</label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} /></div>
          </div>
          {dur > 0 && <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600 }}>Duration: {dur} day{dur > 1 ? 's' : ''}</div>}
          <div style={{ marginBottom: 14 }}>
            <label style={lab}>Reason <span style={{ color: '#dc2626' }}>*</span></label>
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={5} style={{ ...inp, resize: 'vertical' }} placeholder="Enter the reason for your leave..." />
          </div>
          {!editing && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={lab}>Supporting Document (Optional)</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setForm(f => ({ ...f, file: e.target.files[0] || null }))} style={{ ...inp, padding: 8 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div><label style={lab}>Email CC</label><input type="text" value={form.cc} onChange={e => setForm(f => ({ ...f, cc: e.target.value }))} placeholder="one@example.com, two@example.com" style={inp} /></div>
                <div><label style={lab}>Email BCC</label><input type="text" value={form.bcc} onChange={e => setForm(f => ({ ...f, bcc: e.target.value }))} placeholder="one@example.com, two@example.com" style={inp} /></div>
              </div>
              <div style={{ margin: '-6px 0 14px', fontSize: 12, color: '#94a3b8' }}>You can add several addresses in CC and BCC. Separate them with a comma.</div>
            </>
          )}
          {localErr && <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{localErr}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onBack} style={btnO}>Cancel</button>
            <button type="submit" style={btnP(false)}>Next: review the email &rarr;</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="el-card" style={{ padding: 24, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>{editMail ? 'Edit the email' : 'Preview of the email'}</h3>
            <button type="button" onClick={() => setEditMail(v => !v)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #bfdbfe', background: editMail ? '#2563eb' : '#eff6ff', color: editMail ? '#fff' : '#1d4ed8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {editMail ? 'Done editing' : 'Edit email'}
            </button>
          </div>

          <MailFrom onInfo={setCanMail} onPick={setFromAcc} />
          {editMail ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={lab}>Subject</label>
                <input type="text" value={subject} maxLength={150} onChange={e => setSubject(e.target.value)} style={inp} />
              </div>
              <div style={{ marginBottom: 6 }}>
                <label style={lab}>Message</label>
                <textarea value={body} rows={15} onChange={e => setBody(e.target.value)} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <button type="button" onClick={() => { setSubject('Leave Application'); setBody(buildLetter(form, dur, profile)); }} style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 6 }}>Reset to standard</button>
            </>
          ) : (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
                <div><span style={{ display: 'inline-block', width: 64, color: '#94a3b8' }}>To</span>Your reporting manager{form.cc ? <span style={{ color: '#94a3b8' }}> (CC: {form.cc})</span> : null}</div>
                <div><span style={{ display: 'inline-block', width: 64, color: '#94a3b8' }}>Subject</span><b style={{ color: '#0f172a' }}>{subject}</b></div>
              </div>
              <div style={{ padding: '16px 18px', fontSize: 14, color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#fff' }}>{body}</div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', fontSize: 12.5, color: '#64748b' }}>
                {form.leave_type} &middot; {niceDate(form.start_date)} to {niceDate(form.end_date)} &middot; {dur} day{dur > 1 ? 's' : ''}{form.file ? ` · Attachment: ${form.file.name}` : ''}
              </div>
            </div>
          )}

          {formErr && <div style={{ margin: '12px 0 0', padding: '9px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={() => setStep(1)} style={btnO}>&larr; Back to details</button>
            <button type="button" onClick={send} disabled={submitting} style={btnP(submitting)}>
              {submitting ? 'Sending...' : editing ? 'Save & send' : canMail ? 'Send to manager' : 'Submit request (no email)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
