import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

// The payroll chapters of the Guide (the whole-project guide is in help/Guide.jsx, which uses these sections).
// Where each thing is done, how a salary is worked out, which setting decides what, and how to do each job.
// It only describes the program. Every figure it names (days, percentages, rates) is a setting, and the guide says where.

const th = { padding: '7px 10px', textAlign: 'left', background: '#eff4ff', color: 'var(--brand-dark)', fontSize: '.74rem', border: '1px solid #d4def2' };
const td = { padding: '7px 10px', fontSize: '.82rem', border: '1px solid #e2e8f0', verticalAlign: 'top' };
export const Table = ({ head, rows, widths }) => (
  <div style={{ overflowX: 'auto', margin: '8px 0' }}>
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr>{head.map((h, i) => <th key={h} style={{ ...th, width: widths && widths[i] }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...td, fontWeight: j === 0 ? 700 : 400 }}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
export const Steps = ({ items }) => <ol style={{ margin: '6px 0 6px 20px', padding: 0, fontSize: '.86rem', lineHeight: 1.7 }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ol>;
// A paragraph of the guide is shown as points: one point for each sentence (a one-sentence paragraph stays a line).
const ABBR = /(?:e\.g|i\.e|etc|vs|Rs|No|approx|incl|Dr|Mr|Mrs)\.$/i;
const toPoints = (children) => {
  const items = [[]];
  const nodes = React.Children.toArray(children);
  nodes.forEach((n) => {
    if (typeof n !== 'string') { items[items.length - 1].push(n); return; }
    const re = /[.!?]["')]?\s+(?=[A-Z0-9"(₹])/g;
    let last = 0, m;
    while ((m = re.exec(n))) {
      const end = m.index + m[0].trimEnd().length;
      if (ABBR.test(n.slice(0, end))) continue;
      items[items.length - 1].push(n.slice(last, end));
      items.push([]); last = m.index + m[0].length;
    }
    items[items.length - 1].push(n.slice(last));
  });
  return items.filter(it => it.some(x => typeof x !== 'string' || x.trim()));
};
export const P = ({ children }) => {
  const items = toPoints(children);
  if (items.length < 2) return <p style={{ margin: '6px 0', fontSize: '.86rem', lineHeight: 1.65 }}>{children}</p>;
  return <ul style={{ margin: '6px 0 8px 20px', padding: 0, fontSize: '.86rem', lineHeight: 1.7 }}>{items.map((it, i) => <li key={i}>{it.map((x, j) => <React.Fragment key={j}>{x}</React.Fragment>)}</li>)}</ul>;
};
// a picture of the page being described
export const Shot = ({ src, alt, caption }) => (
  <figure style={{ margin: '8px 0 12px', maxWidth: 640 }}>
    <img src={src} alt={alt} loading="lazy" style={{ width: '100%', border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, display: 'block' }} />
    {caption && <figcaption style={{ fontSize: '.74rem', color: 'var(--text-muted, #64748b)', marginTop: 4 }}>{caption}</figcaption>}
  </figure>
);
export const Note = ({ children, tone = '#fff7ed', border = '#fed7aa' }) => <div style={{ background: tone, border: '1px solid ' + border, borderRadius: 10, padding: '8px 12px', margin: '8px 0', fontSize: '.82rem', lineHeight: 1.6 }}>{children}</div>;
const Formula = ({ children }) => <div style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: '10px 14px', margin: '8px 0', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '.82rem', overflowX: 'auto' }}>{children}</div>;

export const SECTIONS = [
  { id: 'flow', title: '1. How a salary is made (the big picture)', body: (
    <>
      <P>Every month the salary of every employee is worked out from three things: <b>what the employee earns</b> (Salary Structure), <b>how many days were paid</b> (Attendance) and <b>what HR types for the month</b> (Salary Sheet). The Salary Sheet, its Excel file and the payslips all use the same calculation, so they always show the same numbers.</P>
      <Steps items={[
        <><b>Salary Structure</b> (Payroll &rarr; Salary Structures): HR enters the monthly pay of each employee. Without a structure an employee is not on the Salary Sheet.</>,
        <><b>Attendance</b> (Attendance &rarr; Daily Records): punches come from TeamOffice by themselves. Approved leave and WFH are written into attendance as CL, UPL, WFH and so on.</>,
        <><b>Salary Sheet</b> (Payroll &rarr; Salary Sheet): the month is worked out automatically. HR can type Variable Pay, Incentive, EL days and Extra Work days for the month.</>,
        <><b>Payslips</b> (Payroll &rarr; Generate Payslips): a draft payslip is made for each employee, by itself on the day set in Payslip Settings or by hand. The employee sees nothing yet.</>,
        <><b>Approve and email</b> (Payroll &rarr; Payslip History): HR checks the drafts and presses Approve &amp; email. The employee gets the mail and sees the payslip in My Payslips. A copy goes to Google Drive in a folder for the month.</>,
      ]} />
    </>) },

  { id: 'pages', title: '2. Which page does what', body: (
    <Table head={['Page', 'Where', 'What it is for']} widths={['20%', '26%', '54%']} rows={[
      ['Salary Structures', 'Payroll', 'Monthly pay of each employee (Basic, HRA, Conveyance, Food Vouchers, custom columns, deductions, incentive, EL amount and EL frequency). Changing it keeps a history. The 🕘 button opens the history of that employee.'],
      ['Salary Sheet', 'Payroll', 'The month for everyone: paid days, unpaid days, deductions, additions, EL, CL and the Final Salary Transfer. Type Variable Pay, Incentive, EL days and Extra Work days here. Export to Excel.'],
      ['Statutory Deductions', 'Payroll', 'PF, ESI, TDS, professional tax or any other deduction the company makes. Every rate is entered by HR; nothing is built in; a rule deducts nothing until it is ON.'],
      ['Salary Revisions', 'Payroll', 'History of every salary change: from which date, why, and the pay before and after.'],
      ['Generate Payslips', 'Payroll', 'Make the draft payslips of a month (all employees or one).'],
      ['Payslip History', 'Payroll', 'Check the drafts, approve and email them, open or download a payslip, send the mail again (the text can be edited first), save a month to Google Drive.'],
      ['My Payslips', 'Employee portal', 'The employee sees only approved payslips and can download them.'],
      ['Daily Records / Corrections', 'Attendance', 'Fix a single day of attendance (for example mark it Holiday or WFH). A day marked by hand is never changed by the TeamOffice sync.'],
      ['Leave Management / WFH Management', 'Leave & WFH', 'Approve leave and WFH. When the last approver says yes, the days go into attendance (CL, UPL, sandwich days, WFH).'],
      ['Exit & Full and Final', 'Employee Services', 'When an employee leaves: checklist and the settlement of salary, EL and recoveries, with a PDF statement.'],
      ['Payslip Settings', 'Settings', 'Month days (actual or 30), Extra Work rate, EL frequencies, automatic draft payslips (on/off and day), names and signatures printed on the payslip.'],
      ['Attendance Settings', 'Settings', 'Weekly off days, half-day hours, CL days (month and year), sandwich leave, auto-sync from TeamOffice.'],
      ['Holiday Calendar', 'Settings', 'The holidays. A holiday is a paid day even if attendance says absent.'],
      ['Status Master', 'Settings', 'What every attendance status (P, A, HD, WO, HOL, WFH, EW, CL, UPL ...) counts as: present, unpaid, extra pay, and which TeamOffice code maps to it.'],
    ]} />) },

  { id: 'formulas', title: '3. The formulas (column by column)', body: (
    <>
      <Table head={['Item', 'How it is worked out']} widths={['24%', '76%']} rows={[
        ['Month Days', 'The days in the month (28 to 31), or a fixed 30. Chosen in Payslip Settings.'],
        ['UnPaid Days', 'Absent days + Unpaid Leave days (including sandwich days) + half of each Half Day. Weekly offs, holidays, WFH, Extra Work and CL are never unpaid. Days that have not happened yet are not unpaid. A day in the Holiday Calendar is paid even if attendance says absent. The weights come from Status Master.'],
        ['Paid Days', 'Month Days - UnPaid Days'],
        ['Salary', 'Basic + HRA + Conveyance + Food Vouchers + custom earnings, from the salary structure that was valid in that month'],
        ['PerDay Salary', 'Salary / Month Days'],
        ['Net Payable', 'PerDay Salary x Paid Days (every component is cut by the same share)'],
        ['Insurance, Other Deductions', 'As in the salary structure (not cut by paid days)'],
        ['Statutory Deductions', 'Each rule that is ON. Percent: wage (Basic or Gross of the paid days, up to the ceiling) x employee %. Fixed: the same amount every month. Slab (TDS): (monthly salary x 12 - yearly exemption) taxed band by band, plus cess, divided by 12. A rule can apply only up to a salary limit, and an employee can be left out of it on the salary structure. The company\'s own share is shown but not taken from the employee.'],
        ['Extra Work Pay', 'PerDay Salary x Extra Work days x the Extra Work rate (Payslip Settings)'],
        ['EL Pay (encashment)', 'EL days typed for the month x PerDay Salary; if nothing is typed, the EL amount of the salary structure, paid on the months of the employee\'s EL frequency'],
        ['Incentive, Variable Pay', 'Incentive from the structure (HR can change it for a month); Variable Pay typed by HR for the month'],
      ]} />
      <Formula>Final Salary Transfer = Net Payable - Insurance - Other Deductions - Statutory Deductions + Variable Pay + Incentive + EL Pay + Extra Work Pay</Formula>
      <Note tone="#f0fdf4" border="#bbf7d0"><b>Example.</b> A month of 31 days and a salary of 31,000 gives a PerDay Salary of 1,000. 5 unpaid days leave 26 Paid Days, so Net Payable is 26,000. With insurance 500, incentive 1,000 and one Extra Work day (1,000 at rate 1) the Final Salary Transfer is 26,000 - 500 + 1,000 + 1,000 = 27,500. (The numbers are only an example.)</Note>
      <P>A month is always worked out with the salary structure that was valid in that month: if the pay was revised from 1 December, October and November still use the old pay.</P>
    </>) },

  { id: 'leave', title: '4. Leave, CL, UPL, sandwich and EL: how they reach the salary', body: (
    <>
      <Steps items={[
        <>The employee applies in the portal. It goes to the reporting manager first, then HR (straight to HR when there is no manager). Mails and portal alerts go at each step.</>,
        <>When HR gives the final approval, every working day of the leave is written into attendance: the month's <b>CL</b> first (days a month are set in Attendance Settings), the rest <b>UPL</b> (unpaid). A half-day leave uses half a CL, or becomes a Half Day.</>,
        <><b>Sandwich leave</b> (Attendance Settings): when a leave has at least the set number of working days, the weekly offs and holidays between its leave days are leave too. It can be switched off.</>,
        <>CL is paid; UPL and sandwich days add to UnPaid Days, so the pay is cut for them.</>,
        <><b>EL</b>: every Extra Work day (a punch on a weekly off or a holiday) earns one EL day. The Salary Sheet shows EL Earned, EL Given (according to the employee's EL frequency) and EL Balance. EL does not change the pay by itself; EL Pay is a separate entry.</>,
        <><b>CL Used / CL Left</b> on the Salary Sheet: CL days taken this year against the yearly CL days of Attendance Settings.</>,
      ]} />
      <Note>The statuses CL, CL/2 and UPL are in Status Master (they can be renamed and their weights changed there).</Note>
    </>) },

  { id: 'settings', title: '5. Which setting decides what', body: (
    <Table head={['Setting', 'Where', 'Decides']} widths={['28%', '28%', '44%']} rows={[
      ['Month days', 'Settings > Payslip Settings', 'Whether PerDay Salary uses the real days of the month or 30'],
      ['Extra Work rate', 'Settings > Payslip Settings', 'How many days\' pay one Extra Work day gives'],
      ['EL payout (every N months)', 'Settings > Payslip Settings', 'The company-wide EL encashment interval; an employee\'s own EL Frequency (in the salary structure) overrides it'],
      ['EL Frequencies', 'Settings > Payslip Settings', 'The list of EL frequencies (Monthly, Quarterly, Half Yearly, Yearly ...)'],
      ['Automatic draft payslips', 'Settings > Payslip Settings', 'On or off, and on which day of the month the drafts are made'],
      ['Names and signatures on the payslip', 'Settings > Payslip Settings', 'Prepared By and Authorised By'],
      ['Weekly off days', 'Settings > Attendance Settings', 'Which days are weekly offs'],
      ['Half-day hours', 'Settings > Attendance Settings', 'Hours below which a present day becomes a Half Day'],
      ['CL days (month, year), Sandwich leave', 'Settings > Attendance Settings', 'How CL and sandwich leave work'],
      ['Holidays', 'Settings > Holiday Calendar', 'Which days are holidays (paid)'],
      ['Attendance statuses', 'Settings > Status Master', 'What each status counts as, and the TeamOffice codes'],
      ['Statutory deductions', 'Payroll > Statutory Deductions', 'PF, ESI, TDS ... and their rates'],
      ['Company name, logo, address', 'Settings > Company Settings', 'Printed on payslips and letters'],
    ]} />) },

  { id: 'status', title: '6. How each attendance status counts', body: (
    <>
      <P>The values below are what the program starts with. They live in Settings &rarr; Status Master and can be changed there.</P>
      <Table head={['Status', 'Meaning', 'In salary']} widths={['14%', '46%', '40%']} rows={[
        ['P', 'Present', 'Paid'],
        ['A', 'Absent', 'Unpaid (the day is cut)'],
        ['HD', 'Half Day', 'Half the day is unpaid'],
        ['WO', 'Week Off', 'Paid. A punch on it becomes Extra Work'],
        ['HOL', 'Holiday', 'Paid. A punch on it becomes Extra Work'],
        ['WFH', 'Work From Home (approved)', 'Paid'],
        ['EW', 'Extra Work (worked on a week off or holiday)', 'Paid, plus Extra Work Pay, and earns 1 EL day'],
        ['CL / CL/2', 'Casual Leave / half Casual Leave', 'Paid'],
        ['UPL', 'Unpaid Leave', 'Unpaid (the day is cut)'],
      ]} />
    </>) },

  { id: 'howto', title: '7. How to do it (step by step)', body: (
    <>
      <h4 style={{ margin: '10px 0 2px' }}>Give an employee a salary</h4>
      <Steps items={['Payroll > Salary Structures > New Salary Structure.', 'Pick the employee, type the Salary and press "Apply split" (or fill each part by hand).', 'Choose the EL frequency and the statutory deductions that apply, then Save.']} />
      <h4 style={{ margin: '10px 0 2px' }}>Change a salary (appraisal, promotion)</h4>
      <Steps items={['Payroll > Salary Structures > the pencil of that employee.', 'Change the amounts. At the bottom set "Change applies from", the reason and a note, then Save.', 'The change is in Payroll > Salary Revisions. Months before the date keep the old pay.']} />
      <h4 style={{ margin: '10px 0 2px' }}>Close a month</h4>
      <Steps items={[
        'Payroll > Salary Sheet: pick the month and press "Refresh now" so the attendance is up to date.',
        'Check the unpaid days. Fix a wrong day in Attendance > Daily Records (or approve the pending leave), then come back.',
        'Type Variable Pay, Incentive, EL days or Extra Work days where needed (a changed value turns green; the arrow resets it).',
        'Payroll > Generate Payslips (or wait for the automatic drafts) to make the drafts.',
        'Payroll > Payslip History: open a few payslips, then "Approve & email all drafts".',
      ]} />
      <h4 style={{ margin: '10px 0 2px' }}>Send a payslip again, or change its mail</h4>
      <Steps items={['Payroll > Payslip History > the mail button of the payslip.', 'Read and edit the subject and the text in the window. The PDF is attached by itself.', 'Press Send. The standard text can be changed in Settings > Templates (a template named "Payslip").']} />
      <h4 style={{ margin: '10px 0 2px' }}>Add PF, ESI, TDS or another deduction</h4>
      <Steps items={['Payroll > Statutory Deductions.', 'Open the rule (or Add a rule), fill the rates and limits, tick ON and Save.', 'It shows in the next Salary Sheet and on the payslips. Leave one employee out by unticking it on their salary structure.']} />
      <h4 style={{ margin: '10px 0 2px' }}>Pay an employee who is leaving</h4>
      <Steps items={['Employee Services > Exit & Full and Final > Start an exit.', 'Tick the checklist and check the suggested settlement lines; add your own lines (advance, bonus ...).', 'Mark the settlement done, open the PDF statement, then Complete the exit.']} />
    </>) },

  { id: 'faq', title: '8. If something looks wrong', body: (
    <Table head={['What you see', 'Why, and what to do']} widths={['34%', '66%']} rows={[
      ['An employee is missing from the Salary Sheet', 'There is no salary structure for them, or their status is not a working status (Settings > Status Master). Add the structure or fix the status.'],
      ['Many unpaid days', 'TeamOffice shows no punch. Check Daily Records. A leave that is not approved yet is still unpaid. A day can be marked by hand (Holiday, WFH, CL ...).'],
      ['A raised salary does not show in an old month', 'By design: an old month uses the pay that was valid then. Check the date in Salary Revisions.'],
      ['CL Used is always 0', 'The days must carry the CL status (it comes from approved leave, a TeamOffice "CL", or by hand). See Status Master.'],
      ['EL Earned is 0', 'EL comes only from Extra Work days (a punch on a weekly off or holiday).'],
      ['A statutory deduction is 0', 'The rule is OFF, the salary is above its limit, the employee is left out on the salary structure, or a rate is still 0.'],
      ['The employee cannot see the payslip', 'It is still a draft. Approve it in Payslip History.'],
      ['The payslip mail did not arrive', 'The employee\'s email on the profile may be a made-up one (@placeholder.local, nothing is sent to it). Fix it in Edit Employee. Also look in the spam folder.'],
      ['A figure on the Salary Sheet and the payslip differ', 'A payslip keeps the numbers of the day it was made. Delete the draft and make it again after the sheet is right.'],
    ]} />) },
];

export default function PayrollGuide() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => Object.fromEntries(SECTIONS.map((s, i) => [s.id, i < 2])));
  const text = useMemo(() => Object.fromEntries(SECTIONS.map(s => [s.id, (s.title + ' ' + JSON.stringify(s.body, (k, v) => (k.startsWith('_') ? undefined : v))).toLowerCase()])), []);
  const shown = SECTIONS.filter(s => !q.trim() || text[s.id].includes(q.trim().toLowerCase()));
  const isOpen = (id) => !!q.trim() || open[id];

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Payroll Guide</h1>
          <p>Where each thing is done, how a salary is worked out, which setting decides what, and how to do each job step by step.</p>
        </div>
        <div className="ph-actions"><Link to="/payroll/salary-sheet" className="btn-p">Open the Salary Sheet</Link></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the guide (for example: EL, sandwich, PF, unpaid)..." style={{ flex: '1 1 280px', maxWidth: 420, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', outline: 'none', fontFamily: 'inherit' }} />
        {!q.trim() && <button className="btn-o" onClick={() => setOpen(Object.fromEntries(SECTIONS.map(s => [s.id, true])))}>Open all</button>}
        {!q.trim() && <button className="btn-o" onClick={() => setOpen(Object.fromEntries(SECTIONS.map(s => [s.id, false])))}>Close all</button>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {SECTIONS.map(s => <a key={s.id} href={`#guide-${s.id}`} onClick={() => setOpen(o => ({ ...o, [s.id]: true }))} style={{ fontSize: '.76rem', color: 'var(--brand)', background: 'var(--brand-soft)', borderRadius: 20, padding: '3px 12px', textDecoration: 'none', fontWeight: 600 }}>{s.title.replace(/^\d+\.\s*/, '')}</a>)}
      </div>
      {shown.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Nothing in the guide matches "{q}".</div>}
      {shown.map(s => (
        <div key={s.id} id={`guide-${s.id}`} style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
          <button onClick={() => setOpen(o => ({ ...o, [s.id]: !o[s.id] }))} style={{ width: '100%', textAlign: 'left', background: '#f8fafc', border: 'none', padding: '11px 16px', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontFamily: 'inherit' }}>
            <span>{s.title}</span><span style={{ color: '#94a3b8' }}>{isOpen(s.id) ? '−' : '+'}</span>
          </button>
          {isOpen(s.id) && <div style={{ padding: '6px 16px 14px' }}>{s.body}</div>}
        </div>
      ))}
    </div>
  );
}
