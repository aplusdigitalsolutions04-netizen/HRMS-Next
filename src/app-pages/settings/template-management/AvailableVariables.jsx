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
const authHeaders = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

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
            confirmButtonColor: '#6366f1',
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
        <div style={{ marginTop: '24px' }}>
            <div className="section-title" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <span className="step-num" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6366f1)' }}>V</span>
                    Available Variables
                    <span style={{
                        background: '#ede9fe', color: '#7c3aed',
                        borderRadius: '50px', padding: '3px 12px',
                        fontSize: '.75rem', fontWeight: 800, marginLeft: '8px'
                    }}>
                        {ALL_VARS.length}
                    </span>
                </div>
                <button 
                    type="button" 
                    onClick={handleCreateVariable} 
                    style={{ background: '#f8fafc', color: '#4338ca', border: '1.5px solid #e0e7ff', padding: '6px 14px', borderRadius: '8px', fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = '#e0e7ff'}
                    onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
                >
                    + Create Variable
                </button>
            </div>
            <div style={{ fontSize: '.85rem', color: '#64748b', marginBottom: '14px' }}>
                Use these placeholders in your template subject or body. They will be replaced with actual candidate data when sending emails.
                {onInsert ? ' Click a variable to insert it into the email body.' : ' Click a variable to copy it.'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ALL_VARS.map((item, i) => (
                    <div key={i}
                        onClick={() => handleClick(item)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '7px 14px', borderRadius: '50px',
                            background: '#f0f4ff', border: '1.5px solid #e0e7ff',
                            color: '#4338ca', cursor: 'pointer',
                            fontFamily: "'Outfit', monospace", fontSize: '.82rem',
                            fontWeight: 700, transition: 'all .2s',
                            boxShadow: 'none'
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.borderColor = '#a5b4fc'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,.15)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.borderColor = '#e0e7ff'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        title={item.desc}
                    >
                        <span style={{ color: '#6366f1', fontSize: '.9rem' }}>📋</span>
                        {item.var}
                        <span style={{ fontSize: '.68rem', color: '#94a3b8', fontWeight: 500 }}>{item.desc}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
