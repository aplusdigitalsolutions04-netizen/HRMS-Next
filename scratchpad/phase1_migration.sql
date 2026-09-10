-- Phase 1: Reporting hierarchy + generic Approval Engine

ALTER TABLE employees ADD COLUMN manager_id VARCHAR(36) NULL AFTER designation;
ALTER TABLE employees ADD CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TABLE approval_workflows (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  module_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE approval_workflow_steps (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  workflow_id VARCHAR(36) NOT NULL,
  step_order INT NOT NULL,
  approver_type VARCHAR(20) NOT NULL, -- MANAGER, HR, SPECIFIC_USER
  specific_user_id VARCHAR(36) NULL,
  label VARCHAR(100) NULL,
  FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE approval_actions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  request_type VARCHAR(50) NOT NULL,
  request_id VARCHAR(36) NOT NULL,
  step_order INT NOT NULL,
  actor_type VARCHAR(20) NOT NULL, -- employee, admin
  actor_id VARCHAR(36) NOT NULL,
  actor_name VARCHAR(150) NULL,
  action VARCHAR(20) NOT NULL, -- APPROVED, REJECTED
  remarks TEXT NULL,
  acted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_request (request_type, request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE leave_requests ADD COLUMN current_step INT DEFAULT NULL;
ALTER TABLE leave_requests ADD COLUMN workflow_id VARCHAR(36) NULL;
