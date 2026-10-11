import React from 'react';
import Swal from 'sweetalert2';

const VARS = [
    { var: '{CANDIDATE_NAME}', desc: 'Candidate full name' },
    { var: '{POSITION}', desc: 'Job position / apply post' },
    { var: '{INTERVIEW_DATE}', desc: 'Interview date' },
    { var: '{INTERVIEW_MODE}', desc: 'Interview mode (Online/Offline)' },
    { var: '{ROUND}', desc: 'Interview round' },
    { var: '{COMPANY_NAME}', desc: 'Company name' },
    { var: '{{name}}', desc: 'Employee Name (For Welcome Email)' },
    { var: '{{email}}', desc: 'Employee Email (For Welcome Email)' },
    { var: '{{password}}', desc: 'Login Password (For Welcome Email)' },
    { var: '{{login_url}}', desc: 'Login URL (For Welcome Email)' },
    { var: '{{official_email}}', desc: 'Official Email (For Welcome Email)' },
    { var: '{{official_no}}', desc: 'Official No. (For Welcome Email)' },
    { var: '{{official_details_section}}', desc: 'Pre-designed Official Details Box (For Welcome Email)' },
];

const API = '/api';
const authHeaders = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });

export default function AvailableVariables({ onInsert }) {
    const [customVars, setCustomVars] = React.useState([]);

    React.useEffect(() => {
        fetch(`${API}/settings/templates/variables`, { headers: authHeaders() })
            .then(res => res.json())
            .then(data => setCustomVars(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    const handleClick = (item) => {
        navigator.clipboard.writeText(item.var);
        if (onInsert) {
            onInsert(item.var);
            Swal.fire({ icon: 'success', title: 'Inserted!', text: `${item.var} added to the email body (and copied to clipboard).`, timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
        } else {
            Swal.fire({ icon: 'success', title: 'Copied!', text: `${item.var} copied to clipboard.`, timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
        }
    };

    const handleCreateVariable = () => {
        Swal.fire({
            title: 'Create Custom Variable',
            html: `
                <input id="swal-input-name" class="premium-input" placeholder="Variable Name (e.g. SALARY)" style="width: 100%; box-sizing: border-box; margin-bottom: 12px;">
                <input id="swal-input-desc" class="premium-input" placeholder="Short Description (e.g. Offered Salary)" style="width: 100%; box-sizing: border-box;">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Create',
            confirmButtonColor: '#2563eb',
            preConfirm: () => {
                const name = document.getElementById('swal-input-name').value;
                const desc = document.getElementById('swal-input-desc').value;
                if (!name) { Swal.showValidationMessage('Variable Name is required'); return false; }
                return { name, desc };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await fetch(`${API}/settings/templates/variables`, {
                        method: 'POST',
                        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify(result.value)
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.detail || 'Failed to create');
                    setCustomVars(prev => [...prev, { name: json.name, description: json.description }]);
                    Swal.fire({ icon: 'success', title: 'Created!', text: `${json.name} is now available.`, timer: 1500, showConfirmButton: false });
                } catch(e) {
                    Swal.fire('Error', e.message, 'error');
                }
            }
        });
    };

    const ALL_VARS = [...VARS, ...customVars.map(cv => ({ var: cv.name, desc: cv.description }))];

    return (
        <div style={{ marginTop: '14px' }}>
            <div className="section-title" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <span className="step-num" style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>V</span>
                    Available Variables
                    <span style={{
                        background: '#dbeafe', color: '#2563eb',
                        borderRadius: '50px', padding: '3px 12px',
                        fontSize: '.75rem', fontWeight: 700, marginLeft: '8px'
                    }}>
                        {ALL_VARS.length}
                    </span>
                </div>
                <button 
                    type="button" 
                    onClick={handleCreateVariable} 
                    style={{ background: '#f8fafc', color: '#1e40af', border: '1.5px solid #dbeafe', padding: '4px 11px', borderRadius: '8px', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                    onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
                >
                    + Create Variable
                </button>
            </div>
            <div style={{ fontSize: '.76rem', color: '#64748b', marginBottom: '8px' }}>
                Use these placeholders in your template subject or body. They will be replaced with actual candidate data when sending emails.
                {onInsert ? ' Click a variable to insert it into the email body.' : ' Click a variable to copy it.'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ALL_VARS.map((item, i) => (
                    <div key={i}
                        onClick={() => handleClick(item)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '3px 10px', borderRadius: '50px',
                            background: '#f0f4ff', border: '1.5px solid #dbeafe',
                            color: '#1e40af', cursor: 'pointer',
                            fontFamily: "'Outfit', monospace", fontSize: '.72rem',
                            fontWeight: 700, transition: 'all .2s',
                            boxShadow: 'none'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,.15)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.borderColor = '#dbeafe'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        title={item.desc}
                    >
                        {item.var}
                    </div>
                ))}
            </div>
        </div>
    );
}
