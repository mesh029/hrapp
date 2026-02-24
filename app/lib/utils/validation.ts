import { z } from 'zod';

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Refresh token request schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

/**
 * Staff type schemas
 */
export const createStaffTypeSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateStaffTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Leave type schemas
 */
export const createLeaveTypeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  is_paid: z.boolean().default(true),
  max_days_per_year: z.number().int().positive().nullable().optional(),
  accrual_rule: z.string().optional(), // JSON string
});

export const updateLeaveTypeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  is_paid: z.boolean().optional(),
  max_days_per_year: z.number().int().positive().nullable().optional(),
  accrual_rule: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * Work hours configuration schemas
 */
export const createWorkHoursConfigSchema = z.object({
  location_id: z.string().uuid().nullable().optional(),
  staff_type_id: z.string().uuid().nullable().optional(),
  day_of_week: z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
  hours: z.number().nonnegative().max(24),
  is_active: z.boolean().default(true),
}).refine(
  (data) => data.location_id || data.staff_type_id,
  { message: 'Either location_id or staff_type_id must be provided' }
);

export const updateWorkHoursConfigSchema = z.object({
  day_of_week: z.number().int().min(0).max(6).optional(),
  hours: z.number().nonnegative().max(24).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Workflow template schemas
 */
export const createWorkflowTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  resource_type: z.enum(['leave', 'timesheet']),
  location_id: z.string().uuid(),
  is_area_wide: z.boolean().default(false).optional(), // If true, template applies area-wide (all locations)
  staff_type_id: z.string().uuid().nullable().optional(), // Optional: filter by employee type
  leave_type_id: z.string().uuid().nullable().optional(), // Optional: filter by leave type (only for leave workflows)
  steps: z.array(z.object({
    step_order: z.number().int().positive(),
    required_permission: z.string().min(1),
    allow_decline: z.boolean().default(true),
    allow_adjust: z.boolean().default(false),
  })).min(1, 'At least one step is required'),
}).refine(
  (data) => {
    // leave_type_id should only be set for leave workflows
    if (data.leave_type_id && data.resource_type !== 'leave') {
      return false;
    }
    return true;
  },
  { message: 'leave_type_id can only be set for leave workflows' }
);

export const updateWorkflowTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['active', 'deprecated']).optional(),
  is_area_wide: z.boolean().optional(), // If true, template applies area-wide (all locations)
  staff_type_id: z.string().uuid().nullable().optional(),
  leave_type_id: z.string().uuid().nullable().optional(),
});

/**
 * Workflow step schemas
 */
export const createWorkflowStepSchema = z.object({
  step_order: z.number().int().positive(),
  required_permission: z.string().min(1),
  allow_decline: z.boolean().default(true),
  allow_adjust: z.boolean().default(false),
  // Approver Resolution Configuration
  approver_strategy: z.enum(['permission', 'manager', 'role', 'combined']).optional().default('permission'),
  include_manager: z.boolean().optional().default(false),
  required_roles: z.array(z.string().uuid()).optional().nullable(),
  location_scope: z.enum(['same', 'parent', 'descendants', 'all']).optional().default('same'),
  conditional_rules: z.array(z.any()).optional().nullable(), // Allow any structure for conditional_rules (includes _metadata)
});

export const updateWorkflowStepSchema = z.object({
  step_order: z.number().int().positive().optional(),
  required_permission: z.string().min(1).optional(),
  allow_decline: z.boolean().optional(),
  allow_adjust: z.boolean().optional(),
  approver_strategy: z.enum(['permission', 'manager', 'role', 'combined']).optional(),
  include_manager: z.boolean().optional(),
  required_roles: z.array(z.string().uuid()).optional().nullable(),
  location_scope: z.enum(['same', 'parent', 'descendants', 'all']).optional(),
  conditional_rules: z.array(z.any()).optional().nullable(), // Allow any structure for conditional_rules (includes _metadata)
});

/**
 * Workflow instance action schemas
 */
export const approveWorkflowSchema = z.object({
  comment: z.string().optional(),
});

export const declineWorkflowSchema = z.object({
  comment: z.string().min(1, 'Comment is required for decline'),
});

export const adjustWorkflowSchema = z.object({
  comment: z.string().min(1, 'Comment is required for adjust'),
  route_to_step: z.number().int().nonnegative().optional(), // Route to specific step, or null to route to employee
});

/**
 * Leave request schemas
 */
export const createLeaveRequestSchema = z.object({
  leave_type_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().optional(),
  location_id: z.string().uuid(),
}).refine(
  (data) => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    return start <= end;
  },
  { message: 'Start date must be before or equal to end date' }
);

export const updateLeaveRequestSchema = z.object({
  leave_type_id: z.string().uuid().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  reason: z.string().optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      return start <= end;
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date' }
);

/**
 * Leave balance allocation schema
 */
export const allocateLeaveBalanceSchema = z.object({
  user_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  year: z.number().int().min(2000).max(3000),
  days: z.number().positive(),
});

/**
 * Holiday schemas
 */
export const createHolidaySchema = z.object({
  name: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  location_id: z.string().uuid().nullable().optional(),
  hours: z.number().nonnegative().max(24).optional(),
});

export const updateHolidaySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  hours: z.number().nonnegative().max(24).optional(),
});

/**
 * Weekend extra request schemas
 */
export const createWeekendExtraRequestSchema = z.object({
  timesheet_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  requested_hours: z.number().positive().max(24),
  reason: z.string().min(1).max(1000),
});

export const approveWeekendExtraSchema = z.object({
  comment: z.string().optional(),
});

export const declineWeekendExtraSchema = z.object({
  declined_reason: z.string().min(1, 'Decline reason is required'),
});

/**
 * Overtime request schemas
 */
export const createOvertimeRequestSchema = z.object({
  timesheet_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  requested_hours: z.number().positive().max(24),
  reason: z.string().min(1).max(1000),
});

export const approveOvertimeSchema = z.object({
  comment: z.string().optional(),
});

export const declineOvertimeSchema = z.object({
  declined_reason: z.string().min(1, 'Decline reason is required'),
});

/**
 * Timesheet schemas
 */
export const createTimesheetSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  location_id: z.string().uuid(),
}).refine(
  (data) => {
    const start = new Date(data.period_start);
    const end = new Date(data.period_end);
    return start <= end;
  },
  { message: 'Period start must be before or equal to period end' }
);

export const updateTimesheetEntriesSchema = z.object({
  entries: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    work_hours: z.number().nonnegative().max(24),
    description: z.string().optional(),
  })).min(1, 'At least one entry is required'),
});

/**
 * Timesheet period schemas
 */
export const enableTimesheetSubmissionSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  submission_enabled: z.boolean(),
}).refine(
  (data) => {
    const start = new Date(data.period_start);
    const end = new Date(data.period_end);
    return start <= end;
  },
  { message: 'Period start must be before or equal to period end' }
);

/**
 * Leave accrual config schemas
 */
export const createLeaveAccrualConfigSchema = z.object({
  leave_type_id: z.string().uuid(),
  location_id: z.string().uuid().nullable().optional(),
  staff_type_id: z.string().uuid().nullable().optional(),
  accrual_rate: z.number().positive().max(365), // Max 365 days per period
  accrual_period: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
  is_active: z.boolean().default(true),
});

export const updateLeaveAccrualConfigSchema = z.object({
  accrual_rate: z.number().positive().max(365).optional(),
  accrual_period: z.enum(['monthly', 'quarterly', 'annual']).optional(),
  is_active: z.boolean().optional(),
});

/**
 * Leave balance reset schemas
 */
export const resetLeaveBalanceSchema = z.object({
  user_id: z.string().uuid(),
  leave_type_id: z.string().uuid().nullable().optional(), // null = all leave types
  reason: z.string().min(1).max(1000),
});

/**
 * Leave balance adjustment schemas
 */
export const adjustLeaveBalanceSchema = z.object({
  user_id: z.string().uuid(),
  leave_type_id: z.string().uuid(),
  year: z.number().int().min(2000).max(3000),
  days: z.number(), // Positive = add, Negative = subtract
  reason: z.string().min(1).max(1000),
});

/**
 * Contract management schemas
 */
export const updateContractSchema = z.object({
  contract_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').nullable().optional(),
  contract_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').nullable().optional(),
});

/**
 * Delegation schemas
 */
export const createDelegationSchema = z.object({
  delegate_user_id: z.string().uuid('Invalid delegate user ID'),
  permission_id: z.string().uuid('Invalid permission ID'),
  location_id: z.string().uuid('Invalid location ID').nullable().optional(),
  include_descendants: z.boolean().default(false),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date(),
  delegator_user_id: z.string().uuid('Invalid delegator user ID').optional(), // For admin delegation
}).refine((data) => data.valid_until > data.valid_from, {
  message: 'valid_until must be after valid_from',
  path: ['valid_until'],
});

/**
 * Notification schemas
 */
export const markNotificationReadSchema = z.object({
  notificationIds: z.array(z.string().uuid('Invalid notification ID')).optional(),
  markAll: z.boolean().default(false),
});

/**
 * Audit log filter schemas
 */
export const auditLogFilterSchema = z.object({
  actor_id: z.string().uuid('Invalid actor ID').optional(),
  action: z.string().optional(),
  resource_type: z.string().optional(),
  resource_id: z.string().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
