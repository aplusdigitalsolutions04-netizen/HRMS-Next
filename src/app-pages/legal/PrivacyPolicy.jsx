import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
    return (
        <>
            <style>{`
                .legal-root { min-height:100vh; background:linear-gradient(135deg,#e6f7ef 0%,#eef2f7 45%,#e9edf5 100%); padding:32px 40px 60px; box-sizing:border-box; }
                .legal-card { width:100%; background:#fff; border-radius:18px; box-shadow:0 20px 50px rgba(15,23,42,.08); border:1px solid rgba(255,255,255,.6); padding:32px 48px 48px; box-sizing:border-box; }
                .legal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; padding-bottom:20px; border-bottom:1px solid #f1f5f9; }
                .legal-brand { display:flex; align-items:center; gap:10px; }
                .legal-brand img { height:32px; width:auto; max-width:150px; object-fit:contain; }
                .legal-title { font-family:'Outfit',sans-serif; font-weight:800; font-size:2rem; color:#0f172a; margin:0 0 6px; letter-spacing:-0.5px; }
                .legal-updated { font-size:.82rem; color:#64748b; margin:0 0 32px; }
                .legal-card h2 { font-family:'Outfit',sans-serif; font-weight:700; font-size:1.15rem; color:#0f172a; margin:28px 0 10px; }
                .legal-card p, .legal-card li { font-size:.92rem; line-height:1.7; color:#334155; }
                .legal-card ul { margin:8px 0; padding-left:22px; }
                .legal-back { display:inline-flex; align-items:center; gap:6px; font-size:.85rem; font-weight:600; color:#10b981; text-decoration:none; }
                .legal-back:hover { color:#059669; }
            `}</style>
            <div className="legal-root">
                <div className="legal-card">
                    <div className="legal-header">
                        <div className="legal-brand">
                            <img src="/aplus.png" alt="A Plus Digital Solutions" />
                        </div>
                        <Link to="/login" className="legal-back">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                            Back to Login
                        </Link>
                    </div>
                    <h1 className="legal-title">Privacy Policy</h1>
                    <p className="legal-updated">Last updated: January 2026</p>

                    <p>
                        This Privacy Policy describes how the HR Management System ("HRMS", "we", "us") operated by
                        A Plus Digital Solutions collects, uses, and protects information about employees, candidates,
                        and administrators who use this platform.
                    </p>

                    <h2>1. Information We Collect</h2>
                    <ul>
                        <li>Personal details: name, date of birth, contact number, email address, and address.</li>
                        <li>Employment details: employee code, designation, department, salary structure, and reporting hierarchy.</li>
                        <li>Documents: identity proof, address proof, resumes, educational certificates, offer/appointment letters, bank details, and photographs.</li>
                        <li>Attendance and leave records, including biometric/time-office punch data where applicable.</li>
                        <li>Payroll information, including bank account details and payslip history.</li>
                        <li>Account and usage data: login activity, IP address, and actions performed within the system.</li>
                    </ul>

                    <h2>2. How We Use Information</h2>
                    <ul>
                        <li>To manage employee records, attendance, leave, and payroll processing.</li>
                        <li>To facilitate recruitment, onboarding, and document verification/approval workflows.</li>
                        <li>To send transactional communications such as leave approvals, payslips, and account notifications.</li>
                        <li>To maintain audit trails and enforce role-based access control for security and compliance.</li>
                    </ul>

                    <h2>3. Data Storage and Security</h2>
                    <p>
                        Data is stored in a secured database and, where configured, uploaded documents may be stored in a
                        connected Google Drive account. Access to personal data is restricted based on role-based
                        permissions (Admin, HR, HR Staff, Employee). Passwords are stored using industry-standard hashing
                        and are never visible in plain text to administrators.
                    </p>

                    <h2>4. Data Sharing</h2>
                    <p>
                        We do not sell or rent personal information to third parties. Information may be shared only:
                    </p>
                    <ul>
                        <li>Within the organization, with HR/Admin personnel who require it to perform their duties.</li>
                        <li>With third-party service providers strictly necessary to operate the platform (e.g. email delivery, cloud document storage), bound by confidentiality obligations.</li>
                        <li>Where required by applicable law or a valid legal process.</li>
                    </ul>

                    <h2>5. Data Retention</h2>
                    <p>
                        Employee records are retained for as long as the employment relationship continues and thereafter
                        for a period required to comply with applicable legal, tax, and regulatory obligations.
                    </p>

                    <h2>6. Your Rights</h2>
                    <p>
                        You may request access to, correction of, or deletion of your personal data, subject to the
                        organization's legal and record-keeping obligations, by contacting your HR administrator.
                    </p>

                    <h2>7. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. Continued use of the HRMS after changes
                        are posted constitutes acceptance of the revised policy.
                    </p>

                    <h2>8. Contact Us</h2>
                    <p>
                        For any privacy-related questions or requests, please contact your HR department or write to us
                        at <a href="mailto:support@aplusdigitalsolutions.com" style={{ color: '#10b981' }}>support@aplusdigitalsolutions.com</a>.
                    </p>
                </div>
            </div>
        </>
    );
}
