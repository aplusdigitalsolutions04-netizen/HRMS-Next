import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import Pagination from '../shared/Pagination';
import { appLocale, currencySymbol } from '@/lib/app-config-client';
import LetterEditor from './LetterEditor';
import { componentsTotal, compensationMarkup, cleanComponents, inr } from '@/lib/compensation';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const when = (v) => { try { return new Date(v).toLocaleDateString(appLocale(), { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return v; } };

// the PDF opens in a new tab (the page is asked with the login, so it is read as a file first)
export async function openLetter(id) {
  const tab = window.open('', '_blank');
  try {
    const res = await fetch(`${API}/letters/${id}`, { headers: auth() });
    if (!res.ok) { let m = 'Could not open the letter'; try { m = (await res.json()).detail || m; } catch { /* not json */ } throw new Error(m); }
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { if (tab) tab.close(); Swal.fire({ icon: 'error', title: 'Not opened', text: e.message }); }
}

// The PDF of a letter text as it will be printed (letterhead, page breaks, tables), opened in a new tab; nothing is saved.
async function previewLetterPdf(text, extra = {}) {
  const tab = window.open('', '_blank');
  try {
    const res = await fetch(`${API}/letters/preview-pdf`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, ...extra }) });
    if (!res.ok) { let m = 'Could not make the preview'; try { m = (await res.json()).detail || m; } catch { /* not json */ } throw new Error(m); }
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url; else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { if (tab) tab.close(); Swal.fire({ icon: 'error', title: 'No preview', text: e.message }); }
}

const input = { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', outline: 'none', background: '#fff', fontFamily: 'inherit', width: '100%' };
const label = { fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 };

// HR: make letters from the templates, see the letters made, and change the text of each letter.
// Each part of the letters is its own page (Letters in the side menu): /letters/make, /made, /texts, /words and /letterhead.
const SECTIONS = {
  make: ['Make a letter', 'Pick an employee and a letter, fill in the details, read the text and make the PDF.'],
  made: ['Letters made', 'Every letter that was made. Open the PDF, email it, edit it or delete it.'],
  texts: ['Letter texts', 'The text of each kind of letter. Change it, or add a new kind of letter.'],
  words: ['Letter words', 'The words that are filled in for each employee when a letter is made. Add your own.'],
  letterhead: ['Letterhead', 'How the top of every letter and of the Full and Final statement looks: the company header, your own letterhead picture, or none.'],
};
export default function Letters({ section = 'make' }) {
  const navigate = useNavigate();
  const [title, about] = SECTIONS[section] || SECTIONS.make;
  return (
    <div>
      <div className="ph">
        <div>
          <h1>{title}</h1>
          <p>{about}</p>
        </div>
      </div>
      {section === 'make' && <Issue onDone={() => navigate('/letters/made')} />}
      {section === 'made' && <Issued isHr />}
      {section === 'words' && <Words />}
      {section === 'letterhead' && <Letterhead />}
    </div>
  );
}

function Issue({ onDone }) {
  const [types, setTypes] = useState([]);
  const [people, setPeople] = useState([]);
  const [q, setQ] = useState('');
  const [emp, setEmp] = useState(null);
  const [type, setType] = useState('');
  const [fields, setFields] = useState({ joining_date: '', resignation_date: '', last_working_day: '', effective_date: '' });
  const [text, setText] = useState('');
  const [askVars, setAskVars] = useState([]);
  const [custom, setCustom] = useState({});
  const [missing, setMissing] = useState([]);
  const [busy, setBusy] = useState(false);
  const [mailFor, setMailFor] = useState(null);
  const [refNo, setRefNo] = useState('');
  const [letterDate, setLetterDate] = useState('');
  const [step, setStep] = useState(1); // 1: the details, 2: the letter text and making it
  // the salary table of this letter: every employee has a different salary, so the components and their monthly amounts are given here.
  // They start from the employee's salary structure; with none, the usual names are there to fill in.
  const STARTER = ['Basic', 'HRA', 'Travel Allowance', 'Food Voucher'];
  const [comps, setComps] = useState(STARTER.map(name => ({ name, amount: '', percent: '' })));
  const [salaryOn, setSalaryOn] = useState(false); // add a salary table to this letter?
  const [currency, setCurrency] = useState('Rs.');
  const [grand, setGrand] = useState(''); // the monthly salary (total): a component may be given as a percent of it
  // the amount of a component: the amount typed, else its percent of the monthly salary
  const amountOf = (c) => (Number(c.amount) > 0 ? Number(c.amount) : Number(c.percent) > 0 && Number(grand) > 0 ? Math.round((Number(grand) * Number(c.percent)) / 100) : 0);
  const resolved = comps.map(c => ({ name: c.name, amount: amountOf(c) }));

  useEffect(() => { fetch(`${API}/letters`, { headers: auth() }).then(r => r.json()).then(d => { setTypes(d.types || []); setAskVars(d.ask_vars || []); setType(t => (d.types || []).some(x => x.key === t) ? t : ((d.types || [])[0] || {}).key || ''); }).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) { setPeople([]); return; }
      fetch(`${API}/directory?search=${encodeURIComponent(q.trim())}&per_page=8`, { headers: auth() }).then(r => r.json()).then(d => setPeople(d.people || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // the monthly salary starts from the employee's salary structure (empty when there is none); an offer made before that can type it
  useEffect(() => {
    if (!emp) { setComps(STARTER.map(name => ({ name, amount: '', percent: '' }))); setGrand(''); return; }
    fetch(`${API}/letters/defaults?employee_id=${emp.id}`, { headers: auth() }).then(r => r.json())
      .then(d => { if (d.currency_label) setCurrency(d.currency_label); setGrand(''); setComps((d.components || []).length ? d.components.map(c => ({ name: c.name, amount: String(c.amount), percent: '' })) : STARTER.map(name => ({ name, amount: '', percent: '' }))); }).catch(() => {});
  }, [emp]);

  const clean = () => Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
  const typed = () => ({ components: salaryOn ? resolved : [], no_salary: !salaryOn, letter_date: letterDate });
  const preview = async () => {
    if (!emp) { Swal.fire({ icon: 'warning', title: 'Pick an employee first' }); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/preview`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, letter_type: type, fields: { ...clean(), ...typed(), custom } }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not prepare the letter');
      setText(d.text); setMissing(d.missing || []); setStep(2);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(false); }
  };
  const make = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, letter_type: type, fields: { ...clean(), custom }, text, ref_no: refNo.trim(), letter_date: letterDate }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not make the letter');
      const next = await Swal.fire({ icon: 'success', title: d.ref_no || 'Letter made', text: d.message + ' The employee can see it in their portal.', showDenyButton: true, showCancelButton: true, confirmButtonText: 'Email it to the employee', denyButtonText: 'Open the PDF', cancelButtonText: 'Done' });
      setText(''); setRefNo(''); setLetterDate(''); setStep(1);
      if (next.isConfirmed) { setMailFor(d.id); return; }
      if (next.isDenied) openLetter(d.id);
      onDone();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    finally { setBusy(false); }
  };

  const usesSalary = !!(types.find(t => t.key === type) || {}).uses_salary;
  // a letter that already has a salary table in its text starts with the option on
  useEffect(() => { setSalaryOn(usesSalary); }, [type, usesSalary]);
  const date = (k, l) => <div className="lw-f"><label>{l}</label><input type="date" value={fields[k]} onChange={e => setFields(f => ({ ...f, [k]: e.target.value }))} /></div>;
  const typeLabel = (types.find(t => t.key === type) || {}).label || '';
  const total = componentsTotal(resolved);
  const off = Number(grand) > 0 && Math.abs(total - Number(grand)) > 0.5;
  const initials = emp ? emp.full_name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() : '';
  return (
    <div className="lw">
      <style>{LW_CSS}</style>
      <ol className="lw-steps" aria-label="Steps">
        <li className={step === 1 ? 'on' : 'done'}><button type="button" onClick={() => setStep(1)}><i>{step === 1 ? 1 : '✓'}</i><span>Details<small>Employee, letter, dates, salary</small></span></button></li>
        <li className="lw-line" />
        <li className={step === 2 ? 'on' : ''}><button type="button" disabled={!text} onClick={() => setStep(2)}><i>2</i><span>Edit and issue<small>Read the letter, change it, make the PDF</small></span></button></li>
      </ol>

      {step === 1 && (
        <>
          <section className="lw-card">
            <header><h2>Employee and letter</h2><p>Who the letter is for and which letter to make.</p></header>
            <div className="lw-grid">
              <div className="lw-f" style={{ position: 'relative' }}>
                <label>Employee</label>
                {emp ? (
                  <div className="lw-pick"><span className="lw-av">{initials}</span><span><b>{emp.full_name}</b><small>{emp.emp_code}{emp.designation ? ' · ' + emp.designation : ''}</small></span><button type="button" aria-label="Change the employee" onClick={() => { setEmp(null); setText(''); setStep(1); }}>&#10005;</button></div>
                ) : (
                  <>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Type a name or employee code..." />
                    {people.length > 0 && <div className="lw-drop">
                      {people.map(p => <div key={p.id} onClick={() => { setEmp(p); setQ(''); setPeople([]); }}><b>{p.full_name}</b><small>{p.emp_code} {p.designation ? '· ' + p.designation : ''}</small></div>)}
                    </div>}
                  </>
                )}
              </div>
              <div className="lw-f">
                <label>Letter</label>
                <select value={type} onChange={e => { setType(e.target.value); setText(''); setStep(1); }}>{types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
              </div>
            </div>
          </section>

          <section className="lw-card">
            <header><h2>Dates and details</h2><p>Fill only what this letter needs. A date that is already on the employee&apos;s profile is taken from there.</p></header>
            <div className="lw-grid">
              {date('joining_date', 'Date of joining')}
              {date('resignation_date', 'Resignation date')}
              {date('last_working_day', 'Last working day')}
              {date('effective_date', 'Effective date')}
              {askVars.map(v => <div className="lw-f" key={v.key}><label>{v.label}</label><input value={custom[v.key] || ''} onChange={e => setCustom(c => ({ ...c, [v.key]: e.target.value }))} /></div>)}
            </div>
          </section>

          <section className="lw-card">
            <header className="lw-row">
              <div><h2>Salary table</h2><p>For letters that carry a salary annexure (offer, appointment, appraisal).</p></div>
              <label className="lw-sw"><input type="checkbox" checked={salaryOn} onChange={e => setSalaryOn(e.target.checked)} /><span>Add a salary table to this letter</span></label>
            </header>
            {salaryOn && (
              <>
                <p className="lw-note">Each employee has a different salary. Give each component an <b>amount</b>, or a <b>percent</b> of the monthly salary (type the monthly salary first). The yearly amount and the Grand Total are worked out. They start from the employee&apos;s salary structure when there is one. A component without an amount or percent is left out.</p>
                <div className="lw-f" style={{ maxWidth: 300, marginBottom: 12 }}>
                  <label htmlFor="ltr-grand">Monthly salary (total, needed only for percents)</label>
                  <input id="ltr-grand" type="number" min="0" value={grand} placeholder="For example 33000" onChange={e => setGrand(e.target.value)} />
                </div>
                <div className="lw-comps">
                  <div className="lw-comps-h"><span>Component</span><span>Amount</span><span>Percent</span><span /></div>
                  {comps.map((c, i) => (
                    <div key={i} className="lw-comp">
                      <input value={c.name} maxLength={40} placeholder="For example Basic" aria-label="Component name" onChange={e => setComps(x => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
                      <input type="number" min="0" value={c.amount} placeholder="Amount" aria-label="Monthly amount" onChange={e => setComps(x => x.map((y, j) => (j === i ? { ...y, amount: e.target.value, percent: e.target.value ? '' : y.percent } : y)))} />
                      <input type="number" min="0" max="100" step="0.5" value={c.percent} placeholder="%" aria-label="Percent of the monthly salary" disabled={!(Number(grand) > 0) || Number(c.amount) > 0} title={Number(grand) > 0 ? '' : 'Type the monthly salary first'} onChange={e => setComps(x => x.map((y, j) => (j === i ? { ...y, percent: e.target.value } : y)))} />
                      <button type="button" className="lw-x" aria-label="Remove the component" disabled={comps.length <= 1} onClick={() => setComps(x => x.filter((_, j) => j !== i))}>&#10005;</button>
                    </div>
                  ))}
                  <div className="lw-comps-f">
                    <button type="button" className="btn-o" disabled={comps.length >= 15} onClick={() => setComps(x => [...x, { name: '', amount: '', percent: '' }])}>+ Add a component</button>
                    <span>Monthly total <b>{inr(total)}</b></span><span>Yearly <b>{inr(total * 12)}</b></span>
                  </div>
                  {off && <div className="lw-warn">The components add up to {inr(total)}, not the monthly salary {inr(Number(grand))}.</div>}
                </div>
              </>
            )}
          </section>

          <div className="lw-bar">
            <span>{emp ? <>Letter: <b>{typeLabel}</b> for <b>{emp.full_name}</b></> : 'Pick an employee to continue.'}</span>
            <span>
              {text && <button type="button" className="btn-o" onClick={() => setStep(2)}>Back to the letter</button>}
              <button className="btn-premium" onClick={preview} disabled={busy}>{busy ? 'Preparing...' : text ? 'Prepare the letter again' : 'Prepare the letter'} &rarr;</button>
            </span>
          </div>
        </>
      )}

      {step === 2 && text && (
        <>
          <div className="lw-sum">
            <span className="lw-av">{initials}</span>
            <div><b>{emp ? emp.full_name : ''}</b><small>{emp ? emp.emp_code : ''}</small></div>
            <div className="lw-chip">{typeLabel}</div>
            <button type="button" className="btn-o" style={{ marginLeft: 'auto' }} onClick={() => setStep(1)}>&larr; Change the details</button>
          </div>
          {missing.length > 0 && <div className="lw-warn" style={{ marginBottom: 12 }}>These details are empty, so the letter has a gap where they belong: <b>{missing.join(', ')}</b>. Go back and fill them, or type them into the letter below.</div>}
          <section className="lw-card">
            <header><h2>Letter details</h2><p>Optional. These are printed on the letter.</p></header>
            <div className="lw-grid">
              <div className="lw-f"><label htmlFor="ltr-ref">Reference number</label><input id="ltr-ref" maxLength={30} value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="Leave empty for a letter without one" /></div>
              <div className="lw-f"><label htmlFor="ltr-date">Letter date</label><input id="ltr-date" type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)} /></div>
            </div>
          </section>
          <section className="lw-card lw-ed">
            <header><h2>The letter</h2><p>Change anything, like in Word. The letterhead, the company name and address and the signature are added by themselves.</p></header>
            <LetterEditor value={text} onChange={setText} salary={false} salaryMarkup={salaryOn ? () => compensationMarkup(cleanComponents(resolved), currency) : null} height={560} />
          </section>
          <div className="lw-bar">
            <span><button type="button" className="btn-o" onClick={() => setStep(1)}>&larr; Back</button></span>
            <span>
              <button className="btn-o" onClick={() => previewLetterPdf(text, { ref_no: refNo.trim(), letter_date: letterDate })} disabled={busy}>Preview the PDF</button>
              <button className="btn-premium" onClick={make} disabled={busy}>{busy ? 'Working...' : 'Make the PDF'}</button>
            </span>
          </div>
        </>
      )}
      {mailFor && <LetterEmailModal id={mailFor} onClose={() => { setMailFor(null); onDone(); }} />}
    </div>
  );
}

const LW_CSS = `
.lw { max-width:1100px; }
.lw-steps { list-style:none; display:flex; align-items:center; gap:12px; margin:0 0 16px; padding:0; }
.lw-steps li button { display:flex; align-items:center; gap:10px; background:none; border:none; cursor:pointer; font-family:inherit; text-align:left; padding:4px 2px; color:#64748b; }
.lw-steps li button:disabled { cursor:default; opacity:.65; }
.lw-steps i { width:30px; height:30px; border-radius:50%; border:2px solid #cbd5e1; display:flex; align-items:center; justify-content:center; font-style:normal; font-weight:700; font-size:.85rem; background:#fff; color:#64748b; flex:none; }
.lw-steps span { display:flex; flex-direction:column; font-weight:700; font-size:.9rem; color:#334155; } .lw-steps small { font-weight:400; font-size:.72rem; color:#94a3b8; }
.lw-steps li.on i { background:var(--brand,#6f4e37); border-color:var(--brand,#6f4e37); color:#fff; } .lw-steps li.done i { background:#16a34a; border-color:#16a34a; color:#fff; }
.lw-line { flex:1; height:2px; background:#e2e8f0; max-width:160px; }
.lw-card { background:#fff; border:1px solid #e7ded5; border-radius:12px; padding:18px 20px; margin-bottom:14px; box-shadow:0 1px 2px rgba(15,23,42,.04); }
.lw-card > header { margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #f1ebe5; } .lw-card h2 { font-size:1rem; margin:0; color:#1e293b; } .lw-card header p { margin:3px 0 0; font-size:.8rem; color:#64748b; }
.lw-row { display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; }
.lw-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:14px 16px; }
.lw-f label { display:block; font-size:.74rem; font-weight:700; color:#475569; margin-bottom:5px; letter-spacing:.2px; }
.lw-f input, .lw-f select, .lw-comp input { width:100%; box-sizing:border-box; padding:9px 12px; border:1.5px solid #dbe2ea; border-radius:9px; font-size:.88rem; outline:none; background:#fff; font-family:inherit; color:#1e293b; }
.lw-f input:focus, .lw-f select:focus, .lw-comp input:focus { border-color:var(--brand,#6f4e37); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.lw-pick { display:flex; align-items:center; gap:10px; border:1.5px solid #dbe2ea; border-radius:9px; padding:6px 10px; } .lw-pick > span:nth-child(2) { display:flex; flex-direction:column; line-height:1.25; flex:1; } .lw-pick small, .lw-sum small, .lw-drop small { color:#94a3b8; font-size:.74rem; display:block; }
.lw-pick button { border:none; background:none; cursor:pointer; color:#94a3b8; font-size:.9rem; }
.lw-av { width:34px; height:34px; border-radius:50%; background:#efe6dd; color:var(--brand,#6f4e37); font-weight:700; font-size:.8rem; display:flex; align-items:center; justify-content:center; flex:none; }
.lw-drop { position:absolute; z-index:6; left:0; right:0; top:100%; margin-top:4px; background:#fff; border:1px solid #dbe2ea; border-radius:10px; box-shadow:0 10px 28px rgba(15,23,42,.15); overflow:hidden; } .lw-drop > div { padding:8px 12px; cursor:pointer; border-top:1px solid #f1f5f9; } .lw-drop > div:first-child { border-top:none; } .lw-drop > div:hover { background:#faf6f2; }
.lw-sw { display:flex; align-items:center; gap:8px; font-size:.86rem; font-weight:600; color:#334155; cursor:pointer; }
.lw-note { font-size:.8rem; color:#64748b; margin:0 0 12px; line-height:1.5; }
.lw-comps { border:1px solid #eee5dc; border-radius:10px; padding:10px 12px; background:#fdfaf7; max-width:720px; }
.lw-comps-h, .lw-comp { display:grid; grid-template-columns:minmax(0,1fr) 140px 100px 34px; gap:8px; align-items:center; } .lw-comps-h { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#94a3b8; margin-bottom:6px; } .lw-comp { margin-bottom:8px; }
.lw-x { border:none; background:none; color:#94a3b8; cursor:pointer; font-size:.9rem; } .lw-x:hover:not(:disabled) { color:#b91c1c; } .lw-x:disabled { opacity:.3; cursor:default; }
.lw-comps-f { display:flex; gap:16px; align-items:center; flex-wrap:wrap; font-size:.86rem; color:#475569; padding-top:6px; border-top:1px dashed #e6dbcf; }
.lw-warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:9px; padding:8px 12px; font-size:.82rem; margin-top:10px; }
.lw-bar { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; background:#fff; border:1px solid #e7ded5; border-radius:12px; padding:12px 18px; font-size:.86rem; color:#475569; } .lw-bar > span:last-child { display:flex; gap:10px; flex-wrap:wrap; }
.lw-sum { display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #e7ded5; border-radius:12px; padding:10px 16px; margin-bottom:14px; } .lw-sum b { display:block; }
.lw-chip { background:#eef2ff; color:#3730a3; font-size:.76rem; font-weight:700; padding:4px 10px; border-radius:20px; }
.lw-ed { padding-bottom:16px; }
@media (max-width:700px) { .lw-comps-h { display:none; } .lw-comp { grid-template-columns:1fr 1fr; } }
`;

// The mail window: who it goes to, the subject and the text (all can be changed), and the PDF that goes with it.
function LetterEmailModal({ id, onClose }) {
  const [m, setM] = useState(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${API}/letters/${id}/email`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not prepare the mail'); return d; })
      .then(d => { setM(d); setSubject(d.subject); setHtml(d.html); setCc(d.cc || ''); setBcc(d.bcc || ''); setTo((d.recipients[0] || {}).key || ''); }).catch(e => setError(e.message));
  }, [id]);
  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/${id}/email`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, html, cc, bcc }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || 'Could not send');
      await Swal.fire({ icon: 'success', title: 'Sent', text: d.message, timer: 1800, showConfirmButton: false });
      onClose();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not sent', text: e.message }); }
    finally { setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(680px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Email the letter</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}>&#10005;</button>
        </div>
        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>{error}</div>}
        {!m && !error && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}
        {m && (
          <div style={{ display: 'grid', gap: 12 }}>
            {m.emailed_at && <div style={{ background: '#f0fdf4', color: '#15803d', padding: '8px 12px', borderRadius: 10, fontSize: 12 }}>Already emailed to {m.emailed_to} on {when(m.emailed_at)}. Sending again sends one more copy.</div>}
            <div>
              <label style={label}>To</label>
              {m.recipients.length === 0
                ? <div style={{ background: '#fffbeb', color: '#92400e', padding: '8px 12px', borderRadius: 10, fontSize: 13 }}>This employee has no email address on the profile. Add one on the employee's page first.</div>
                : <select style={input} value={to} onChange={e => setTo(e.target.value)}>{m.recipients.map(r => <option key={r.key} value={r.key}>{r.label}: {r.address}</option>)}</select>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div><label style={label}>CC</label><input style={input} value={cc} onChange={e => setCc(e.target.value)} placeholder="Separate addresses with a comma" /></div>
              <div><label style={label}>BCC</label><input style={input} value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Hidden copy" /></div>
            </div>
            <div><label style={label}>Subject</label><input style={input} value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <div><label style={label}>Attached</label><div style={{ fontSize: 13 }}>&#128206; {m.filename}</div></div>
            <div>
              <label style={label}>Message (you can change it)</label>
              <div contentEditable suppressContentEditableWarning style={{ ...input, minHeight: 140, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: m.html }} onBlur={e => setHtml(e.currentTarget.innerHTML)} />
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>The standard wording and the always-copied people (CC / BCC) come from the email template named "Letter" (Settings &gt; Email Templates).</div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-o" onClick={onClose}>Cancel</button>
              <button className="btn-premium" onClick={send} disabled={busy || !to}>{busy ? 'Sending...' : 'Send email'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// HR changes a letter that was made: the reference number, the date and the text. The PDF is drawn again from these.
function LetterEditModal({ id, onClose, onSaved }) {
  const [d, setD] = useState(null);
  const [ref, setRef] = useState('');
  const [day, setDay] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`${API}/letters/${id}?json=1`, { headers: auth() }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.detail || 'Could not open the letter'); return j; })
      .then(j => { setD(j); setRef(j.ref_no || ''); setDay(j.day || ''); setText(j.body || ''); }).catch(e => setError(e.message));
  }, [id]);
  const changed = d && (ref.trim() !== (d.ref_no || '') || day !== d.day || text.trim() !== String(d.body || '').trim());
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/${id}`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ref_no: ref.trim(), day, text }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || 'Could not save');
      await Swal.fire({ icon: 'success', title: j.message, text: d.emailed_at ? 'This letter was already emailed. Email it again to send the changed copy.' : undefined, timer: d.emailed_at ? undefined : 1500, showConfirmButton: !!d.emailed_at });
      onSaved();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(1000px, 100%)', maxHeight: '94vh', overflow: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Edit the letter{d ? ` - ${d.title}` : ''}</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' }}>&#10005;</button>
        </div>
        {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>{error}</div>}
        {!d && !error && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}
        {d && (
          <div style={{ display: 'grid', gap: 12 }}>
            {d.emailed_at && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>This letter was already emailed. The copy the employee has stays as it was; after saving, email it again to send the changed one.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div><label style={label} htmlFor="le-ref">Reference number (optional)</label><input id="le-ref" style={input} maxLength={30} value={ref} onChange={e => setRef(e.target.value)} /></div>
              <div><label style={label} htmlFor="le-day">Letter date (optional)</label><input id="le-day" type="date" style={input} value={day} onChange={e => setDay(e.target.value)} /></div>
            </div>
            <div>
              <label style={label}>The letter</label>
              <LetterEditor value={text} onChange={setText} salary={false} height={460} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-o" onClick={onClose}>Cancel</button>
              <button className="btn-o" onClick={() => previewLetterPdf(text, { ref_no: ref.trim(), letter_date: day, title: d.title })}>Preview the PDF</button>
              <button className="btn-premium" onClick={save} disabled={busy || !changed}>{busy ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// the letters that were made (HR: all of them; an employee: their own)
export function Issued({ isHr }) {
  const [data, setData] = useState({ letters: [], total: 0, types: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [mailFor, setMailFor] = useState(null);
  const [editFor, setEditFor] = useState(null);
  const ready = useRef(false);

  const removeLetter = async (l) => {
    const c = await Swal.fire({
      icon: 'warning', title: 'Delete this letter?',
      html: `<b>${String(l.title).replace(/</g, '&lt;')}</b>${l.ref_no ? ` (${String(l.ref_no).replace(/</g, '&lt;')})` : ''} of ${String(l.full_name || l.emp_code || 'the employee').replace(/</g, '&lt;')} will be removed for good. The employee will no longer see it in the portal and the PDF cannot be opened again.`,
      showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#dc2626', focusCancel: true,
    });
    if (!c.isConfirmed) return;
    try {
      const res = await fetch(`${API}/letters/${l.id}`, { method: 'DELETE', headers: auth() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not delete');
      Swal.fire({ icon: 'success', title: d.message, timer: 1400, showConfirmButton: false });
      // the last letter of a page goes: show the page before it
      load(data.letters.length === 1 && page > 1 ? page - 1 : page);
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not deleted', text: e.message }); }
  };

  const load = useCallback((p = 1, o = {}) => {
    setLoading(true); setError('');
    const q = { type, search, perPage: pageSize, ...o };
    const params = new URLSearchParams({ page: p, per_page: q.perPage });
    if (q.type) params.set('type', q.type);
    if (q.search) params.set('search', q.search);
    fetch(`${API}/letters?${params}`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
      .then(d => { setData(d); setPage(d.page || 1); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [type, search, pageSize]);
  useEffect(() => { load(1); }, []);
  useEffect(() => {
    if (!ready.current) { ready.current = true; return; }
    const t = setTimeout(() => load(1), 350);
    return () => clearTimeout(t);
  }, [search]);

  const cell = { padding: '9px 12px' };
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {isHr && <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by employee or reference..." style={{ ...input, flex: '1 1 220px', maxWidth: 320, width: 'auto' }} />}
        <select value={type} onChange={e => { setType(e.target.value); load(1, { type: e.target.value }); }} style={{ ...input, width: 'auto' }}>
          <option value="">All letters</option>{data.types.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem' }}>{error}</div>}
      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', textAlign: 'left' }}><th style={cell}>#</th><th style={cell}>Reference</th>{isHr && <th style={cell}>Employee</th>}<th style={cell}>Letter</th><th style={cell}>Date</th>{isHr && <th style={cell}>Made by</th>}{isHr && <th style={cell}>Emailed</th>}<th style={cell}></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="8" style={{ textAlign: 'center', padding: 26, color: '#94a3b8' }}>Loading...</td></tr>
                : data.letters.length === 0 ? <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>{isHr ? 'No letters made yet.' : 'No letters have been issued to you yet.'}</td></tr>
                : data.letters.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ ...cell, color: '#94a3b8' }}>{(page - 1) * pageSize + i + 1}</td>
                    <td style={{ ...cell, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.ref_no || '-'}</td>
                    {isHr && <td style={{ ...cell, whiteSpace: 'nowrap' }}>{l.full_name || '-'} <span style={{ color: '#94a3b8' }}>({l.emp_code})</span></td>}
                    <td style={cell}>{l.title}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{l.no_date ? <span style={{ color: '#94a3b8' }}>-</span> : when(l.issued_on)}</td>
                    {isHr && <td style={{ ...cell, color: '#64748b' }}>{String(l.issued_by || '').split('@')[0]}</td>}
                    {isHr && <td style={{ ...cell, whiteSpace: 'nowrap', fontSize: 12, color: l.emailed_at ? '#15803d' : '#94a3b8' }}>{l.emailed_at ? <span title={l.emailed_to}>{when(l.emailed_at)}</span> : 'Not yet'}</td>}
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}><button className="btn-premium" onClick={() => openLetter(l.id)}>Open PDF</button>{isHr && <> <button className="btn-premium" style={{ background: '#64748b' }} onClick={() => setMailFor(l.id)}>{l.emailed_at ? 'Email again' : 'Email'}</button> <button className="btn-o" style={{ height: 32 }} onClick={() => setEditFor(l.id)}>Edit</button> <button className="btn-o" style={{ height: 32, color: '#b91c1c' }} onClick={() => removeLetter(l)}>Delete</button></>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {mailFor && <LetterEmailModal id={mailFor} onClose={() => { setMailFor(null); load(page); }} />}
        {editFor && <LetterEditModal id={editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); load(page); }} />}
        <div style={{ padding: '0 14px 12px' }}>
          <Pagination page={page} totalItems={data.total} pageSize={pageSize} itemLabel="letters" onPageChange={p => load(p)} onPageSizeChange={n => { setPageSize(n); load(1, { perPage: n }); }} />
        </div>
      </div>
    </div>
  );
}

// How the letters get their header: the company header the app draws, HR's own letterhead picture behind every page, or none at all.
const LH_MODES = [
  ['company', 'Company header', 'The logo, company name and address from Settings > Company, with a line under them. Nothing to upload.'],
  ['image', 'My letterhead image', 'Upload your own letterhead design as a picture. It is placed behind every page and the text is written inside it.'],
  ['none', 'No header (printed paper)', 'Leaves the top of the page empty so the letter can be printed on paper that already has the letterhead.'],
];

function Letterhead() {
  const [saved, setSaved] = useState(null);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [ratio, setRatio] = useState(0); // width / height of the chosen picture
  const picture = f ? f.image : '';
  useEffect(() => {
    if (!picture) { setRatio(0); return; }
    const im = new Image();
    im.onload = () => setRatio(im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0);
    im.src = picture;
  }, [picture]);
  const load = () => fetch(`${API}/letters/letterhead`, { headers: auth() }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail || 'Could not load'); return d; })
    .then(d => { setSaved(d); setF({ mode: d.mode, image: d.image || '', placement: d.placement || 'auto', top_mm: d.top_mm, bottom_mm: d.bottom_mm }); }).catch(e => Swal.fire({ icon: 'error', title: 'Error', text: e.message }));
  useEffect(() => { load(); }, []);
  if (!f) return <div style={{ padding: 20, color: '#94a3b8' }}>Loading...</div>;

  const dirty = f.mode !== saved.mode || (f.image || '') !== (saved.image || '') || f.placement !== (saved.placement || 'auto') || Number(f.top_mm) !== saved.top_mm || Number(f.bottom_mm) !== saved.bottom_mm;
  const spaced = f.mode !== 'company';
  const pickFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { Swal.fire({ icon: 'warning', title: 'PNG or JPG only', text: 'Save the letterhead as a PNG or JPG picture and choose it again.' }); return; }
    if (file.size > 3 * 1024 * 1024) { Swal.fire({ icon: 'warning', title: 'The picture is too big', text: 'Keep it under 3 MB. A4 size (2480 x 3508 pixels) is enough.' }); return; }
    const rd = new FileReader();
    rd.onload = () => setF(x => ({ ...x, image: rd.result }));
    rd.readAsDataURL(file);
  };
  const body = () => ({ mode: f.mode, placement: f.placement, top_mm: Number(f.top_mm), bottom_mm: Number(f.bottom_mm), image: f.image || '' });
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/letterhead`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body()) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || 'Could not save');
      Swal.fire({ icon: 'success', title: d.message, timer: 1500, showConfirmButton: false });
      await load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };
  // the sample is drawn with what is on the screen, so it can be looked at before saving
  const preview = async () => {
    const tab = window.open('', '_blank');
    setBusy(true);
    try {
      const res = await fetch(`${API}/letters/letterhead/preview`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body()) });
      if (!res.ok) { let m = 'Could not make the preview'; try { m = (await res.json()).detail || m; } catch { /* not json */ } throw new Error(m); }
      const url = URL.createObjectURL(await res.blob());
      if (tab) tab.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { if (tab) tab.close(); Swal.fire({ icon: 'error', title: 'No preview', text: e.message }); }
    finally { setBusy(false); }
  };

  // the same rule as the PDF: a picture of A4 shape fills the page, a wide strip goes on top; a strip also moves the text past itself
  const hasPic = f.mode === 'image' && !!f.image && ratio > 0;
  const where = !hasPic ? 'none' : f.placement !== 'auto' ? f.placement : (ratio >= 0.55 && ratio <= 0.9 ? 'full' : 'top');
  const stripMm = hasPic && (where === 'top' || where === 'bottom') ? 210 / ratio : 0;
  const topMm = Math.max(Number(f.top_mm) || 0, hasPic && where === 'top' ? stripMm + 5 : 0);
  const botMm = Math.max(Number(f.bottom_mm) || 0, hasPic && where === 'bottom' ? stripMm + 4 : 0);
  const topPct = Math.min(100, topMm / 297 * 100), botPct = Math.min(100, botMm / 297 * 100);
  const imgStyle = where === 'top' ? { top: 0, left: 0, width: '100%' } : where === 'bottom' ? { bottom: 0, left: 0, width: '100%' } : { inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
  return (
    <div className="lh-wrap">
      <style>{LH_CSS}</style>
      <div className="lh-main">
        <h3>Header of the letters</h3>
        <p className="lh-sub">Choose how every letter you make looks at the top. It applies to the PDF you open, the PDF you email, and the Full and Final statement.</p>
        <div className="lh-modes" role="radiogroup" aria-label="Header of the letters">
          {LH_MODES.map(([k, t, d]) => (
            <button key={k} type="button" role="radio" aria-checked={f.mode === k} className={`lh-mode${f.mode === k ? ' on' : ''}`} onClick={() => setF({ ...f, mode: k })}>
              <span className="lh-dot" /><span><b>{t}</b><small>{d}</small></span>
            </button>
          ))}
        </div>

        {f.mode === 'image' && (
          <div className="lh-block">
            <label className="lh-label">Letterhead picture</label>
            <div className="lh-row">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={pickFile} style={{ display: 'none' }} />
              <button type="button" className="btn-o" onClick={() => fileRef.current && fileRef.current.click()}>{f.image ? 'Choose another picture' : 'Choose the picture'}</button>
              {f.image && <button type="button" className="btn-o lh-rm" onClick={() => setF({ ...f, image: '' })}>Remove</button>}
              <span className="lh-hint">PNG or JPG, under 3 MB. It can be a whole A4 page (2480 x 3508 pixels) or a strip across the top or the bottom. The picture is never stretched.</span>
            </div>
            {f.image && (
              <div style={{ marginTop: 12 }}>
                <label className="lh-small" htmlFor="lh-place">Where the picture goes</label>
                <select id="lh-place" className="lh-sel" value={f.placement} onChange={e => setF({ ...f, placement: e.target.value })}>
                  <option value="auto">Automatic{ratio ? ` (${where === 'full' ? 'whole page' : 'a strip at the top'})` : ''}</option>
                  <option value="top">A strip at the top of every page</option>
                  <option value="bottom">A strip at the bottom of every page</option>
                  <option value="full">The whole page</option>
                </select>
              </div>
            )}
          </div>
        )}

        {spaced && (
          <div className="lh-block">
            <label className="lh-label">Space for the text</label>
            <div className="lh-row">
              <div><label className="lh-small" htmlFor="lh-top">Keep empty at the top (mm)</label><input id="lh-top" type="number" min="0" max="120" className="lh-num" value={f.top_mm} onChange={e => setF({ ...f, top_mm: e.target.value })} /></div>
              <div><label className="lh-small" htmlFor="lh-bot">Keep empty at the bottom (mm)</label><input id="lh-bot" type="number" min="0" max="80" className="lh-num" value={f.bottom_mm} onChange={e => setF({ ...f, bottom_mm: e.target.value })} /></div>
              <span className="lh-hint">The text starts below the top space and stops above the bottom space. A strip pushes the text past itself by itself, so these only need to be set for extra room.</span>
            </div>
          </div>
        )}
        {f.mode === 'company' && <p className="lh-note">To change the logo, name or address in this header, go to Settings &gt; Company.</p>}

        <div className="lh-actions">
          <button className="btn-premium" onClick={save} disabled={busy || !dirty}>{busy ? 'Working...' : 'Save'}</button>
          <button className="btn-o" onClick={preview} disabled={busy || (f.mode === 'image' && !f.image)}>Preview a sample letter</button>
          {dirty && <span className="lh-dirty">Unsaved changes</span>}
          {saved.updated_at && !dirty && <span className="lh-hint">Last saved {when(saved.updated_at)}{saved.updated_by ? ` by ${String(saved.updated_by).split('@')[0]}` : ''}</span>}
        </div>
      </div>

      <div className="lh-side">
        <div className="lh-page" aria-label="Page preview">
          {hasPic && <img src={f.image} alt="Letterhead" style={imgStyle} />}
          {f.mode === 'company' && <div className="lh-co"><i /><b>Company name</b><span>logo, name and address</span></div>}
          {spaced && <div className="lh-zone top" style={{ height: topPct + '%' }}><span>{f.mode === 'none' ? 'left empty' : 'letterhead area'}</span></div>}
          <div className="lh-lines" style={{ top: (f.mode === 'company' ? 17 : topPct) + '%', bottom: (spaced ? botPct : 8) + '%' }}>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => <u key={i} style={{ width: (i % 4 === 3 ? 60 : 100) + '%' }} />)}</div>
          {spaced && <div className="lh-zone bottom" style={{ height: botPct + '%' }} />}
        </div>
        <small className="lh-hint" style={{ textAlign: 'center' }}>Where the text will be written</small>
      </div>
    </div>
  );
}

const LH_CSS = `
.lh-wrap { display:grid; grid-template-columns:minmax(0,1fr) 250px; gap:16px; align-items:start; background:#fff; border:1px solid #eadfd5; border-radius:12px; padding:18px; }
.lh-main h3 { margin:0 0 2px; font-size:1.02rem; } .lh-sub { margin:0 0 14px; font-size:.82rem; color:#64748b; }
.lh-modes { display:grid; gap:8px; }
.lh-mode { display:flex; gap:12px; align-items:flex-start; text-align:left; border:1px solid #e2e8f0; background:#fff; border-radius:11px; padding:11px 14px; cursor:pointer; font-family:inherit; }
.lh-mode b { display:block; font-size:.88rem; color:#1e293b; } .lh-mode small { display:block; font-size:.76rem; color:#64748b; margin-top:2px; line-height:1.4; }
.lh-mode:hover { border-color:var(--brand-line); background:var(--brand-soft); }
.lh-mode.on { border-color:var(--brand); background:var(--brand-soft); box-shadow:0 0 0 3px rgba(111,78,55,.1); }
.lh-dot { width:16px; height:16px; border-radius:50%; border:2px solid #cbd5e1; flex-shrink:0; margin-top:2px; box-sizing:border-box; }
.lh-mode.on .lh-dot { border-color:var(--brand); background:radial-gradient(var(--brand) 45%, transparent 50%); }
.lh-block { margin-top:16px; }
.lh-label { display:block; font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#64748b; margin-bottom:6px; }
.lh-small { display:block; font-size:.74rem; color:#64748b; margin-bottom:3px; }
.lh-row { display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; }
.lh-num { width:130px; border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; font-size:.88rem; font-family:inherit; background:#fff; }
.lh-num:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.lh-hint { font-size:.74rem; color:#94a3b8; line-height:1.45; max-width:420px; }
.lh-note { margin:14px 0 0; font-size:.8rem; color:#64748b; }
.lh-rm { color:#b91c1c !important; }
.lh-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:18px; padding-top:14px; border-top:1px solid #f1e8df; }
.lh-actions .btn-premium:disabled { opacity:.45; cursor:default; }
.lh-dirty { font-size:.72rem; font-weight:700; color:#b45309; background:#fef3c7; border-radius:20px; padding:3px 10px; }
.lh-side { display:flex; flex-direction:column; gap:6px; align-items:center; }
.lh-page { position:relative; width:210px; aspect-ratio:210/297; background:#fff; border:1px solid #d8cdc2; border-radius:4px; box-shadow:0 8px 24px -12px rgba(78,54,38,.4); overflow:hidden; }
.lh-page img { position:absolute; display:block; }
.lh-sel { border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px; font-size:.86rem; font-family:inherit; background:#fff; min-width:260px; max-width:100%; }
.lh-sel:focus { outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(111,78,55,.12); }
.lh-zone { position:absolute; left:0; right:0; background:repeating-linear-gradient(135deg, rgba(111,78,55,.12) 0 6px, transparent 6px 12px); display:flex; align-items:flex-end; justify-content:center; }
.lh-zone.top { top:0; border-bottom:1px dashed var(--brand); } .lh-zone.bottom { bottom:0; border-top:1px dashed var(--brand); }
.lh-zone span { font-size:.6rem; color:var(--brand-dark); background:rgba(255,255,255,.85); padding:0 6px; border-radius:4px 4px 0 0; }
.lh-co { position:absolute; left:8%; right:8%; top:5%; display:flex; flex-direction:column; align-items:flex-end; border-bottom:2px solid #2563eb; padding-bottom:5px; height:9%; }
.lh-co i { position:absolute; left:0; top:0; width:26%; height:60%; background:#e2e8f0; border-radius:3px; } .lh-co b { font-size:.62rem; color:#0f172a; } .lh-co span { font-size:.5rem; color:#94a3b8; }
.lh-lines { position:absolute; left:11%; right:11%; padding-top:6%; display:flex; flex-direction:column; gap:8px; overflow:hidden; }
.lh-lines u { display:block; height:4px; background:#cbd5e1; border-radius:2px; text-decoration:none; }
@media (max-width:820px) { .lh-wrap { grid-template-columns:1fr; } }
`;


// The words of the letters. Every word can be added, changed and removed. A word is filled from a piece of data (the employee's profile,
// the company settings, the salary...), from a fixed text, or typed in each time a letter is made.
function Words() {
  const [data, setData] = useState({ words: [], sources: [] });
  const [f, setF] = useState({ label: '', key: '', kind: 'field', value: '' });
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const load = () => fetch(`${API}/letters/variables`, { headers: auth() }).then(r => r.json()).then(d => { if (d.words) setData(d); }).catch(() => {});
  useEffect(() => { load(); }, []);
  const send = async (method, body, qs = '') => {
    const res = await fetch(`${API}/letters/variables${qs}`, { method, headers: { ...auth(), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.detail || 'Failed');
    return d;
  };
  const srcName = (id) => (data.sources.find(x => x[0] === id) || [id, id])[1];
  const how = (v) => v.kind === 'ask' ? 'Typed each time a letter is made' : v.kind === 'field' ? 'From: ' + srcName(v.value) : v.value;
  const add = async () => {
    setBusy(true);
    try { await send('POST', f); setF({ label: '', key: '', kind: f.kind, value: '' }); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not added', text: e.message }); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try { await send('PUT', edit); setEdit(null); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Not saved', text: e.message }); }
    finally { setBusy(false); }
  };
  const remove = async (v) => {
    const c = await Swal.fire({ icon: 'warning', title: `Remove {{${v.key}}}?`, text: 'Letter texts that still use it will show a gap where it was.', showCancelButton: true, confirmButtonText: 'Remove', confirmButtonColor: '#dc2626' });
    if (!c.isConfirmed) return;
    try {
      const d = await send('DELETE', null, `?key=${encodeURIComponent(v.key)}`);
      if (d.still_used_in && d.still_used_in.length) Swal.fire({ icon: 'info', title: 'Removed', text: 'Still written in: ' + d.still_used_in.join(', ') + '. Take it out of those texts.' });
      load();
    } catch (e) { Swal.fire({ icon: 'error', title: 'Not removed', text: e.message }); }
  };
  const restore = async () => {
    try { const d = await send('POST', { action: 'restore_standard' }); Swal.fire({ icon: 'success', title: d.message, timer: 1600, showConfirmButton: false }); load(); }
    catch (e) { Swal.fire({ icon: 'error', title: 'Failed', text: e.message }); }
  };
  const th = { padding: '8px 10px', textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 600 };
  const td = { padding: '8px 10px', fontSize: 13, borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
  const valueInput = (o, set) => o.kind === 'field'
    ? <select style={input} value={o.value} onChange={e => set({ ...o, value: e.target.value })}><option value="">Pick the data...</option>{data.sources.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
    : o.kind === 'text' ? <input style={input} value={o.value} onChange={e => set({ ...o, value: e.target.value })} placeholder="For example +91 98765 43210" /> : <span style={{ color: '#94a3b8', fontSize: 13 }}>typed when the letter is made</span>;
  const kindSelect = (o, set) => <select style={input} value={o.kind} onChange={e => set({ ...o, kind: e.target.value, value: '' })}><option value="field">From employee / company data</option><option value="text">A fixed text</option><option value="ask">Typed each time</option></select>;
  const shown = data.words.filter(v => !q.trim() || (v.key + ' ' + v.label).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Add a word</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>A word is written in a letter text as <code>{'{{word}}'}</code> and replaced when the letter is made. It can come from <b>data</b> (the employee's profile, the company, the salary), be a <b>fixed text</b> (an HR phone number, the notice period), or be <b>typed each time</b> a letter is made (a bonus amount, a reason).</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div><label style={label}>Name (what HR sees)</label><input style={input} value={f.label} onChange={e => setF({ ...f, label: e.target.value })} placeholder="For example HR phone" /></div>
          <div><label style={label}>Word (optional)</label><input style={input} value={f.key} onChange={e => setF({ ...f, key: e.target.value })} placeholder="made from the name, e.g. hr_phone" /></div>
          <div><label style={label}>Filled in</label>{kindSelect(f, setF)}</div>
          {f.kind !== 'ask' && <div><label style={label}>{f.kind === 'field' ? 'Data' : 'The text'}</label>{valueInput(f, setF)}</div>}
        </div>
        <div style={{ marginTop: 12 }}><button className="btn-premium" onClick={add} disabled={busy}>Add the word</button></div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', marginRight: 'auto' }}>Words ({data.words.length})</h3>
          <input style={{ ...input, width: 200 }} placeholder="Search words" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn-o" style={{ height: 34 }} onClick={restore} title="Puts back any of the standard words that were removed">Restore standard words</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>#</th><th style={th}>Word</th><th style={th}>Name</th><th style={th}>Filled in</th><th /></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>No words.</td></tr>}
              {shown.map((v, i) => edit && edit.key === v.key ? (
                <tr key={v.key}>
                  <td style={{ ...td, color: '#94a3b8' }}>{i + 1}</td>
                  <td style={td}><code>{`{{${v.key}}}`}</code></td>
                  <td style={td}><input style={input} value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} /></td>
                  <td style={td}><div style={{ display: 'grid', gap: 6 }}>{kindSelect(edit, setEdit)}{valueInput(edit, setEdit)}</div></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}><button className="btn-premium" style={{ padding: '5px 12px' }} onClick={save} disabled={busy}>Save</button> <button className="btn-o" style={{ height: 30 }} onClick={() => setEdit(null)}>Cancel</button></td>
                </tr>
              ) : (
                <tr key={v.key}>
                  <td style={{ ...td, color: '#94a3b8' }}>{i + 1}</td>
                  <td style={td}><code style={{ color: 'var(--brand-dark)' }}>{`{{${v.key}}}`}</code></td>
                  <td style={td}>{v.label}</td>
                  <td style={{ ...td, color: v.kind === 'text' ? '#334155' : '#64748b' }}>{how(v)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn-o" style={{ height: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setEdit({ key: v.key, label: v.label, kind: v.kind, value: v.value })}>Edit</button>{' '}
                    <button onClick={() => remove(v)} style={{ border: 'none', background: '#fef2f2', color: '#dc2626', borderRadius: 6, height: 28, padding: '0 10px', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#94a3b8' }}>A word is not locked to its name: "Edit" can point it at other data, give it a fixed text, or make it typed each time. A word's own name (the part in braces) cannot be changed; add a new word and remove the old one for that.</p>
      </div>
    </div>
  );
}
