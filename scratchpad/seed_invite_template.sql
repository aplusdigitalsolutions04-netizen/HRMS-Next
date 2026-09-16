-- Seeds the editable "Employee Invite" email template row, read by
-- src/app/api/employee/invite/route.ts. Safe to re-run: skips insert if a
-- row with this name already exists (e.g. edited by HR since).
INSERT INTO email_templates (id, name, subject, body, variables, created_on, template_type)
SELECT UUID(),
  'Employee Invite',
  'Complete Your Profile - Welcome to {{company_name}}',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc">
  {{company_logo}}
  <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,.06)">
    <h2 style="color:#0f172a;margin:0 0 16px">Welcome, {{name}}! &#128075;</h2>
    <p style="color:#334155;font-size:14px;line-height:1.6">
      You''ve been invited to join our HR Management Portal. To get started,
      please log in using the credentials below and complete your profile.
    </p>

    <div style="background:#f1f5f9;border-radius:10px;padding:18px;margin:20px 0">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">EMPLOYEE ID</p>
      <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a">{{emp_code}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">LOGIN EMAIL</p>
      <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#0f172a">{{email}}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">TEMPORARY PASSWORD</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a">{{password}}</p>
    </div>

    <p style="text-align:center;margin:28px 0">
      <a href="{{login_url}}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
        Log In &amp; Complete Profile
      </a>
    </p>

    <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin-top:24px">
      Please change your password after logging in. Once you submit your
      details, our HR team will review and activate your account.
    </p>
  </div>
</div>',
  '["name","email","password","emp_code","login_url","company_logo","company_name"]',
  NOW(),
  'Employee Invite'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE name = 'Employee Invite');
