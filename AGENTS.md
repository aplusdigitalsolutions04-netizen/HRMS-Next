<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Status

HRMS migration from FastAPI+React+Vite to Next.js App Router + TypeScript.

### What's Done
- **Next.js project created** at `C:\Users\dgurj\Desktop\apds\hrm-next` (Next.js 16.2.9, Turbopack)
- **Infrastructure**: MySQL connection pool (`src/lib/db.ts`), JWT/bcrypt auth (`src/lib/auth.ts`), permissions RBAC (`src/lib/permissions.ts`), shared utils (`src/lib/utils.ts`), middleware (Bearer token guard)
- **41 frontend pages** copied from original to `src/app-pages/`, API URL replaced from `http://127.0.0.1:8001` to `/api`
- **ClientLayout** wraps pages in BrowserRouter; dynamic imports with `ssr: false` for all page components
- **88+ API route handlers** compiled and building, covering:
  - Auth: `/api/token`, `/api/logout`, `/api/profile`, `/api/change-password`
  - Employees: manage, stats, pending, detail, register, edit, approve, change-password, delete, management
  - Leave: apply, approve/reject/cancel, my-balance/my-requests/my-stats, admin requests/stats, calendar, employee balance/requests
  - Attendance: result, templates (CRUD/upload/activate), my-attendance (summary/monthly/insights/records/calendar export), admin export
  - Payroll: employees, salary-structures, generate-all, generate-payslip, payslips (get/download/delete/send-email)
  - Email: draft (CRUD), drafts (list/update/delete/send), logs (list/filter/delete/resend), send-template
  - Settings: company, SMTP, system, users, permissions
  - HRMS legacy: DownloadAttendanceFormat, GetApplyPostList, UpdateInterviewStatus
  - Other: candidates, interviews, designations, departments, notifications, document-approvals, reminders, my-documents, my-notifications, email-templates
- **Build passes** (`npx next build` succeeds)

### Known Issues
- Some TypeScript strict checks disabled (`strict: false, noImplicitAny: false, strictNullChecks: false`)

### Credentials
- Admin: `hr@aplusdigitalsolutions.com` / `123456` → role `"ADMIN"`
- Employee: `user@gmail.com` / `123456` → role `"USER"`
- Login sends `application/x-www-form-urlencoded` (NOT JSON)
- MySQL: localhost, user: root, password: see .env.local (not committed), db: HR

### Key Conventions
- Route handler params use `Promise<{ id: string }>` with `await params` (Next.js 16 API)
- All frontend API calls use `const API = '/api'`
- All styling via inline `<style>` blocks (no Tailwind)
- JWT stored in localStorage, sent as Bearer token
