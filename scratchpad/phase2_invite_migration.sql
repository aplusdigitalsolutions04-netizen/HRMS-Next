-- Phase 2: Employee self-onboarding (invite -> complete profile -> pending -> approve/send-back)
ALTER TABLE employees ADD COLUMN hr_remarks TEXT NULL AFTER status;
