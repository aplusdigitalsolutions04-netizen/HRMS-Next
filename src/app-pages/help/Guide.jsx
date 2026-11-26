import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SECTIONS as PAYROLL, Table, Steps, P, Note, Shot } from '../payroll/PayrollGuide';

// The guide of the whole HRMS: what every page is for, how the main jobs are done step by step, where each setting is, and how a salary
// is worked out. HR and admins see all of it; an employee sees the guide of the employee portal. It describes the program only: every
// number it mentions (days, percentages, limits) is a setting, and the guide says where it is set.

const H = ({ children }) => <h4 style={{ margin: '12px 0 2px', fontSize: '.9rem' }}>{children}</h4>;
const LIST = { margin: '4px 0 10px 20px', fontSize: '.86rem', lineHeight: 1.8 };
// the picture(s) shown at the top of a section: [file in public/guide, caption]. The names and amounts in them are blurred.
const SHOTS = {
  'start': [['dashboard', 'The Dashboard: what needs attention today']],
  'roles': [['users', 'Settings > Users & Access']],
  'emp-join': [['invite', 'Employees > Invite an employee'], ['pending', 'Employees > Pending approval']],
  'emp-manage': [['employees', 'Employee Management']],
  'emp-org': [['org', 'Org Chart']],
  'recruit': [['recruit', 'Recruitment > Candidates']],
  'att': [['attendance', 'Attendance > Daily records']],
  'leave': [['leave', 'Leave Management']],
  'docs': [['docs-expiry', 'Document Expiry']],
  'helpdesk': [['helpdesk', 'Help Desk > Manage']],
  'exit': [['exits', 'Exit & Full and Final']],
  'assets': [['assets', 'Assets']],
  'mail': [['email-log', 'Communications > Email log']],
  'reports': [['reports', 'Reports']],
  'settings': [['settings', 'Settings']],
  'masters': [['masters', 'Masters: the lists used in forms']],
  'adminTools': [['audit', 'Audit Log']],
  'pay-flow': [['pay-structures', 'Payroll > Salary Structures'], ['pay-sheet', 'Payroll > Salary Sheet']],
  'pay-pages': [['pay-generate', 'Payroll > Generate Payslips'], ['pay-history', 'Payroll > Payslip History'], ['pay-statutory', 'Payroll > Statutory Deductions']],
  'pay-howto': [['pay-generate', 'Payroll > Generate Payslips']],
};
const L = ({ to, children }) => <Link to={to} style={{ color: 'var(--brand)', fontWeight: 600 }}>{children}</Link>;

const START = [
  { id: 'start', title: 'What the HRMS is and how to find your way', body: (
    <>
      <P>The HRMS holds the whole life of an employee in one place: recruitment, joining, documents, attendance, leave, salary, payslips, letters and leaving. HR works from the <b>sidebar on the left</b>; employees work from their own <b>portal</b>.</P>
      <Table head={['Sidebar section', 'What is in it']} widths={['26%', '74%']} rows={[
        ['Main', 'Dashboard: what needs attention today, birthdays, anniversaries, holidays, hiring pipeline, leave trends, recent activity.'],
        ['People', 'Employee Management (employees, approvals, credentials, directory, org chart, reporting structure) and Recruitment (candidates).'],
        ['Time & Leave', 'Attendance (daily records, summary, corrections, uploads) and Leave & WFH (approvals).'],
        ['Payroll', 'Salary Structures, Salary Sheet, Statutory Deductions, Salary Revisions, Generate Payslips, Payslip History.'],
        ['Employee Services', 'Documents (approvals, expiry), Letters, Help Desk, Exit & Full and Final, Assets.'],
        ['Insights & Communication', 'Reports, Communications (email log, drafts) and My Mail.'],
        ['Admin', 'Masters (the lists used in forms) and Administration (audit log, backup, API logs).'],
      ]} />
      <Note tone="var(--brand-soft)" border="var(--brand-line)">The <b>search box at the top</b> (Ctrl K) opens any page by name. The <b>gear</b> opens Settings. The <b>bell</b> shows what needs you; each person can switch groups of notifications off in Preferences.</Note>
    </>) },
  { id: 'roles', title: 'Who can do what (roles and permissions)', body: (
    <>
      <Table head={['Role', 'What they can do']} widths={['20%', '80%']} rows={[
        ['ADMIN', 'Everything, including Backup & Export, API Logs, the Google Drive folder tool and changing any password.'],
        ['HR', 'All HR work: employees, attendance, leave, payroll, letters, settings (except the admin-only tools).'],
        ['HR staff', 'Only the pages their permissions allow. A link that is not allowed is not shown in the sidebar.'],
        ['Employee', 'Their own portal only. They can never see another person\'s salary, bank details or documents.'],
      ]} />
      <P>Permissions are given in <b>Settings &rarr; Users &amp; Access</b>: <i>User Management</i> (who has a login) and <i>Roles &amp; Permissions</i> (what each role may do). Every important change is recorded in the Audit Log with who did it and when.</P>
    </>) },
  { id: 'rules', title: 'Rules that hold everywhere', body: (
    <ul style={{ margin: '6px 0 6px 20px', fontSize: '.86rem', lineHeight: 1.8 }}>
      <li>A day of attendance that HR changed <b>by hand</b> (or that came from an approved leave or WFH) is never changed back by the TeamOffice sync.</li>
      <li>A <b>draft payslip</b> is invisible to the employee until HR approves it.</li>
      <li>Files (documents, letters, payslip copies) are kept on <b>Google Drive</b>; the program shows them but does not keep them on the server.</li>
      <li>An error message never shows technical details: it gives a plain sentence and sometimes a <b>reference number</b>. Admin can look the reference up in <b>API Logs</b>.</li>
      <li>Rates, days and limits are <b>settings</b>, not part of the program. Where something is set is written in the guide.</li>
    </ul>) },
];

const PEOPLE = [
  { id: 'emp-join', title: 'Employees: from invite to active', body: (
    <>
      <Steps items={[
        <><L to="/employees/invite">Invite Employee</L>: HR creates the login. The employee gets a mail with a temporary password (Employee Credentials keeps it, in an encrypted form, until they choose their own).</>,
        'The employee signs in, chooses a new password and fills their profile and documents (works on a phone; a file that fails to send is tried again).',
        <>The profile lands in <L to="/employees/pending">Pending Approvals</L>. HR checks it and either <b>approves</b> (with or without an activation mail) or <b>sends it back for correction</b> with a note.</>,
        'After approval the status is Active and the employee uses the whole portal.',
      ]} />
      <P>Statuses (invited, pending, needs correction, active, dropped) and what each one allows (log in, counted in payroll, shown in attendance) are set in <b>Settings &rarr; Status Master</b>.</P>
      <Note>Someone who was only invited and never finished can be reminded with <b>Invite Reminder</b> in Manage Employees.</Note>
    </>) },
  { id: 'emp-manage', title: 'Manage Employees: profile, documents, bank, ID', body: (
    <>
      <Table head={['Job', 'How']} widths={['28%', '72%']} rows={[
        ['See or change a profile', 'Manage Employees > open the employee (or the pencil for Edit). Name, contacts, job, manager, status and so on.'],
        ['Change the Employee ID', 'Edit Employee > the ID field. It is changed together in attendance, payslips, salary structure and every other place, so nothing is left behind. TeamOffice has to carry the same ID.'],
        ['Documents', 'Open the employee > Documents tab: upload or replace a file for them, tick which documents are compulsory, give permission to upload again, and set <Valid till> dates.'],
        ['Bank details', 'Open the employee > Bank Details. The employee sees their own bank and contact details but can change them only once, after you press "Allow employee to edit".'],
        ['Remove / bring back', 'Removed employees can be restored from Manage Employees (Restore).'],
        ['Many at once', 'Import (from the Excel template) and Export are in Manage Employees.'],
        ['Passwords', <><L to="/employee-credentials">Employee Credentials</L>: set any employee\'s password (typed or made by the system), mail it, or see it with the eye button (recorded in the Audit Log). One row for each employee.</>],
      ]} />
    </>) },
  { id: 'emp-org', title: 'Org Chart, Reporting Structure, Directory', body: (
    <>
      <P><L to="/reporting-structure">Reporting Structure</L> gives each employee a <b>reporting manager</b>. This matters: leave, WFH and attendance corrections go to the manager first and then to HR; with no manager they go straight to HR. <L to="/org-chart">Org Chart</L> draws the same structure. The <L to="/directory">Directory</L> lists colleagues with their work email and phone, and the birthdays and work anniversaries of the month (only the day and month of a birthday, never the year; nothing personal is shown).</P>
    </>) },
  { id: 'recruit', title: 'Recruitment', body: (
    <>
      <Steps items={[
        <><L to="/candidates/data">Candidate Pool</L>: add candidates (Add Candidate), keep their resume, status and interview rounds. Open a candidate to schedule a round (mode, date, platform) and mail them from an email template (there is a mail preview).</>,
        <>A candidate who does not answer is moved to <L to="/candidates/no-response">No Response</L>; when they answer press <b>Responded</b> and they return to the pool.</>,
        'Mails sent are in Communications > Email Log; unfinished mails are in Draft Emails.',
      ]} />
      <P>Defaults for interviews (length, platform, reminder time) are in <b>Settings &rarr; Interview Settings</b>.</P>
    </>) },
];

const TIME = [
  { id: 'att', title: 'Attendance', body: (
    <>
      <P>Punches come from <b>TeamOffice</b> by themselves every few minutes; the server also refreshes the whole month. Nobody has to press anything, but <b>Refresh now</b> on the Salary Sheet and Daily Records forces it.</P>
      <Table head={['Page', 'Use it to']} widths={['28%', '72%']} rows={[
        [<L to="/attendance/daily">Daily Records</L>, 'See every employee for every day of the month; open a day and change the status or times (that day is then protected from the sync).'],
        [<L to="/attendance/result">Attendance Summary</L>, 'Month totals for each employee, and verify them.'],
        [<L to="/attendance/corrections">Corrections</L>, 'Missed-punch and late-coming requests from employees (manager first, then HR). Approving a missed punch fixes that day at once.'],
        [<L to="/attendance/upload">Upload Attendance</L> , 'Load an attendance file when TeamOffice is not used. Templates hold the file layouts.'],
      ]} />
      <P>Rules: the weekly-off days, the half-day hours and the TeamOffice auto-sync are in <b>Settings &rarr; Attendance Settings</b>; holidays in <b>Holiday Calendar</b>; what each status (P, A, HD, WO, HOL, WFH, EW, CL, UPL) counts as in <b>Status Master</b>. A punch on a weekly off or holiday becomes <b>Extra Work</b>; nobody in on a holiday is <b>Holiday</b>.</P>
    </>) },
  { id: 'leave', title: 'Leave and Work From Home', body: (
    <>
      <Steps items={[
        'The employee applies in the portal (Leave Requests or Work From Home); a leave can carry a supporting document.',
        'It goes to the reporting manager first, then to HR; with no manager, straight to HR. Each step sends a mail and a bell alert. Either one can reject with a reason.',
        <>After the last approval the days go into attendance: <b>CL</b> first (the days a month are set in Attendance Settings), the rest <b>UPL</b> (unpaid); a long leave also takes the weekly offs and holidays inside it (<b>sandwich leave</b>, can be switched off); an approved WFH makes the days <b>WFH</b> (paid).</>,
      ]} />
      <P>HR works from <L to="/leave/manage">Leave Management</L> and <L to="/wfh/manage">WFH Management</L>. The list of leave types is in <b>Masters &rarr; Leave Types</b>; the wording of the mails in <b>Settings &rarr; Request Mails</b>. Only a leave that is still pending can be cancelled by the employee.</P>
    </>) },
];

const SERVICES = [
  { id: 'docs', title: 'Documents and Document Expiry', body: (
    <>
      <P>Employees upload their papers in their portal (Documents) or HR uploads for them. A new upload waits in <L to="/document-approvals">Document Approvals</L> until HR approves it. Once a document is in, the employee cannot upload it again unless HR gives permission.</P>
      <P><b>Valid till</b> dates (Employee profile &gt; Documents) feed <L to="/documents/expiry">Document Expiry</L>: the employee and HR are reminded 30 days before, 7 days before and on the day a document expires, once each. The page lists what is expired or due soon and can send the due reminders at once.</P>
    </>) },
  { id: 'letters', title: 'Letters', body: (
    <>
      <H>1. Make a letter</H>
      <Shot src="/guide/letters-make.jpg" alt="Make a letter page" caption="Letters > Make a Letter" />
      <Steps items={[
        <><L to="/letters/make">Letters &gt; Make a Letter</L>: pick the employee and the letter (offer, appointment, confirmation, experience, relieving).</>,
        'Give the dates the letter needs. The reference number and the letter date are optional: leave them empty and the letter is printed without them.',
        'Offer, appointment and appraisal letters also ask for the salary components (see Salary components below). Other letters do not ask.',
        'Press "Prepare the letter". The details of the employee are filled in and a list shows any detail still empty.',
        'Read the text. You can change it here (same editor as Letter Texts); a change here is for this one letter only.',
        'Press "Preview the PDF" to see how it will print, then "Make the PDF". It has the header and the authorised signature, and it is saved.',
        'The employee sees it in My Letters and gets a bell alert.',
      ]} />
      <H>2. Letter Texts: write a letter like a Word document</H>
      <Shot src="/guide/letter-texts.jpg" alt="Letter texts cards" caption="Letters > Letter Texts: a card for each letter" />
      <ul style={LIST}>
        <li>The page opens with a card for each letter and <b>+ Add a letter</b> (give it a name and write it).</li>
        <li>Click a card: the letter opens on its own page with <b>Edit</b> and <b>Preview</b>.</li>
        <li><b>Preview</b> shows the real PDF pages (letterhead and page breaks) with a sample salary, so you can see what goes on which page.</li>
        <li><b>Save</b>: the text is used for every letter made from now on. Letters already made are not changed.</li>
        <li><b>Standard text</b> brings back the ready-made wording. <b>Remove</b> deletes a letter you added.</li>
        <li>If you leave with unsaved changes it asks first.</li>
        <li>An old letter (written with marks like ** or [line]) opens converted and is saved in the new style the first time you save.</li>
        <li>Letters are made for existing employees only.</li>
      </ul>
      <Shot src="/guide/letter-editor.jpg" alt="The letter editor" caption="The editor: tools on top, the words on the right" />
      <ul style={LIST}>
        <li><b>Text:</b> Normal and Heading 1 to 3; font (Calibri, Arial, Times New Roman, Courier New) and size; bold, italic, underline, strikethrough; text colour and highlight.</li>
        <li><b>Paragraph:</b> left, centre, right, justified; bullet and numbered lists; indent and outdent; clear formatting; undo and redo.</li>
        <li><b>Table:</b> pick the size from a grid. With the cursor in a table a second bar adds or deletes a row or column, merges or splits cells, makes a heading row, colours a cell, or deletes the table.</li>
        <li><b>Picture:</b> a PNG or JPG (made smaller by itself); a box sets its width.</li>
        <li><b>Line</b> draws a rule. <b>Add page</b> (INSERT row, or Ctrl+Enter) starts a new page where the cursor is (for an Annexure), and <b>+ Add page</b> under the sheet adds an empty page at the end; a dashed line shows where the new page starts, and the grey bands show about where each page ends (Preview shows the exact pages). <b>Signature</b> puts the authorised person's signature there (if there is none, it is added at the end).</li>
        <li><b>Words</b> on the right: click one to put it in the text. Words such as {'{{name}}'} or {'{{designation}}'} are shown in colour and are replaced by the employee's details when a letter is made.</li>
        <li>The notice period, probation and working hours are words set in <L to="/letters/words">Letter Words</L>; the HR contact is typed when the letter is made.</li>
      </ul>
      <H>3. The salary table (Annexure I)</H>
      <Shot src="/guide/salary-table.jpg" alt="Salary table in the editor" caption="Name and Designation above the salary table" />
      <ul style={LIST}>
        <li>In Letter Texts press <b>Salary table (calculated)</b> where the table should come. The editor shows a sample; each letter gets the components of that employee.</li>
        <li>Name and Designation above it are the words {'{{name}}'} and {'{{designation}}'}. They come from the employee's profile (Employees &gt; Edit).</li>
        <li>The Grand Total is the sum of the components; the yearly amount is the monthly amount x 12.</li>
      </ul>
      <H>4. Adding a salary table to a letter (Make a Letter)</H>
      <Shot src="/guide/salary-components.jpg" alt="Salary components in Make a letter" caption="Make a Letter > Add a salary table to this letter" />
      <Steps items={[
        'In Make a Letter pick the employee and the letter. Under the dates there is a tick box "Add a salary table to this letter". It is already ticked for a letter whose text has a salary table (offer, appointment, appraisal); tick it for any other letter that should carry one.',
        'When it is ticked, the "Salary components (monthly)" block opens. Untick it and the letter is made without a table.',
        'The components start from the salary structure of the employee (Payroll > Salary Structures): Basic, HRA, Travel Allowance, Food Voucher and custom earnings. If there is none, the usual names are there with empty amounts.',
        'Fill the data. Every employee has a different salary, so give each component a monthly Amount, or a Percent of the "Monthly salary (total)" typed above it. A component with neither is left out.',
        '+ Add a component adds a row (for example Variable Pay or Medical Allowance); Remove takes one out; a name can be changed. The Monthly total and Yearly are shown under the rows.',
        'Press "Prepare the letter". If the text of the letter has a salary table in it (the Salary table block), it is filled with these figures at that place.',
        'If the text has no salary table, put the filled one in yourself: click in the letter text where it should go and press "Salary table (from the components)" in the editor bar (Insert row). It becomes a real table that can be edited like any other.',
        'Read the letter, press "Preview the PDF", then "Make the PDF". A letter that is already made is not changed.',
      ]} />
      <ul style={LIST}>
        <li>The table: each component with its monthly and yearly amount (monthly x 12), and a Grand Total that is the sum of the components.</li>
        <li>A letter text gets its table place once in Letter Texts (Salary table (calculated)); after that it is filled for every employee.</li>
      </ul>
      <H>5. The other Letters pages</H>
      <Shot src="/guide/letters-made.jpg" alt="Letters Made" caption="Letters > Letters Made" />
      <Shot src="/guide/letter-words.jpg" alt="Letter Words" caption="Letters > Letter Words" />
      <Shot src="/guide/letterhead.jpg" alt="Letterhead" caption="Letters > Letterhead" />
      <ul style={LIST}>
        <li><L to="/letters/made">Letters Made</L>: open the PDF, email it, edit the reference number, date or text, or delete a letter.</li>
        <li><L to="/letters/words">Letter Words</L>: the words filled in for each employee.</li>
        <li><L to="/letters/letterhead">Letterhead</L>: the company header, your own letterhead picture, or none for printed paper. The same header is used on the Full and Final statement of <L to="/exits">Exit &amp; Full and Final</L>.</li>
      </ul>
    </>) },
  { id: 'helpdesk', title: 'Help Desk', body: (
    <P>An employee asks HR a question in <b>Help Desk</b> (portal) and gets a ticket number such as HD-0001. HR sees every ticket in <L to="/helpdesk/manage">Help Desk</L>, answers it (the employee is told in the portal and by mail), and sets the status: Open, In Progress, Resolved, Closed. "Take this ticket" shows who is on it. A reply from the employee opens a resolved ticket again. The <b>Email alerts</b> tick on the page switches the mails on or off.</P>) },
  { id: 'exit', title: 'Exit and Full and Final', body: (
    <>
      <Steps items={[
        <><L to="/exits">Exit &amp; Full and Final</L> &gt; Start an exit: employee, resignation date, last working day, reason, notice period.</>,
        'Tick the checklist as each step is done (handover, assets back, access removed, exit interview ...).',
        'Check the settlement: the last month\'s salary, EL balance and notice shortfall are suggested; add your own lines (advance, bonus ...). The statement can be opened as a PDF.',
        'Mark the settlement done (amounts lock), then Complete the exit: the employee becomes Dropped and can no longer sign in.',
      ]} />
      <P>The notice period, the EL rate and whether a notice shortfall is recovered are set at the top of the page (Settlement settings). Make the relieving and experience letters from Letters.</P>
    </>) },
  { id: 'assets', title: 'Assets', body: (
    <P><L to="/assets">Assets</L> records laptops, ID cards and other company items: who has each one, since when and when it came back. Add an asset, assign it to an employee (they get a bell alert) and mark it returned. The kinds of asset are in <b>Masters &rarr; Asset Types</b>.</P>) },
];

const COMMS = [
  { id: 'mail', title: 'Mail, templates and notifications', body: (
    <Table head={['Thing', 'What it is']} widths={['28%', '72%']} rows={[
      ['My Mail', 'A webmail inside the HRMS for your own mailbox (connect your account once). Mails you send from the HRMS go through your account if it is connected, otherwise through the company SMTP.'],
      ['Email Log', 'Every mail the HRMS sent, with its status; a failed one can be sent again.'],
      ['Draft Emails', 'Mails that were prepared and not sent yet.'],
      ['Email Templates', 'The wording of recurring mails (Settings > Email Templates). Words in double braces, such as {{name}}, are filled in. A template named "Payslip" is used for payslip mails.'],
      ['Request Mails', 'The mails sent for leave, WFH, missed punch and late coming (Settings > Request Mails).'],
      ['SMTP Settings', 'The company mailbox the HRMS sends from. A made-up address such as @placeholder.local is never mailed.'],
      ['Notifications', 'The bell and the Notifications page. Each person can switch groups off in Preferences; Settings > Notification Settings holds the company-wide options.'],
    ]} />) },
  { id: 'reports', title: 'Reports and the Dashboard', body: (
    <>
      <P><L to="/reports">Reports</L>: pick a report (Attendance, Leave, Headcount, Attrition) and the dates, read it on the screen, then download it as Excel or PDF. The Salary Sheet has its own Excel export.</P>
      <P>The <L to="/dashboard">Dashboard</L> shows what needs your attention, who is out of office today, new hires, upcoming birthdays, anniversaries, holidays and interviews, the hiring pipeline, leave trends and recent activity. Each person can hide widgets in Preferences.</P>
    </>) },
];

const ADMIN = [
  { id: 'settings', title: 'Settings: where each thing is', body: (
    <Table head={['Settings section', 'What is in it']} widths={['30%', '70%']} rows={[
      ['My Account, Notifications', 'Your own profile, password, preferences (language, notification groups, dashboard widgets).'],
      ['General > Company Settings', 'Company name, logo, address and email: printed on payslips and letters.'],
      ['General > SMTP Settings', 'The company mailbox.'],
      ['General > Google Drive', 'Connect Google Drive (where documents, letters and payslip copies are kept). A tool finds and merges duplicate employee folders.'],
      ['Recruitment > Interview Settings', 'Default interview length, platform and reminder time.'],
      ['Attendance & Leave > Attendance Settings', 'Weekly offs, half-day hours, TeamOffice connection and auto-sync, CL days, sandwich leave.'],
      ['Attendance & Leave > Holiday Calendar', 'The holidays.'],
      ['Attendance & Leave > Status Master', 'Every employee and attendance status and how it counts.'],
      ['Payroll > Payslip Settings', 'Month days, Extra Work rate, EL frequencies, automatic draft payslips, signatories.'],
      ['Users & Access', 'User Management (HR logins) and Roles & Permissions.'],
      ['Communication', 'Notification Settings, Communication Settings, Email Templates, Request Mails.'],
    ]} />) },
  { id: 'masters', title: 'Masters: the lists used in forms', body: (
    <P>Under <b>Admin &rarr; Masters</b>: Departments, Designations, Asset Types, Leave Types, Template Categories and Request Types. Adding to a list makes it appear in the forms that use it; a value already used can be switched off instead of deleted. The EL frequencies (Monthly, Quarterly ...) are in Payslip Settings and the statutory deductions in Payroll.</P>) },
  { id: 'adminTools', title: 'Administration: audit, backup, API logs', body: (
    <Table head={['Page', 'Use it to']} widths={['26%', '74%']} rows={[
      ['Audit Log', 'See who changed what and when (salary, attendance, employee status, passwords, letters, exits, settings ...), with filters by person, action and date.'],
      ['Backup & Export (ADMIN)', 'Download a copy of the data. Do this before a big change or a new release.'],
      ['API Logs (ADMIN)', 'Every call the program made to the server with its result and time, and the real reason of every error. Search by a reference number given in an error message. It also sets how many days the logs are kept and can delete old entries.'],
    ]} />) },
];

const EMPLOYEE = [
  { id: 'portal', title: 'Your portal: what each page is for', body: (
    <Table head={['Page', 'What you can do']} widths={['26%', '74%']} rows={[
      ['Dashboard', 'Your attendance of the month, leave balance, holidays, birthdays and announcements.'],
      ['Attendance', 'Your days, punch history and insights. If a punch is missing or you came late, send a correction request from there.'],
      ['Leave Requests', 'Apply for leave (with a document if needed), follow the approval, cancel a pending request. If you are a manager, approve your team\'s requests here.'],
      ['Work From Home', 'Apply for WFH and follow it. An approved WFH counts as a paid working day.'],
      ['My Payslips', 'Open or download your payslips. A payslip appears after HR approves it (you also get a mail).'],
      ['Documents', 'See your documents. An upload button appears when HR allows you to upload one. A tag shows when a document is about to expire.'],
      ['My Letters', 'Letters HR has issued to you (offer, appointment, experience, relieving ...), to open as a PDF.'],
      ['Help Desk', 'Ask HR a question, follow the answer, reply, and close the ticket when done.'],
      ['Directory', 'Colleagues, their work contact details, and birthdays and anniversaries.'],
      ['My Mail, Notifications, Preferences', 'Your mailbox, what needs you, and your own settings (language, which alerts you want).'],
      ['Profile', 'Your details. Bank and contact details are read-only; ask HR to allow you to change them, and you can change them once.'],
    ]} />) },
  { id: 'portal-tips', title: 'Tips for employees', body: (
    <ul style={{ margin: '6px 0 6px 20px', fontSize: '.86rem', lineHeight: 1.8 }}>
      <li>If your password was changed by HR, use the new one from the mail; you can change it later in Change Password.</li>
      <li>After too many wrong passwords the login waits for a while and then opens by itself.</li>
      <li>If an upload fails on a phone, try again; large photos are made smaller automatically.</li>
      <li>If something shows "quote reference ...", tell HR the reference so they can find the cause.</li>
    </ul>) },
];

const COMMON_TROUBLE = [
  { id: 'trouble', title: 'If something goes wrong (whole system)', body: (
    <Table head={['What you see', 'What to check']} widths={['34%', '66%']} rows={[
      ['Cannot sign in', 'Check the email and password. After several wrong tries the login waits a few minutes. HR can set a new password in Employee Credentials (that also opens the lock).'],
      ['Attendance missing for a day', 'TeamOffice may not have the punch yet; press Refresh now. A day can be marked by hand in Daily Records.'],
      ['A mail was not received', 'The email on the profile may be a made-up one, the mail may be in spam, or the company SMTP is not set. See Email Log for the status.'],
      ['A page shows "Something went wrong ... reference"', 'Tell the administrator the reference; API Logs shows the real error.'],
      ['A figure of salary looks wrong', 'Open the Payroll sections above: Payroll: If something looks wrong.'],
      ['An employee cannot be found in a list', 'Check their status in Status Master; some lists show only working employees.'],
    ]} />) },
];

const payroll = PAYROLL.map(s => ({ ...s, id: 'pay-' + s.id, title: 'Payroll: ' + s.title.replace(/^\d+\.\s*/, '') }));

const ADMIN_GROUPS = [
  { name: 'Start here', sections: START },
  { name: 'People', sections: PEOPLE },
  { name: 'Time & Leave', sections: TIME },
  { name: 'Payroll', sections: payroll },
  { name: 'Employee Services', sections: SERVICES },
  { name: 'Insights & Communication', sections: COMMS },
  { name: 'Admin and Settings', sections: ADMIN },
  { name: 'The employee portal', sections: EMPLOYEE },
  { name: 'Troubleshooting', sections: COMMON_TROUBLE },
];
const EMPLOYEE_GROUPS = [{ name: 'Your portal', sections: EMPLOYEE }];

export default function Guide() {
  const isEmployee = sessionStorage.getItem('role') === 'USER';
  const groups = isEmployee ? EMPLOYEE_GROUPS : ADMIN_GROUPS;
  const all = useMemo(() => groups.flatMap(g => g.sections.map(s => ({ ...s, group: g.name }))), [isEmployee]);
  const onPayroll = window.location.pathname === '/payroll/guide';
  const [q, setQ] = useState('');
  // accordion: one chapter is open at a time; opening another closes the one that was open
  const [open, setOpen] = useState(onPayroll ? 'pay-flow' : isEmployee ? 'portal' : 'start');
  const text = useMemo(() => Object.fromEntries(all.map(s => [s.id, (s.title + ' ' + JSON.stringify(s.body, (k, v) => (k.startsWith('_') ? undefined : v))).toLowerCase()])), [all]);
  const match = (s) => !q.trim() || text[s.id].includes(q.trim().toLowerCase());
  const searching = !!q.trim();
  // the chapter that was just opened is brought into view (the one above it has closed, so the page moves)
  useEffect(() => { if (open) { const el = document.getElementById('guide-' + open); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, [open]);

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Guide</h1>
          <p>{isEmployee ? 'What each page of your portal is for and how to use it.' : 'What every page is for, how to do each job step by step, where each setting is, and how a salary is worked out.'}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the guide (for example: leave, EL, sandwich, PF, password, letter)..." style={{ flex: '1 1 280px', maxWidth: 460, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: '.88rem', outline: 'none', fontFamily: 'inherit' }} />
      </div>
      {groups.map(g => {
        const list = g.sections.filter(match);
        if (!list.length) return null;
        return (
          <div key={g.name} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b', margin: '4px 2px 6px' }}>{g.name}</div>
            {list.map(s => (
              <div key={s.id} id={`guide-${s.id}`} style={{ background: '#fff', border: '1px solid #eadfd5', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                <button onClick={() => setOpen(o => (o === s.id ? null : s.id))} style={{ width: '100%', textAlign: 'left', background: '#f8fafc', border: 'none', padding: '11px 16px', fontWeight: 800, fontSize: '.92rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontFamily: 'inherit' }}>
                  <span>{s.title}</span><span style={{ color: '#94a3b8' }}>{searching || open === s.id ? '−' : '+'}</span>
                </button>
                {(searching || open === s.id) && <div style={{ padding: '6px 16px 14px' }}>{(SHOTS[s.id] || []).map(([f, c]) => <Shot key={f} src={`/guide/${f}.jpg`} alt={c} caption={c} />)}{s.body}</div>}
              </div>
            ))}
          </div>
        );
      })}
      {searching && !all.some(match) && <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Nothing in the guide matches "{q}".</div>}
    </div>
  );
}
