// @ts-nocheck
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from '@/lib/ui-motion';

// Top-bar search (Ctrl/Cmd+K focuses it): app pages plus live results for employees, candidates and
// departments from /api/search (only what the signed-in user may view). Opening a result still goes
// through the normal route guards.
const PAGES = [
  ['Dashboard', '/dashboard', 'home overview'],
  ['Manage Employees', '/employees/manage', 'employee staff people list'],
  ['Pending Approvals', '/employees/pending', 'employee approve pending'],
  ['Document Approvals', '/document-approvals', 'documents approve'],
  ['Invite Employee', '/employees/invite', 'invite onboarding'],
  ['Employee Credentials', '/employee-credentials', 'login password'],
  ['Candidate Pool', '/candidates/data', 'recruitment candidates interview'],
  ['Add Candidate', '/candidates/add', 'recruitment candidate new'],
  ['Org Chart', '/org-chart', 'organization hierarchy'],
  ['Reporting Structure', '/reporting-structure', 'manager reporting'],
  ['Daily Attendance', '/attendance/daily', 'attendance punch check in'],
  ['Attendance Result', '/attendance/result', 'attendance summary'],
  ['Update Attendance', '/attendance/update', 'attendance edit'],
  ['Attendance Corrections', '/attendance/corrections', 'attendance regularization missed punch correction'],
  ['Upload Attendance', '/attendance/upload', 'attendance import excel'],
  ['Leave Management', '/leave/manage', 'leave requests'],
  ['Audit Log', '/audit-log', 'who changed what history log'],
  ['Backup & Export', '/backup', 'backup download database export restore'],
  ['Asset Types', '/masters/asset-types', 'asset type master laptop id card'],
  ['Leave Types', '/masters/leave-types', 'master leave type annual sick casual'],
  ['Template Categories', '/masters/template-categories', 'master email template category leave interview'],
  ['My Mail', '/mail', 'mail inbox sent email compose webmail'],
  ['Assets', '/assets', 'laptop id card equipment asset assigned'],
  ['Reports', '/reports', 'report export excel pdf attendance leave headcount attrition'],
  ['WFH Management', '/wfh/manage', 'work from home'],
  ['Salary Structures', '/payroll/salary-structures', 'payroll ctc salary split'],
  ['Salary Sheet', '/payroll/salary-sheet', 'payroll salary month'],
  ['Generate Payslips', '/payroll/generate', 'payroll payslip'],
  ['Payslip History', '/payroll/history', 'payroll payslip'],
  ['Departments', '/masters/departments', 'master department'],
  ['Designations', '/masters/designations', 'master designation'],
  ['Email Log', '/email-log', 'communication email'],
  ['Drafts', '/drafts', 'communication email draft'],
  ['Notifications', '/notifications', 'alerts'],
  ['Company Settings', '/settings/company', 'settings company'],
  ['Status Master', '/settings/status-master', 'settings status'],
  ['Holidays', '/settings/holidays', 'settings holiday calendar'],
  ['My Profile', '/profile', 'account profile'],
  ['Change Password', '/change-password', 'account password'],
];

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const [remote, setRemote] = useState({ employees: [], candidates: [], departments: [] });
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRemote({ employees: [], candidates: [], departments: [] }); setBusy(false); return; }
    const my = ++seq.current;
    setBusy(true);
    const id = setTimeout(() => {
      fetch('/api/search?q=' + encodeURIComponent(t), { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } })
        .then(r => r.json())
        .then(d => { if (my === seq.current) setRemote({ employees: d.employees || [], candidates: d.candidates || [], departments: d.departments || [] }); })
        .catch(() => {})
        .finally(() => { if (my === seq.current) setBusy(false); });
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  // one flat, keyboard-navigable list: [group, label, sub, path]
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pages = (t ? PAGES.filter(([label, , kw]) => (label + ' ' + kw).toLowerCase().includes(t)) : PAGES).slice(0, t ? 5 : 6)
      .map(([label, path]) => ['Pages', label, path, path]);
    const emps = remote.employees.map(e => ['Employees', e.full_name, [e.emp_code, e.designation].filter(Boolean).join(' · ') || e.email_id, '/employees/detail/' + e.id]);
    const cands = remote.candidates.map(c => ['Candidates', c.candidate_name, c.email_id || c.contact_number || '', '/candidates/view/' + c.id]);
    const deps = remote.departments.map(d => ['Departments', d.name, 'Department', '/masters/departments']);
    return [...emps, ...cands, ...deps, ...pages];
  }, [q, remote]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current && inputRef.current.focus(); setOpen(true); } };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key); };
  }, []);

  const go = (path) => { setOpen(false); setQ(''); inputRef.current && inputRef.current.blur(); navigate(path); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); go(results[hi][3]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current && inputRef.current.blur(); }
  };

  return (
    <div className="gs-wrap" ref={ref}>
      <svg className="gs-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input
        ref={inputRef} className="gs-input" placeholder="Search employees, candidates, pages…" value={q} aria-label="Search"
        onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
      />
      <kbd className="gs-kbd">Ctrl K</kbd>
      <Menu open={open && q.trim().length > 0} className="gs-menu">
        {results.length === 0 ? <div className="gs-empty">{busy ? 'Searching…' : 'No matching result'}</div> : results.map(([group, label, sub, path], i) => (
          <div key={group + path + i}>
            {(i === 0 || results[i - 1][0] !== group) && <div className="gs-grp">{group}</div>}
            <button className={`gs-item${i === hi ? ' on' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => go(path)}>
              <span>{label}</span><small>{sub}</small>
            </button>
          </div>
        ))}
        {busy && results.length > 0 && <div className="gs-empty" style={{ padding: 6 }}>Searching…</div>}
      </Menu>
    </div>
  );
}
