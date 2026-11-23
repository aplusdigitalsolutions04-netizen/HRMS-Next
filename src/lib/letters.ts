// @ts-nocheck
import { query, execute } from './db';
import { RowDataPacket } from 'mysql2';
import { getPayslipSignatories } from './payroll-calc';
import { snapshotOf, monthlyTotal } from './salary-history';
import { getConfig } from './app-config';
import { parseLetter } from './letter-markup';
import { isDocBody, parseDoc, fillDoc } from './letter-doc';
import { drawDoc } from './letter-pdf';
import { compensation, compensationMarkup, numberToWords, inr, DEFAULT_BREAKUP, BreakupRow } from './compensation';

// Letters (offer, appointment, confirmation, experience, relieving) made from a template with the employee's details filled in, as a PDF.
// A template is plain text: a blank line starts a new paragraph, a line starting with "- " is a bullet, a line starting with "# " is a
// centred heading; **bold**, *italic*, __underline__ and <center> / <right> work too (see letter-markup.ts). {{name}}-style placeholders are replaced.

// The starting letters of a new install. After that the list lives in the database (letter_templates) and HR adds and removes types
// on the Letters page.
const STARTER_TYPES: { key: string; label: string }[] = [
  { key: 'offer', label: 'Offer letter' },
  { key: 'appointment', label: 'Appointment letter' },
  { key: 'confirmation', label: 'Confirmation letter' },
  { key: 'experience', label: 'Experience letter' },
  { key: 'relieving', label: 'Relieving letter' },
  { key: 'appraisal', label: 'Appraisal letter' },
];
// uses_salary: the text uses the monthly salary (the salary table or a salary word), so the form asks for it
export async function letterTypes(): Promise<{ key: string; label: string; uses_salary: boolean }[]> {
  await ensureLetterTemplates();
  const rows = await query<RowDataPacket[]>('SELECT letter_type, name, body FROM letter_templates ORDER BY name');
  return rows.map(r => ({ key: r.letter_type, label: r.name, uses_salary: /compensation_table|salary_monthly|ctc_annual|variable_pay|salaryTable/i.test(String(r.body || '')) }));
}

// ---- the words of a letter ----
// Nothing about the words is fixed in the code. Every word ({{name}}) is a row in letter_variables that HR can edit or remove on the
// Letters page > Letter words. A word is filled in one of three ways: from a piece of data (SOURCES: the employee's profile, the company
// settings, the salary structure, the dates typed in the form), from a fixed text, or typed in each time a letter is made.
// SOURCES only lists which pieces of data exist; the standard set of words below is put in once on a new install.
export const SOURCES: [string, string][] = [
  ['employee_name', 'Employee name'], ['emp_code', 'Employee ID'], ['designation', 'Designation'], ['location', 'Work location'],
  ['reporting_manager', 'Reporting manager'], ['joining_date', 'Date of joining'], ['date_of_birth', 'Date of birth'], ['father_spouse_name', 'Father / spouse name'],
  ['email', 'Personal email'], ['official_email', 'Official email'], ['mobile', 'Mobile number'],
  ['present_address', 'Present address'], ['permanent_address', 'Permanent address'], ['pan', 'PAN'], ['uan', 'UAN'], ['bank_name', 'Bank name'],
  ['salary_monthly', 'Gross monthly salary'], ['ctc_annual', 'Salary per year'],
  ['resignation_date', 'Resignation date (typed in the form)'], ['last_working_day', 'Last working day (typed in the form)'], ['effective_date', 'Effective date (typed in the form)'],
  ['tenure', 'Time worked (joining to last working day, or to today)'],
  ['today', 'Date of the letter'], ['month_year', 'Current month and year'], ['year', 'Current year'],
  ['letter_date_long', 'Date of the letter with the day name (Monday, 25 May 2026)'], ['joining_date_long', 'Date of joining with the day name'],
  ['salary_monthly_words', 'Monthly salary in words'], ['variable_pay', 'Variable pay (typed in the form)'], ['compensation_table', 'Salary breakup table (Annexure I)'], ['department', 'Department'],
  ['company_name', 'Company name'], ['company_address', 'Company address'], ['signatory_name', 'Authorised signatory'],
];
const SOURCE_IDS = new Set(SOURCES.map(x => x[0]));
export const isSource = (id: string) => SOURCE_IDS.has(id);

// word, name shown to HR, data it is filled from
const STANDARD_WORDS: [string, string, string][] = [
  ['name', 'Employee name', 'employee_name'], ['emp_code', 'Employee ID', 'emp_code'], ['designation', 'Designation', 'designation'], ['location', 'Work location', 'location'],
  ['reporting_manager', 'Reporting manager', 'reporting_manager'], ['joining_date', 'Date of joining', 'joining_date'], ['resignation_date', 'Resignation date', 'resignation_date'],
  ['last_working_day', 'Last working day', 'last_working_day'], ['effective_date', 'Effective date', 'effective_date'], ['salary_monthly', 'Gross monthly salary', 'salary_monthly'],
  ['ctc_annual', 'Salary per year', 'ctc_annual'], ['today', 'Date of the letter', 'today'], ['company_name', 'Company name', 'company_name'],
  ['company_address', 'Company address', 'company_address'], ['signatory_name', 'Authorised signatory', 'signatory_name'],
  ['email', 'Personal email', 'email'], ['official_email', 'Official email', 'official_email'], ['mobile', 'Mobile number', 'mobile'], ['date_of_birth', 'Date of birth', 'date_of_birth'],
  ['father_spouse_name', 'Father / spouse name', 'father_spouse_name'], ['present_address', 'Present address', 'present_address'], ['permanent_address', 'Permanent address', 'permanent_address'],
  ['pan', 'PAN', 'pan'], ['uan', 'UAN', 'uan'], ['bank_name', 'Bank name', 'bank_name'], ['tenure', 'Time worked', 'tenure'], ['month_year', 'Current month and year', 'month_year'], ['year', 'Current year', 'year'],
];

// Added to the words after the first version: filled in once on an install that already has words; words HR removes later stay removed.
const NEW_FIELD_WORDS: [string, string, string][] = [
  ['letter_date_long', 'Date of the letter with the day name', 'letter_date_long'], ['joining_date_long', 'Date of joining with the day name', 'joining_date_long'],
  ['salary_monthly_words', 'Monthly salary in words', 'salary_monthly_words'], ['compensation_table', 'Salary breakup table (Annexure I)', 'compensation_table'],
  ['department', 'Department', 'department'], ['variable_pay', 'Variable pay', 'variable_pay'],
];
// [word, name, kind, value]: fixed starting values that HR can change on Letter words (45 days notice and so on)
const NEW_OTHER_WORDS: [string, string, 'text' | 'ask', string][] = [
  ['notice_period', 'Notice period', 'text', '45 Days'], ['probation_period', 'Probation period', 'text', '30 Days'],
  ['working_hours', 'Working hours', 'text', '8.5 hours per day, five days a week'],
  ['hr_contact_name', 'HR contact name', 'ask', ''], ['hr_contact_phone', 'HR contact phone', 'ask', ''],
];
async function ensureNewWords() {
  const done = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letter_words_v2'"))[0];
  if (done) return;
  for (const [k, l, src] of NEW_FIELD_WORDS) await execute("INSERT IGNORE INTO letter_variables (var_key, label, kind, value, updated_at) VALUES (?,?, 'field', ?, NOW())", [k, l, src]);
  for (const [k, l, kind, v] of NEW_OTHER_WORDS) await execute("INSERT IGNORE INTO letter_variables (var_key, label, kind, value, updated_at) VALUES (?,?,?,?, NOW())", [k, l, kind, v]);
  await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_words_v2', '1')");
}

export type LetterWord = { key: string; label: string; kind: 'field' | 'text' | 'ask'; value: string };

// puts the standard words in once; words HR removed later stay removed (restoreStandardWords brings them back on request)
export async function ensureLetterWords() {
  const done = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letter_words_seeded'"))[0];
  if (done) return;
  for (const [k, l, src] of STANDARD_WORDS) await execute("INSERT IGNORE INTO letter_variables (var_key, label, kind, value, updated_at) VALUES (?,?, 'field', ?, NOW())", [k, l, src]);
  await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_words_seeded', '1')");
}
export async function restoreStandardWords(): Promise<number> {
  let n = 0;
  for (const [k, l, src] of STANDARD_WORDS) { const r: any = await execute("INSERT IGNORE INTO letter_variables (var_key, label, kind, value, updated_at) VALUES (?,?, 'field', ?, NOW())", [k, l, src]); n += Number(r.affectedRows || 0); }
  await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_words_seeded', '1')");
  return n;
}
export async function letterWords(): Promise<LetterWord[]> {
  await ensureLetterWords();
  await ensureNewWords();
  const rows = await query<RowDataPacket[]>('SELECT var_key, label, kind, value FROM letter_variables ORDER BY label');
  return rows.map(r => ({ key: r.var_key, label: r.label, kind: r.kind === 'ask' ? 'ask' : r.kind === 'field' ? 'field' : 'text', value: r.value || '' }));
}
// [word, name] pairs for the clickable list on the letter texts
export async function allPlaceholders(): Promise<[string, string][]> {
  return (await letterWords()).map(v => [v.key, v.label + (v.kind === 'ask' ? ' (asked each time)' : '')] as [string, string]);
}

const COMMON_END = `
For {{company_name}}

{{signatory_name}}
Authorised Signatory`;

// The standard texts of the first version. A letter whose text is still exactly one of these has never been changed by HR, so it can
// be moved to the newer standard text without taking anything away from anyone.
const V1_TEMPLATES: Record<string, string> = {
  offer: `Dear {{name}},

We are pleased to offer you the position of {{designation}} at {{company_name}}, based at {{location}}.

- Date of joining: {{joining_date}}
- Gross monthly salary: {{salary_monthly}} ({{ctc_annual}} per year)
- Reporting to: {{reporting_manager}}

This offer depends on the verification of your documents and references. Please sign and return a copy of this letter to confirm that you accept it.

We look forward to welcoming you to the team.
${COMMON_END}`,
  appointment: `# APPOINTMENT LETTER

Dear {{name}},

With reference to your application and the discussions we had, we are pleased to appoint you as {{designation}} at {{company_name}} with effect from {{joining_date}}.

- Employee ID: {{emp_code}}
- Place of work: {{location}}
- Gross monthly salary: {{salary_monthly}} ({{ctc_annual}} per year)
- Reporting to: {{reporting_manager}}

You will be bound by the rules, policies and code of conduct of the company that are in force from time to time. Your appointment can be ended by either side by giving notice as per the company policy.

Please sign the duplicate copy of this letter as a token of your acceptance.
${COMMON_END}`,
  relieving: `# RELIEVING LETTER

Dear {{name}},

This is to confirm that your resignation dated {{resignation_date}} has been accepted and that you are relieved from your duties as {{designation}} at {{company_name}} at the close of working hours on {{last_working_day}}.

We confirm that you have handed over your responsibilities and company property, and we have no dues pending from your side as on the date of this letter, subject to the final settlement of your accounts.

We thank you for your services and wish you every success.
${COMMON_END}`,
};

// The standard texts of the second version (see V1_TEMPLATES): a letter still exactly like one of these gets the third version.
const V2_TEMPLATES: Record<string, string> = {
  offer: `Date: {{letter_date_long}}

Name: {{name}}
Mobile No: {{mobile}}
Email ID: {{email}}

# OFFER LETTER

Dear {{name}},

We are pleased to inform you that, based on your performance during the interview and the positive feedback received, you are being offered the position of **{{designation}}** at **{{company_name}}**.

You are hereby offered the role of **{{designation}}** on the following terms and conditions:

- You are required to join the company as a full-time employee on **{{joining_date_long}}**. If you do not join on or before this date, the offer will automatically stand withdrawn.
- Your monthly salary will be an all-inclusive amount of **{{salary_monthly}}/- ({{salary_monthly_words}})**. For a detailed breakdown of the salary, please refer to Annexure I.
- **Roles & Responsibilities:** Your detailed Roles and Responsibilities list is attached as Annexure III along with this Offer Letter and forms an integral part of this employment offer.
- **Reporting Manager:** {{reporting_manager}}
- **Notice Period:** {{notice_period}}
- **Probation Period:** {{probation_period}}

If the offer is acceptable to you and you meet the above terms and conditions, you are requested to contact **{{hr_contact_name}}** at **{{hr_contact_phone}}** to complete the employment formalities.

Please ensure the submission of documents as specified in Annexure II, and kindly carry all the required documents with you on the date of joining.

We look forward to having you as a valuable part of our team.

**{{company_name}}**
{{company_address}}

A detailed appointment letter will be given to you upon completion of the joining formalities.

**Yours faithfully,**
For **{{company_name}}**
<signature>
**Authorised Signatory**

**Acknowledgement & Acceptance**

I, **{{name}}**, hereby confirm that I have read and understood the above terms and conditions and agree to accept the same.

[line] **Signature:**
[line] **Date:**

<pagebreak>

# ANNEXURE I
<center>**Compensation Structure**
Name: **{{name}}**
Designation: **{{designation}}**

{{compensation_table}}

# ANNEXURE II
Kindly submit the required documents for further process.

**Candidate Information**

1. Identity Proof - Any One (Passport Copy / Driving License / Voter ID / PAN Card)
2. Copy of Latest Resume
3. All Education Certificates and Mark Sheets
4. Signed Offer Letter
5. Address Proof - Any One (Passport Copy / Voter ID / Rent Agreement / Current Address Proof)
6. Appointment Letter of all previous companies
7. Internship Certificate / Experience Certificate
8. One passport-size photograph

<pagebreak>

# ANNEXURE III
<center>**Employee Tasks, Roles & Responsibilities**
<center>**Department: {{department}}**

- Write the roles and responsibilities of this position here, one point on each line.`,
  appointment: `Date: {{letter_date_long}}

Dear {{name}},

**Subject:** Appointment Letter (LOA)

We are pleased to confirm that you joined **{{company_name}}** as a **{{designation}}** on **{{joining_date}}**. You have been working **{{working_hours}}**, with a monthly salary of **{{salary_monthly}}/-**. A detailed breakdown of your compensation was provided in **Annexure I.**

We are pleased to offer you the position of **{{designation}}** at **{{company_name}}** under the following terms:

- **Reporting Manager:** {{reporting_manager}}
- **Notice Period:** {{notice_period}}
- **Probation Period:** {{probation_period}}

**__Terms and Conditions:__**

1. Once issued, this appointment letter is final and cannot be altered. Please review all terms carefully before accepting.
2. All assigned work must be completed within the stipulated time. In cases of delay, additional hours may be required without extra compensation.
3. Salary will be disbursed during the **first week of every month.**
4. Salary will be credited only to the **employee's personal bank account.**
5. Any violation of company policies, despite **two to three warnings,** may lead to termination of employment.
6. The first month of employment will be **Work from Office (WFO).**

Should you accept the terms mentioned above, please contact **{{hr_contact_name}}** at **{{hr_contact_phone}}** to complete the joining formalities.

We look forward to welcoming you to our team and wish you a successful journey with **{{company_name}}.**

**{{company_name}}**
{{company_address}}

A detailed appointment letter will be given to you upon completion of the joining formalities.

Yours faithfully,
For **{{company_name}}**
<signature>
**Authorised Signatory**

I confirm and accept the above

[line] **{{name}}**
[line] **Date**

<pagebreak>

# ANNEXURE I
<center>**Compensation Structure**
Name: **{{name}}**
Designation: **{{designation}}**

{{compensation_table}}`,
  appraisal: `Date: {{letter_date_long}}

**Subject:** Appraisal Letter

Dear {{name}},

We are pleased to acknowledge your continued dedication, consistent performance, and valuable contributions to the organization. In recognition of your efforts, we are delighted to confirm your continued employment as **{{designation}}** at **{{company_name}}**, along with a revised compensation structure as detailed below. The revised terms will be effective from **{{effective_date}}.**

Employee Details:

- **Employee Name:** {{name}}
- **Employee ID:** {{emp_code}}
- **Department:** {{department}}

Revised Terms and Conditions:

1. Your designation will remain **{{designation}}.**
2. You will report directly to **{{reporting_manager}}.**
3. Your working hours will be **{{working_hours}}.**
4. A notice period of {{notice_period}} will be applicable in case of resignation or termination.
5. Your revised monthly Cost to Company (CTC) will be **{{salary_monthly}}** (**Rupees {{salary_monthly_words}} only**), as detailed in Annexure I.
6. The revised compensation will be credited to your registered bank account within the first week of each month.
7. You are expected to complete all assigned tasks and responsibilities within the designated work schedule. Any additional hours, if required, will be governed as per company policy.
8. Any violation of company policies, after two formal warnings, may lead to termination of employment with a 15-day notice period.

All other terms and conditions of your employment remain unchanged and will continue to be governed by the company's policies.

We appreciate your contributions and look forward to your continued growth and success with the organization.

**Yours faithfully,**
For **{{company_name}}**

**Authorised Signature**
<signature>
[line] (Signature)

**Acknowledgement & Acceptance**

I, **{{name}}**, hereby confirm that I have read and understood the above terms and conditions and agree to accept the same.

[line] **Signature:**
[line] **Date:**

# ANNEXURE I
<center>**Compensation Structure**
Name: **{{name}}**
Designation: **{{designation}}**

{{compensation_table}}`,
};

export const DEFAULT_TEMPLATES: Record<string, string> = {
  offer: `**Date: {{letter_date_long}}**

**Name:** {{name}}
**Mobile No:** {{mobile}}
**Email ID:** {{email}}

# OFFER LETTER

Dear {{name}},

We are pleased to inform you that, based on your performance during the interview and the positive feedback received, you are being offered the position of **{{designation}}** at **{{company_name}}**.

You are hereby offered the role of **{{designation}}** on the following terms and conditions:

- You are required to join the company as a full-time employee on **{{joining_date_long}}**. If you do not join on or before this date, the offer will automatically stand withdrawn.
- Your monthly salary will be an all-inclusive amount of **{{salary_monthly}}/- ({{salary_monthly_words}})**. For a detailed breakdown of the salary, please refer to Annexure I.
- **Roles & Responsibilities:** Your detailed Roles and Responsibilities list is attached as Annexure III along with this Offer Letter and forms an integral part of this employment offer.
- **Reporting Manager:** {{reporting_manager}}
- **Notice Period:** {{notice_period}}
- **Probation Period:** {{probation_period}}

If the offer is acceptable to you and you meet the above terms and conditions, you are requested to contact **{{hr_contact_name}}** at **{{hr_contact_phone}}** to complete the employment formalities.

Please ensure the submission of documents as specified in Annexure II, and kindly carry all the required documents with you on the date of joining.

We look forward to having you as a valuable part of our team.

**{{company_name}}**
{{company_address}}

A detailed appointment letter will be given to you upon completion of the joining formalities.

**Yours faithfully,**
For **{{company_name}}**
<signature>
**Authorised Signatory**

**Acknowledgement & Acceptance**

I, **{{name}}**, hereby confirm that I have read and understood the above terms and conditions and agree to accept the same.

[line] **Signature:**
[line] **Date:**

<pagebreak>

# ANNEXURE I
<center>**Compensation Structure**
Name: **{{name}}**
Designation: **{{designation}}**

{{compensation_table}}

# ANNEXURE II
Kindly submit the required documents for further process.

**Candidate Information**

1. Identity Proof - Any One (Passport Copy / Driving License / Voter ID / PAN Card)
2. Copy of Latest Resume
3. All Education Certificates and Mark Sheets
4. Signed Offer Letter
5. Address Proof - Any One (Passport Copy / Voter ID / Rent Agreement / Current Address Proof)
6. Appointment Letter of all previous companies
7. Internship Certificate / Experience Certificate
8. One passport-size photograph

<pagebreak>

# ANNEXURE III
<center>**Employee Tasks, Roles & Responsibilities**
<center>**Department: {{department}}**

- Write the roles and responsibilities of this position here, one point on each line.`,
  appointment: `**Date: {{letter_date_long}}**

Dear {{name}},

**Subject:** Appointment Letter (LOA)

We are pleased to confirm that you joined **{{company_name}}** as a **{{designation}}** on **{{joining_date}}**. You have been working **{{working_hours}}**, with a monthly salary of **{{salary_monthly}}/-**. A detailed breakdown of your compensation was provided in **Annexure I.**

We are pleased to offer you the position of **{{designation}}** at **{{company_name}}** under the following terms:

- **Reporting Manager:** {{reporting_manager}}
- **Notice Period:** {{notice_period}}
- **Probation Period:** {{probation_period}}

**__Terms and Conditions:__**

1. Once issued, this appointment letter is final and cannot be altered. Please review all terms carefully before accepting.
2. All assigned work must be completed within the stipulated time. In cases of delay, additional hours may be required without extra compensation.
3. Salary will be disbursed during the **first week of every month.**
4. Salary will be credited only to the **employee's personal bank account.**
5. Any violation of company policies, despite **two to three warnings,** may lead to termination of employment.
6. The first month of employment will be **Work from Office (WFO).**

Should you accept the terms mentioned above, please contact **{{hr_contact_name}}** at **{{hr_contact_phone}}** to complete the joining formalities.

We look forward to welcoming you to our team and wish you a successful journey with **{{company_name}}.**

**{{company_name}}**
{{company_address}}

A detailed appointment letter will be given to you upon completion of the joining formalities.

Yours faithfully,
For **{{company_name}}**
<signature>
**Authorised Signatory**

I confirm and accept the above

[line] **{{name}}**
[line] **Date**

<pagebreak>

# ANNEXURE I
<center>**Compensation Structure**
Name: **{{name}}**
Designation: **{{designation}}**

{{compensation_table}}`,
  confirmation: `# CONFIRMATION LETTER

Dear {{name}},

We are happy to inform you that, after a review of your performance, your services as {{designation}} are confirmed with effect from {{effective_date}}.

All other terms and conditions of your appointment remain the same.

We thank you for your contribution and wish you continued success with {{company_name}}.
${COMMON_END}`,
  appraisal: `**Date: {{letter_date_long}}**

**Subject:** Appraisal Letter

Dear {{name}},

We are pleased to acknowledge your continued dedication, consistent performance, and valuable contributions to the organization. In recognition of your efforts, we are delighted to confirm your continued employment as **{{designation}}** at **{{company_name}}**, along with a revised compensation structure as detailed below. The revised terms will be effective from **{{effective_date}}.**

Employee Details:

- **Employee Name:** {{name}}
- **Employee ID:** {{emp_code}}
- **Department:** {{department}}

Revised Terms and Conditions:

1. Your designation will remain **{{designation}}.**
2. You will report directly to **{{reporting_manager}}.**
3. Your working hours will be **{{working_hours}}.**
4. A notice period of {{notice_period}} will be applicable in case of resignation or termination.
5. Your revised monthly Cost to Company (CTC) will be **{{salary_monthly}}** (**Rupees {{salary_monthly_words}} only**), as detailed in Annexure I.
6. The revised compensation will be credited to your registered bank account within the first week of each month.
7. You are expected to complete all assigned tasks and responsibilities within the designated work schedule. Any additional hours, if required, will be governed as per company policy.
8. Any violation of company policies, after two formal warnings, may lead to termination of employment with a 15-day notice period.

All other terms and conditions of your employment remain unchanged and will continue to be governed by the company's policies.

We appreciate your contributions and look forward to your continued growth and success with the organization.

**Yours faithfully,**
For **{{company_name}}**

**Authorised Signature**
<signature>
[line] (Signature)

**Acknowledgement & Acceptance**

I, **{{name}}**, hereby confirm that I have read and understood the above terms and conditions and agree to accept the same.

[line] **Signature:**
[line] **Date:**

# ANNEXURE I
<center>**Compensation Structure**
Name: **{{name}}**
Designation: **{{designation}}**

{{compensation_table}}`,
  experience: `# EXPERIENCE CERTIFICATE

To whom it may concern,

This is to certify that {{name}} (Employee ID {{emp_code}}) worked with {{company_name}} as {{designation}} from {{joining_date}} to {{last_working_day}}.

During this period we found the conduct and work of {{name}} to be satisfactory. We wish {{name}} all the best for the future.
${COMMON_END}`,
  relieving: `**Date: {{letter_date_long}}**

Name: {{name}}
Mobile No.: {{mobile}}
Email ID: {{email}}

# Relieving Letter

Dear {{name}},

This is to formally confirm that you were employed with **{{company_name}}** from **{{joining_date}}** to **{{last_working_day}}** in the capacity of **{{designation}}.**

Your resignation dated **{{resignation_date}}** has been accepted, and you have been relieved from your duties effective **{{last_working_day}}**, after successful completion of all required formalities and handover processes.

Your Full and Final Settlement has been duly processed in accordance with company policy. During your tenure, your conduct and performance were found to be satisfactory.

We appreciate your contributions to the organization and wish you all the best in your future professional pursuits.

Warm regards,

<signature>
{{signatory_name}}
{{company_name}}`,
};

let widened = false;
// the longest letter that can be saved: a letter written in the editor carries its pictures inside it
export const maxLetterLen = (text: string) => (isDocBody(text) ? 3_000_000 : 20000);

export async function ensureLetterTemplates() {
  if (!widened) { widened = true; try { await execute('ALTER TABLE letter_templates MODIFY body MEDIUMTEXT NOT NULL'); } catch { /* already wide, or not allowed */ } }
  // the starting letters are put in once; later removals stay removed
  const done = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letters_seeded'"))[0];
  if (!done) {
    for (const t of STARTER_TYPES) {
      await execute('INSERT IGNORE INTO letter_templates (letter_type, name, body, updated_at) VALUES (?,?,?,NOW())', [t.key, t.label, DEFAULT_TEMPLATES[t.key] || '']);
    }
    await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letters_seeded', '1')");
    await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_templates_v2', '1')");
    await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_templates_v3', '1')");
  }
  // second version of the standard letters (page breaks, annexures, the salary table): an offer, appointment or relieving letter that
  // HR never changed gets the new text, a changed one is left alone ("Standard text" brings the new one back), and the appraisal letter is added
  const v2 = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letter_templates_v2'"))[0];
  if (!v2) {
    for (const key of Object.keys(V1_TEMPLATES)) {
      const row = (await query<RowDataPacket[]>('SELECT body FROM letter_templates WHERE letter_type = ?', [key]))[0];
      if (row && String(row.body || '').replace(/\r\n/g, '\n').trim() === V1_TEMPLATES[key].trim()) {
        await execute('UPDATE letter_templates SET body = ?, updated_at = NOW() WHERE letter_type = ?', [DEFAULT_TEMPLATES[key], key]);
      }
    }
    await execute('INSERT IGNORE INTO letter_templates (letter_type, name, body, updated_at) VALUES (?,?,?,NOW())', ['appraisal', 'Appraisal letter', DEFAULT_TEMPLATES.appraisal]);
    await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_templates_v2', '1')");
  }
  const v3 = (await query<RowDataPacket[]>("SELECT 1 FROM system_settings WHERE setting_key = 'letter_templates_v3'"))[0];
  if (!v3) {
    for (const key of Object.keys(V2_TEMPLATES)) {
      const row = (await query<RowDataPacket[]>('SELECT body FROM letter_templates WHERE letter_type = ?', [key]))[0];
      if (row && String(row.body || '').replace(/\r\n/g, '\n').trim() === V2_TEMPLATES[key].trim()) {
        await execute('UPDATE letter_templates SET body = ?, updated_at = NOW() WHERE letter_type = ?', [DEFAULT_TEMPLATES[key], key]);
      }
    }
    await execute("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES ('letter_templates_v3', '1')");
  }
}

// ---- the salary breakup (Annexure I of the offer, appointment and appraisal letters) ----
// The components and their percent of the fixed part of the salary are set by HR on Letters > Salary Breakup; DEFAULT_BREAKUP is only the start.
const BREAKUP_KEY = 'letter_comp_breakup';
const COLS_KEY = 'letter_comp_columns';
// the extra columns of the table (heading of each); up to 3
export function cleanColumns(raw: any): string[] {
  return (Array.isArray(raw) ? raw : []).map((x: any) => String(x ?? '').trim().replace(/\|/g, '/').slice(0, 30)).filter(Boolean).slice(0, 3);
}
export function cleanBreakup(raw: any, columns: string[] = []): { rows?: BreakupRow[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'Add at least one component' };
  if (raw.length > 10) return { error: 'At most 10 components' };
  const rows: BreakupRow[] = [];
  for (const r of raw) {
    const name = String(r?.name ?? '').trim().replace(/\|/g, '/').slice(0, 40);
    const amount = Math.round(Number(r?.amount) || 0);
    const percent = amount > 0 ? 0 : Number(r?.percent);
    if (!name) return { error: 'Every component needs a name' };
    if (amount < 0 || amount > 100000000) return { error: `The amount of "${name}" is not right` };
    if (amount <= 0 && !(percent > 0 && percent <= 100)) return { error: `Give "${name}" a percent from 0 to 100, or an amount` };
    if (rows.some(x => x.name.toLowerCase() === name.toLowerCase())) return { error: `"${name}" is there twice` };
    const extra = columns.map((_, i) => String(r?.extra?.[i] ?? '').trim().replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 60));
    rows.push({ name, percent: Math.round(percent * 100) / 100, ...(amount > 0 ? { amount } : {}), ...(columns.length ? { extra } : {}) });
  }
  if (!rows.some(x => !x.amount)) return { error: 'At least one component must take a percent: it gets what is left after the fixed amounts' };
  const sum = rows.reduce((a, b) => a + b.percent, 0);
  if (Math.abs(sum - 100) > 0.01) return { error: `The percents add up to ${Math.round(sum * 100) / 100}. They must add up to 100.` };
  return { rows };
}
export async function getBreakup(): Promise<BreakupRow[]> {
  try {
    const r = (await query<RowDataPacket[]>('SELECT setting_value FROM system_settings WHERE setting_key = ?', [BREAKUP_KEY]))[0];
    if (r?.setting_value) { const c = cleanBreakup(JSON.parse(r.setting_value), await getBreakupColumns()); if (c.rows) return c.rows; }
  } catch { /* the starting list is used */ }
  return DEFAULT_BREAKUP.map(x => ({ ...x }));
}
export async function getBreakupColumns(): Promise<string[]> {
  try {
    const r = (await query<RowDataPacket[]>('SELECT setting_value FROM system_settings WHERE setting_key = ?', [COLS_KEY]))[0];
    if (r?.setting_value) return cleanColumns(JSON.parse(r.setting_value));
  } catch { /* no extra columns */ }
  return [];
}
export async function saveBreakupColumns(columns: string[]) {
  const value = JSON.stringify(columns);
  const r = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [COLS_KEY]);
  if (r.length) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, COLS_KEY]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [COLS_KEY, value]);
}
export async function saveBreakup(rows: BreakupRow[]) {
  const value = JSON.stringify(rows);
  const r = await query<RowDataPacket[]>('SELECT id FROM system_settings WHERE setting_key = ?', [BREAKUP_KEY]);
  if (r.length) await execute('UPDATE system_settings SET setting_value = ?, updated_on = NOW() WHERE setting_key = ?', [value, BREAKUP_KEY]);
  else await execute('INSERT INTO system_settings (setting_key, setting_value, updated_on) VALUES (?,?,NOW())', [BREAKUP_KEY, value]);
}

// ---- values for the placeholders ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// The reference number HR may type for a letter (it can be left empty): returns the cleaned number, or { error, status } when it cannot be used.
// excludeId is the letter being edited (it may keep its own number).
export async function checkLetterRef(raw: any, excludeId?: any): Promise<{ ref?: string; error?: string; status?: number }> {
  const ref = String(raw || '').trim();
  if (!ref) return { ref: '' }; // a letter does not have to carry a reference number
  if (ref.length > 30) return { error: 'The reference number can be at most 30 characters', status: 422 };
  if (!/^[A-Za-z0-9][A-Za-z0-9 \/\-_.#]*$/.test(ref)) return { error: 'The reference number can have letters, numbers, spaces and / - _ . # only', status: 422 };
  const dup = await query<RowDataPacket[]>('SELECT 1 FROM letters_issued WHERE LOWER(ref_no) = LOWER(?) AND id <> ? LIMIT 1', [ref, excludeId ? Number(excludeId) : 0]);
  if (dup.length) return { error: `A letter with the reference number ${ref} already exists`, status: 409 };
  return { ref };
}

export function longDate(v: any): string {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return String(v);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// 2026-05-25 -> "Monday, 25 May 2026"
export function weekdayDate(v: any): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '').slice(0, 10));
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${WEEKDAYS[d.getDay()]}, ${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}
export const rupees = (v: any, c: any) => c.currency_label + ' ' + Math.round(Number(v) || 0).toLocaleString(c.locale);

export async function letterVars(employeeId: string, fields: Record<string, any> = {}): Promise<{ vars: Record<string, string>; employee: any } | null> {
  const e = (await query<RowDataPacket[]>(
    `SELECT e.*, m.full_name AS manager_name, DATE_FORMAT(e.date_of_joining, '%Y-%m-%d') AS joined FROM employees e LEFT JOIN employees m ON m.id = e.manager_id WHERE e.id = ? AND e.is_deleted = 0`, [employeeId]))[0];
  if (!e) return null;
  const cfg = await getConfig();
  const co = (await query<RowDataPacket[]>('SELECT company_name, company_address FROM company_settings LIMIT 1'))[0] || {};
  const ss = (await query<RowDataPacket[]>('SELECT * FROM salary_structures WHERE emp_code = ?', [e.emp_code]))[0];
  const fromStructure = ss ? monthlyTotal(snapshotOf(ss)) : 0;
  // the salary typed in the form wins over the salary structure (an offer is often made before there is a structure)
  const typed = Number(fields.monthly_salary);
  const monthly = typed > 0 ? typed : fromStructure;
  const variablePay = Math.min(monthly, Math.max(0, Number(fields.variable_pay) || 0));
  const letterDay = /^\d{4}-\d{2}-\d{2}$/.test(String(fields.letter_date || '')) ? String(fields.letter_date) : '';
  const sig = await getPayslipSignatories();
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const lwd = String(fields.last_working_day || '').slice(0, 10);
  const breakup = await getBreakup();
  // components marked Variable make the variable pay themselves; otherwise it is the amount typed for the letter
  const variableShown = monthly && breakup.some(b => b.variable) ? compensation(monthly, 0, breakup).variable : variablePay;
  const department = e.designation
    ? String((await query<RowDataPacket[]>('SELECT d.name FROM designations ds JOIN departments d ON d.id = ds.department_id WHERE ds.name = ? AND COALESCE(ds.is_deleted,0) = 0 LIMIT 1', [e.designation]).catch(() => []))[0]?.name || '')
    : '';
  // every piece of data a word can be filled from
  const data: Record<string, string> = {
    employee_name: e.full_name || '', emp_code: e.emp_code || '', designation: e.designation || '', location: e.location || '',
    reporting_manager: e.manager_name || 'the management',
    joining_date: longDate(fields.joining_date || e.joined), resignation_date: longDate(fields.resignation_date), last_working_day: longDate(fields.last_working_day),
    effective_date: longDate(fields.effective_date), salary_monthly: monthly ? rupees(monthly, cfg) : '', ctc_annual: monthly ? rupees(monthly * 12, cfg) : '',
    today: longDate(letterDay || ymd),
    letter_date_long: weekdayDate(letterDay || ymd), joining_date_long: weekdayDate(String(fields.joining_date || e.joined || '').slice(0, 10)),
    salary_monthly_words: monthly ? numberToWords(monthly) + ' Only' : '', variable_pay: variableShown ? rupees(variableShown, cfg) : '',
    compensation_table: monthly ? compensationMarkup(monthly, variablePay, breakup, cfg.currency_label, undefined, await getBreakupColumns()) : '', department,
    company_name: co.company_name || '', company_address: co.company_address || '', signatory_name: sig.authorised_by || 'Authorised Signatory',
    email: e.email_id || '', official_email: e.official_email || '', mobile: e.mobile_no || '', date_of_birth: longDate(e.dob), father_spouse_name: e.father_spouse_name || '',
    present_address: e.present_address || '', permanent_address: e.permanent_address || '', pan: e.pan || '', uan: e.uan || '', bank_name: e.bank_name || '',
    month_year: `${MONTHS[today.getMonth()]} ${today.getFullYear()}`, year: String(today.getFullYear()),
    tenure: tenureText(fields.joining_date || e.joined, /^\d{4}-\d{2}-\d{2}$/.test(lwd) ? new Date(lwd + 'T00:00:00') : today),
  };
  // the words HR has set up: from data, a fixed text, or what was typed for this letter
  const asked = (fields && typeof fields.custom === 'object' && fields.custom) || {};
  const vars: Record<string, string> = {};
  for (const v of await letterWords()) {
    vars[v.key] = v.kind === 'field' ? (data[v.value] ?? '') : v.kind === 'ask' ? String(asked[v.key] ?? '').slice(0, 500) : v.value;
  }
  return { vars, employee: e };
}

// "2 years 3 months" between two dates
function tenureText(from: string, to: Date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(from || '').slice(0, 10));
  if (!m) return '';
  const a = new Date(+m[1], +m[2] - 1, +m[3]);
  let months = (to.getFullYear() - a.getFullYear()) * 12 + (to.getMonth() - a.getMonth()) - (to.getDate() < a.getDate() ? 1 : 0);
  if (months < 0) return '';
  const y = Math.floor(months / 12), mo = months % 12;
  const parts = [y ? `${y} year${y > 1 ? 's' : ''}` : '', mo ? `${mo} month${mo > 1 ? 's' : ''}` : ''].filter(Boolean);
  return parts.join(' ') || 'less than a month';
}
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function fillLetter(body: string, vars: Record<string, string>): string {
  // a letter written in the editor is a document: its words are replaced inside the text, and the salary table becomes a real table
  if (isDocBody(body)) { const d = parseDoc(body); if (d) return JSON.stringify(fillDoc(d, vars).doc); }
  return String(body || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => (vars[String(k).toLowerCase()] ?? ''));
}

// ---- the PDF (drawn directly, so it works on a server without a browser) ----
const latin = (v: any) => String(v ?? '').replace(/₹/g, 'Rs. ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, '');
const dataImage = (v?: string): Buffer | null => {
  const m = v && /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  return m ? Buffer.from(m[2], 'base64') : null;
};

// ---- the letterhead: the company header drawn by the app, HR's own letterhead image, or nothing (pre-printed paper) ----
// placement: where the picture goes. "auto" looks at its shape: a picture about the shape of an A4 page covers the page, a wide strip
// (a header band) goes at the top. A picture is never stretched: it keeps its own proportions.
export type Letterhead = { mode: 'company' | 'image' | 'none'; image: string; top_mm: number; bottom_mm: number; placement: 'auto' | 'top' | 'bottom' | 'full' };
export const LETTERHEAD_DEFAULT: Letterhead = { mode: 'company', image: '', top_mm: 40, bottom_mm: 25, placement: 'auto' };
export async function getLetterhead(): Promise<Letterhead> {
  try {
    const r = (await query<RowDataPacket[]>('SELECT mode, image, top_mm, bottom_mm, placement FROM letterhead_settings WHERE id = 1'))[0];
    if (!r) return { ...LETTERHEAD_DEFAULT };
    return { mode: ['image', 'none'].includes(r.mode) ? r.mode : 'company', image: r.image || '', top_mm: Number(r.top_mm), bottom_mm: Number(r.bottom_mm), placement: ['top', 'bottom', 'full'].includes(r.placement) ? r.placement : 'auto' };
  } catch { return { ...LETTERHEAD_DEFAULT }; } // the table is made at the next start; until then the usual header
}
const mmToPt = (mm: number) => Math.round((Number(mm) || 0) * 2.8346);

// the size in pixels of a PNG or JPG
function imageSize(buf: Buffer): { w: number; h: number } | null {
  try {
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* unreadable: the caller falls back */ }
  return null;
}

// Where the letterhead picture is drawn on an A4 page (in points) and how much of the page it takes at the top or the bottom.
const A4_W = 595.28, A4_H = 841.89;
type Plan = { x: number; y: number; w: number; h: number; where: 'top' | 'bottom' | 'full' };
export function planLetterhead(buf: Buffer, placement: string): Plan {
  const sz = imageSize(buf);
  const ratio = sz && sz.h > 0 ? sz.w / sz.h : A4_W / A4_H;
  const where = placement === 'top' || placement === 'bottom' || placement === 'full' ? placement : (ratio >= 0.55 && ratio <= 0.9 ? 'full' : 'top');
  if (where === 'full') {
    // the whole page; a picture that is not A4-shaped is fitted inside the page, centred, never stretched
    const w = ratio >= A4_W / A4_H ? A4_W : A4_H * ratio, h = ratio >= A4_W / A4_H ? A4_W / ratio : A4_H;
    return { x: (A4_W - w) / 2, y: (A4_H - h) / 2, w, h, where };
  }
  const h = A4_W / ratio; // across the full width of the page
  return { x: 0, y: where === 'top' ? 0 : A4_H - h, w: A4_W, h, where };
}

async function startDoc(title: string, spacing?: { top: number; bottom: number }, background?: { buf: Buffer; plan: Plan } | null) {
  const PDFDocument = (await import('pdfkit')).default as any;
  const doc = new PDFDocument({ size: 'A4', margins: { top: spacing ? spacing.top : 50, bottom: spacing ? spacing.bottom : 60, left: 56, right: 56 }, info: { Title: title } });
  if (background) {
    // the letterhead picture is drawn on every page; the text cursor is put back where it was after drawing it
    const { buf, plan } = background;
    const paint = () => { const x = doc.x, y = doc.y; try { doc.image(buf, plan.x, plan.y, { width: plan.w, height: plan.h }); } catch { /* a picture that cannot be read is left out */ } doc.x = x; doc.y = y; };
    paint();
    doc.on('pageAdded', paint);
  }
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res, rej) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.on('error', rej); });
  return { doc, done };
}

async function drawHeader(doc: any) {
  const co = (await query<RowDataPacket[]>('SELECT company_name, company_address, company_logo FROM company_settings LIMIT 1'))[0] || {};
  const logo = dataImage(co.company_logo);
  const left = doc.page.margins.left, width = doc.page.width - left - doc.page.margins.right;
  let y = 40;
  if (logo) { try { doc.image(logo, left, y, { fit: [120, 44] }); } catch { /* a logo that cannot be read is left out */ } }
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(latin(co.company_name || ''), left, y + 2, { width, align: 'right' });
  doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text(latin(co.company_address || ''), left + 160, y + 20, { width: width - 160, align: 'right' });
  y += 56;
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.2).strokeColor('#2563eb').stroke();
  doc.y = y + 16; doc.x = left;
  return { left, width };
}

// A new PDF page set up with the letterhead chosen on the Letters > Letterhead page (the company header, HR's own picture, or empty paper).
// The letters and the full and final statement both start here, so they carry the same header.
async function startLetterheadDoc(title: string, letterhead?: Letterhead) {
  const lh = letterhead || await getLetterhead();
  const bg = lh.mode === 'image' ? dataImage(lh.image) : null;
  const mode = lh.mode === 'image' && !bg ? 'company' : lh.mode; // an image that is missing or unreadable falls back to the company header
  // a strip at the top (or bottom) also pushes the text down (or up) past itself, so the text never lands on the design
  const plan = bg ? planLetterhead(bg, lh.placement) : null;
  let top = mmToPt(lh.top_mm), bottom = mmToPt(lh.bottom_mm);
  if (plan && plan.where === 'top') top = Math.max(top, Math.round(plan.y + plan.h + 14));
  if (plan && plan.where === 'bottom') bottom = Math.max(bottom, Math.round(A4_H - plan.y + 10));
  const { doc, done } = await startDoc(title, mode === 'company' ? undefined : { top, bottom }, bg && plan ? { buf: bg, plan } : null);
  const { left, width } = mode === 'company' ? await drawHeader(doc) : { left: doc.page.margins.left, width: doc.page.width - doc.page.margins.left - doc.page.margins.right };
  return { doc, done, left, width };
}

// the size of the text of a letter and the space between its lines (the company's own letters read about like this)
const BODY_SIZE = 11, LINE_GAP = 2.6;

export async function renderLetterPdf(o: { title: string; ref: string; date: string; text: string }, letterhead?: Letterhead): Promise<Buffer> {
  const { doc, done, left, width } = await startLetterheadDoc(o.title, letterhead);
  // the reference number and the date are printed only when the letter has them
  if (o.ref || o.date) {
    const refY = doc.y;
    doc.fillColor('#475569').font('Helvetica').fontSize(9.5);
    if (o.ref) doc.text(`Ref: ${latin(o.ref)}`, left, refY, { width, align: 'left' });
    if (o.date) doc.text(`Date: ${latin(o.date)}`, left, refY, { width, align: 'right' });
    doc.y = refY + 20;
  }

  // a letter written in the editor (fonts, tables, pictures) has its own drawing
  if (isDocBody(o.text)) {
    const d = parseDoc(o.text);
    if (d) {
      const sg = await getPayslipSignatories();
      drawDoc(doc, d, { left, width, sigImg: dataImage(sg.authorised_signature) });
      doc.end();
      return done;
    }
  }
  // the text, read the same way as the preview on the Letters page (see letter-markup.ts)
  const fontOf = (r: { bold?: boolean; italic?: boolean }) => (r.bold && r.italic ? 'Helvetica-BoldOblique' : r.bold ? 'Helvetica-Bold' : r.italic ? 'Helvetica-Oblique' : 'Helvetica');
  const sig = await getPayslipSignatories();
  const sigImg = dataImage(sig.authorised_signature);
  const room = (h: number) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };
  const blocks = parseLetter(o.text);
  const signatureMarked = blocks.some(b => b.type === 'signature');
  let signaturePlaced = false;

  const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    // an Annexure heading goes to the next page together with its table, instead of being left alone at the bottom of a page
    if (block.type === 'lines' && block.lines[0]?.kind === 'heading' && blocks[bi + 1]?.type === 'table') {
      const titleH = block.lines.reduce((h, l) => h + (l.kind === 'heading' ? 34 : 17), 0) + 14;
      const need = titleH + tableHeight(doc, (blocks[bi + 1] as any).rows, width);
      if (doc.y + need > bottomLimit() && need < bottomLimit() - doc.page.margins.top) doc.addPage();
    }
    if (block.type === 'break') { doc.addPage(); continue; }
    if (block.type === 'signature') {
      if (sigImg) { try { room(60); doc.image(sigImg, left, doc.y, { fit: [120, 44] }); doc.y += 52; signaturePlaced = true; } catch { /* left out */ } }
      doc.x = left; continue;
    }
    if (block.type === 'table') { drawTable(doc, block.rows, left, width); doc.x = left; doc.moveDown(0.8); continue; }

    for (const ln of block.lines) {
      // a blank line to write on, with its label in front ("Signature:", "Date:")
      if (ln.kind === 'rule') {
        const label = latin(ln.runs.map(r => r.text).join(''));
        room(36);
        const y0 = doc.y;
        doc.font(ln.runs.some(r => r.bold) ? 'Helvetica-Bold' : 'Helvetica').fontSize(BODY_SIZE).fillColor('#1e293b');
        const lw = label ? doc.widthOfString(label + ' ') : 0;
        if (label) doc.text(label, left, y0 + 14, { lineBreak: false });
        doc.moveTo(left + lw + 2, y0 + 25).lineTo(left + lw + 2 + 190, y0 + 25).lineWidth(0.8).strokeColor('#475569').stroke();
        doc.x = left; doc.y = y0 + 36;
        continue;
      }
      const isHead = ln.kind === 'heading';
      const size = isHead ? 14 : BODY_SIZE;
      const isList = ln.kind === 'bullet' || ln.kind === 'number';
      // a bullet or a number stands in the margin and the words start after it, so a long point wraps under its first word
      const labelW = ln.kind === 'number' ? 22 : 14;
      const x = left + (isList ? 6 + labelW : 0), w = width - (isList ? 6 + labelW : 0);
      if (isHead) doc.moveDown(0.5);
      const runs: any[] = ln.runs;
      const shown = (r: any) => (r.raw ? r.text : latin(r.text));
      const drawn = runs.filter(r => shown(r).length);
      if (!drawn.length) { if (isHead) doc.moveDown(0.4); continue; }
      if (isList) room(size * 2.6);
      const y0 = doc.y;
      if (isList) { doc.fillColor('#1e293b').font('Helvetica').fontSize(size).text(ln.label, left + 6, y0, { lineBreak: false, width: labelW }); }
      drawn.forEach((r, i) => {
        doc.fillColor(isHead ? '#0f172a' : '#1e293b').font(fontOf(r)).fontSize(size);
        const opts: any = { width: w, align: ln.align, lineGap: LINE_GAP, underline: !!r.underline, continued: i < drawn.length - 1 };
        if (i === 0) doc.text(shown(r), x, isList ? y0 : doc.y, opts); else doc.text(shown(r), opts);
      });
      doc.x = left;
      if (isHead) doc.moveDown(0.5);
      else doc.moveDown(0.12);
    }
    doc.moveDown(0.85);
  }

  // signature of the authorised person (Payslip Settings), at the end unless the text says where it goes with <signature>
  if (sigImg && !signatureMarked && !signaturePlaced) { try { if (doc.y > doc.page.height - 130) doc.addPage(); doc.image(sigImg, left, doc.y, { fit: [120, 44] }); doc.moveDown(3.2); } catch { /* left out */ } }
  doc.end();
  return done;
}

// A table with borders, as in the letters' Annexure I: the first row is the heading, every cell is centred. A row that does not fit goes
// to the next page.
function tableLayout(doc: any, rows: { text: string; bold?: boolean }[][], left: number, width: number) {
  const cols = Math.max(...rows.map(r => r.length));
  const tw = Math.min(width, cols * 150), x0 = left + (width - tw) / 2, cw = tw / cols, pad = 7;
  const lines = rows.map((cells, ri) => Array.from({ length: cols }, (_, ci) => {
    const runs = cells[ci] || [];
    return { t: latin(runs.map(r => r.text).join('')), bold: ri === 0 || runs.some(r => r.bold) };
  }));
  const heights = lines.map(texts => {
    let h = 0;
    for (const c of texts) { doc.font(c.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(BODY_SIZE); h = Math.max(h, doc.heightOfString(c.t || ' ', { width: cw - pad * 2 })); }
    return Math.max(26, h + pad * 2);
  });
  return { cols, x0, cw, pad, lines, heights };
}
function tableHeight(doc: any, rows: any[][], width: number): number {
  if (!rows.length) return 0;
  return tableLayout(doc, rows, 0, width).heights.reduce((a, b) => a + b, 0);
}

// A table with borders, as in the letters' Annexure I: the first row is the heading, every cell is centred. A table that fits on one page is
// kept whole (it moves to the next page instead of being cut in two); a longer one goes on over the page.
function drawTable(doc: any, rows: { text: string; bold?: boolean }[][], left: number, width: number) {
  if (!rows.length) return;
  const L = tableLayout(doc, rows, left, width);
  const total = L.heights.reduce((a, b) => a + b, 0);
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + total > bottom && total < bottom - doc.page.margins.top) doc.addPage();
  L.lines.forEach((texts, ri) => {
    const rh = L.heights[ri];
    if (doc.y + rh > bottom) doc.addPage();
    const y = doc.y;
    texts.forEach((c, ci) => {
      doc.rect(L.x0 + ci * L.cw, y, L.cw, rh).lineWidth(0.8).strokeColor('#0f172a').stroke();
      doc.fillColor('#1e293b').font(c.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(BODY_SIZE);
      const th = doc.heightOfString(c.t || ' ', { width: L.cw - L.pad * 2 });
      doc.text(c.t, L.x0 + ci * L.cw + L.pad, y + (rh - th) / 2, { width: L.cw - L.pad * 2, align: 'center', lineBreak: true });
    });
    doc.y = y + rh;
  });
  doc.x = left;
}

// F&F statement: who, the lines (earnings and deductions) and the net amount
export async function renderStatementPdf(o: { title: string; ref: string; date: string; rows: [string, string][]; lines: { label: string; amount: number; type: string }[]; net: number }): Promise<Buffer> {
  const cfg = await getConfig();
  const { doc, done, left, width } = await startLetterheadDoc(o.title);
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text(latin(o.title), left, doc.y, { width, align: 'center' });
  const refLine = [o.ref ? `Ref: ${latin(o.ref)}` : '', o.date ? `Date: ${latin(o.date)}` : ''].filter(Boolean).join('    ');
  if (refLine) doc.moveDown(0.3).fillColor('#64748b').font('Helvetica').fontSize(9).text(refLine, left, doc.y, { width, align: 'center' });
  doc.moveDown(1);
  for (const [k, v] of o.rows) {
    const y = doc.y;
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9.5).text(latin(k), left, y, { width: 150 });
    doc.fillColor('#0f172a').font('Helvetica').fontSize(10).text(latin(v), left + 155, y, { width: width - 155 });
  }
  doc.moveDown(0.8);
  const col = (label: string, type: string) => {
    const rows = o.lines.filter(l => l.type === type);
    doc.fillColor(type === 'earning' ? '#15803d' : '#b91c1c').font('Helvetica-Bold').fontSize(10.5).text(label, left, doc.y, { width });
    doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).lineWidth(0.6).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.5);
    if (!rows.length) { doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(9.5).text('None', left, doc.y); doc.moveDown(0.5); }
    let total = 0;
    for (const r of rows) {
      const y = doc.y; total += Number(r.amount) || 0;
      doc.fillColor('#1e293b').font('Helvetica').fontSize(10).text(latin(r.label), left, y, { width: width - 110 });
      doc.text(rupees(r.amount, cfg), left + width - 100, y, { width: 100, align: 'right' });
    }
    const y = doc.y + 2;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text('Total', left, y, { width: width - 110 }).text(rupees(total, cfg), left + width - 100, y, { width: 100, align: 'right' });
    doc.moveDown(1);
  };
  col('Amounts payable to the employee', 'earning');
  col('Amounts recovered from the employee', 'deduction');
  doc.moveDown(0.2);
  const y = doc.y;
  doc.rect(left, y - 4, width, 28).fillColor('#eff6ff').fill();
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(o.net >= 0 ? 'Net amount payable' : 'Net amount recoverable', left + 10, y + 3, { width: width - 130 });
  doc.text(rupees(Math.abs(o.net), cfg), left + width - 120, y + 3, { width: 110, align: 'right' });
  doc.moveDown(3);
  doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text('This is a computer generated statement.', left, doc.y, { width, align: 'center' });
  doc.end();
  return done;
}
