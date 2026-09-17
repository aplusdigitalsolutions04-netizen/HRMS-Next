const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

/* ── interview time formatter ────────────────────────────────────── */
export const getInterviewTime = (interviewDate) => {
    if (!interviewDate) return '';
    try {
        return new Date(interviewDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
        return '';
    }
};

/* ── build the {{variable}} map used to fill email templates ────── */
export const buildTemplateVars = ({
    candidateName, candidateEmail, candidateMobile,
    applyPost, roundSelect, interviewDate, modeSelect,
    companyName, senderEmail, companyLogo,
}) => ({
    candidate_name: candidateName,
    candidate_email: candidateEmail,
    email_id: candidateEmail || '',
    contact_number: candidateMobile || '',
    job_role: applyPost,
    interview_round: roundSelect,
    interview_date: interviewDate,
    interview_time: getInterviewTime(interviewDate),
    interview_mode: modeSelect,
    sender_name: 'HR Team',
    company_name: companyName,
    company_logo: companyLogo || '',
    hr_name: 'Yashi Mishra',
    sender_email: senderEmail || '',
    hr_email: senderEmail || '',
});

/* ── save an email draft ─────────────────────────────────────────── */
export const saveEmailDraft = async (payload) => {
    const res = await fetch(`${API}/email/draft`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFT', ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.message || `Draft save failed (${res.status})`);
    return data;
};

/* ── create a reminder, using the configured default delay ──────── */
export const createReminder = async (payload) => {
    const settingsRes = await fetch(`${API}/settings/system`, { headers: auth() });
    const settings = settingsRes.ok ? await settingsRes.json() : {};
    const delayMinutes = parseInt(settings.default_reminder_delay || '30', 10);
    const reminderTime = new Date(Date.now() + delayMinutes * 60000).toISOString();
    const res = await fetch(`${API}/reminders`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, reminder_time: reminderTime, default_delay: delayMinutes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.message || 'Reminder creation failed');
    return { ...data, reminder_time: reminderTime, default_delay: delayMinutes };
};

/* ── variable substitution helper ────────────────────────────────── */
export const fillVariables = (text, vars) => {
    if (!text) return '';
    let result = text;
    Object.entries(vars).forEach(([key, val]) => {
        const v = val || '';
        result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), v);
    });
    const placeholderMap = {
        CANDIDATE_NAME: vars.candidate_name || 'N/A',
        POSITION:       vars.job_role || vars.apply_post || 'N/A',
        INTERVIEW_DATE: vars.interview_date || 'N/A',
        INTERVIEW_MODE: vars.interview_mode || 'N/A',
        ROUND:          vars.interview_round || 'N/A',
        COMPANY_NAME:   vars.company_name || 'N/A',
        HR_NAME:        'Yashi Mishra',
        HR_EMAIL:       vars.sender_email || vars.hr_email || '',
    };
    Object.entries(placeholderMap).forEach(([key, val]) => {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    });
    return result;
};

/* ── parse JSON-encoded variables list ───────────────────────────── */
export const parseVars = (raw) => {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
};

export const CHIP_COLORS = [
    { bg: '#ede9fe', color: '#7c3aed' },
    { bg: '#dbeafe', color: '#1d4ed8' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#fce7f3', color: '#be185d' },
    { bg: '#e0f2fe', color: '#0369a1' },
];
