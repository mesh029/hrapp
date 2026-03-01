-- Performance Optimization: Add Critical Composite Indexes
-- These indexes improve query performance without changing any business logic
-- Risk Level: Very Low - Indexes only affect query speed, not data or behavior

-- 1. UserPermissionScope: Optimize active scope lookups with time filtering
-- Used in: app/lib/services/authority.ts (line 151-164)
-- Query pattern: WHERE user_id = ? AND permission.name = ? AND status = 'active' AND valid_from <= ? AND (valid_until IS NULL OR valid_until >= ?)
CREATE INDEX IF NOT EXISTS "user_permission_scopes_user_permission_active_time_idx" 
ON "user_permission_scopes"("user_id", "permission_id", "status", "valid_from", "valid_until") 
WHERE "status" = 'active';

-- 2. Delegation: Optimize active delegation lookups with time filtering
-- Used in: app/lib/services/authority.ts (line 205-214)
-- Query pattern: WHERE delegate_user_id = ? AND permission.name = ? AND status = 'active' AND valid_from <= ? AND valid_until >= ?
CREATE INDEX IF NOT EXISTS "delegations_delegate_permission_active_time_idx" 
ON "delegations"("delegate_user_id", "permission_id", "status", "valid_from", "valid_until") 
WHERE "status" = 'active';

-- 3. WorkflowInstance: Optimize resource-based queries
-- Used in: Workflow resolution and pending approvals
-- Query pattern: WHERE resource_type = ? AND resource_id = ? AND status = ? AND current_step_order = ?
CREATE INDEX IF NOT EXISTS "workflow_instances_resource_status_step_idx" 
ON "workflow_instances"("resource_type", "resource_id", "status", "current_step_order");

-- 4. LeaveRequest: Optimize user + date range queries
-- Used in: app/lib/services/timesheet.ts (line 81-94) - finding approved leaves for timesheet period
-- Query pattern: WHERE user_id = ? AND start_date <= ? AND end_date >= ? AND status = ? AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS "leave_requests_user_date_range_status_idx" 
ON "leave_requests"("user_id", "start_date", "end_date", "status", "deleted_at") 
WHERE "deleted_at" IS NULL;

-- 5. TimesheetEntry: Optimize date range queries
-- Used in: Timesheet reporting and date-based filtering
-- Query pattern: WHERE date >= ? AND date <= ? AND timesheet_id = ?
CREATE INDEX IF NOT EXISTS "timesheet_entries_date_range_timesheet_idx" 
ON "timesheet_entries"("date", "timesheet_id");
