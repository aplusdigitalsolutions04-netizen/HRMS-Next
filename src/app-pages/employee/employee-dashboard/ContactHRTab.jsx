import React, { useState } from 'react';
import Swal from 'sweetalert2';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function ContactHRTab() {
  const [category, setCategory] = useState('Work From Home');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Please fill in both Subject and Message fields.' });
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch(`${API}/employee/contact-hr`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Failed to send email to HR');
      
      Swal.fire({ icon: 'success', title: 'Sent!', text: 'Your message has been successfully emailed to HR. A copy has also been sent to you.' });
      setSubject('');
      setMessage('');
      setCategory('Work From Home');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="emp-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="emp-card-header">
        <h3>Contact HR / Help Desk</h3>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: 0 }}>Send an email directly to the HR department regarding your concerns.</p>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
        
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Category</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14, color: '#0f172a' }}
          >
            <option value="Work From Home">Work From Home (WFH)</option>
            <option value="Leave & Attendance">Leave & Attendance</option>
            <option value="Payroll & Salary">Payroll & Salary</option>
            <option value="Grievance">Grievance</option>
            <option value="Other Query">Other Query</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Subject</label>
          <input 
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E.g., Request for Work From Home on Friday"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14, color: '#0f172a' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Message Details</label>
          <textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Explain your concern or request in detail..."
            rows="6"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', background: '#f8fafc', fontSize: 14, color: '#0f172a', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button 
            type="submit" 
            disabled={isSending}
            style={{ 
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', 
              color: '#fff', border: 'none', padding: '12px 24px', 
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: isSending ? 'not-allowed' : 'pointer',
              opacity: isSending ? 0.7 : 1, transition: 'all 0.2s'
            }}
          >
            {isSending ? (
              <>Sending...</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send to HR
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
