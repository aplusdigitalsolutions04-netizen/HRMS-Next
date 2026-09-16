-- Phase 3: Soft-delete employees instead of hard-deleting them.
ALTER TABLE employees ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
ALTER TABLE employees ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted;
