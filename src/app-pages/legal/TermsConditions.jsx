import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsConditions() {
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
                    <h1 className="legal-title">Terms &amp; Conditions</h1>
                    <p className="legal-updated">Last updated: January 2026</p>

                    <p>
                        These Terms &amp; Conditions ("Terms") govern access to and use of the HR Management System
                        ("HRMS", "the platform") provided by A Plus Digital Solutions. By logging in or otherwise using
                        the platform, you agree to be bound by these Terms.
                    </p>

                    <h2>1. Purpose of the Platform</h2>
                    <p>
                        The HRMS is an internal tool intended solely for managing employee records, attendance, leave,
                        payroll, recruitment, and related HR functions of the organization. It is provided for use by
                        authorized employees and administrators only.
                    </p>

                    <h2>2. Account Responsibility</h2>
                    <ul>
                        <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                        <li>You must not share your account, password, or access with any other person.</li>
                        <li>You must notify HR/Admin immediately if you suspect unauthorized access to your account.</li>
                        <li>Temporary passwords issued during onboarding must be changed on first login.</li>
                    </ul>

                    <h2>3. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the platform for any purpose other than legitimate HR-related activity.</li>
                        <li>Attempt to access data, records, or features beyond your assigned role and permissions.</li>
                        <li>Upload false, misleading, or fraudulent documents or information.</li>
                        <li>Attempt to disrupt, reverse-engineer, or compromise the security of the platform.</li>
                    </ul>

                    <h2>4. Data Accuracy</h2>
                    <p>
                        You are responsible for the accuracy of the personal, employment, and financial information you
                        submit (e.g. bank details for payroll). The organization is not liable for delays or errors
                        arising from inaccurate information provided by the user.
                    </p>

                    <h2>5. Document Uploads</h2>
                    <p>
                        Documents uploaded through the platform (identity proofs, certificates, resumes, etc.) may be
                        reviewed and approved or rejected by HR/Admin. Uploaded files must be genuine and must not
                        violate any third party's rights.
                    </p>

                    <h2>6. Availability</h2>
                    <p>
                        While we aim to keep the platform available at all times, access may occasionally be
                        interrupted for maintenance, updates, or reasons beyond our control. We are not liable for any
                        loss arising from temporary unavailability of the platform.
                    </p>

                    <h2>7. Termination of Access</h2>
                    <p>
                        Access to the platform is tied to your employment status. Upon separation from the organization,
                        or in case of a violation of these Terms, your account access may be suspended or terminated.
                    </p>

                    <h2>8. Changes to These Terms</h2>
                    <p>
                        These Terms may be updated from time to time to reflect changes in policy or applicable law.
                        Continued use of the platform after such changes constitutes acceptance of the updated Terms.
                    </p>

                    <h2>9. Contact Us</h2>
                    <p>
                        For any questions regarding these Terms, please contact your HR department or write to us at{' '}
                        <a href="mailto:support@aplusdigitalsolutions.com" style={{ color: '#10b981' }}>support@aplusdigitalsolutions.com</a>.
                    </p>
                </div>
            </div>
        </>
    );
}
