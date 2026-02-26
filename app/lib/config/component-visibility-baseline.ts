export type RoleProfile =
  | 'system_admin'
  | 'hr_manager'
  | 'program_officer'
  | 'manager'
  | 'employee';

export interface KnownComponent {
  id: string;
  name: string;
  module: string;
}

export const KNOWN_COMPONENTS: KnownComponent[] = [
  // Dashboard
  { id: 'dashboard.stats.total-users', name: 'Total Users Card', module: 'Dashboard' },
  { id: 'dashboard.stats.active-users', name: 'Active Users Card', module: 'Dashboard' },
  { id: 'dashboard.stats.pending-leave', name: 'Pending Leave Requests Card', module: 'Dashboard' },
  { id: 'dashboard.stats.pending-timesheets', name: 'Pending Timesheets Card', module: 'Dashboard' },
  { id: 'dashboard.stats.pending-approvals', name: 'Pending Approvals Card', module: 'Dashboard' },
  { id: 'dashboard.actions.create-user', name: 'Create New User Button', module: 'Dashboard' },
  { id: 'dashboard.actions.manage-users', name: 'Manage Users Button', module: 'Dashboard' },
  { id: 'dashboard.actions.create-leave', name: 'Create Leave Request Button', module: 'Dashboard' },
  { id: 'dashboard.actions.approve-leave', name: 'Approve Leave Requests Button', module: 'Dashboard' },
  { id: 'dashboard.actions.create-timesheet', name: 'Create Timesheet Button', module: 'Dashboard' },
  { id: 'dashboard.actions.approve-timesheets', name: 'Approve Timesheets Button', module: 'Dashboard' },
  { id: 'dashboard.actions.view-reports', name: 'View Reports Button', module: 'Dashboard' },
  { id: 'dashboard.overview.system', name: 'System Overview Section', module: 'Dashboard' },
  { id: 'dashboard.overview.location', name: 'Location Overview Section', module: 'Dashboard' },
  { id: 'dashboard.overview.team', name: 'Team Overview Section', module: 'Dashboard' },
  { id: 'dashboard.overview.personal', name: 'Personal Overview Section', module: 'Dashboard' },
  { id: 'dashboard.quick-links', name: 'Quick Links Section', module: 'Dashboard' },

  // Navigation
  { id: 'nav.dashboard', name: 'Dashboard Link', module: 'Navigation' },
  { id: 'nav.users', name: 'Users Link', module: 'Navigation' },
  { id: 'nav.leave', name: 'Leave Link', module: 'Navigation' },
  { id: 'nav.timesheets', name: 'Timesheets Link', module: 'Navigation' },
  { id: 'nav.workflows', name: 'Workflows Link', module: 'Navigation' },
  { id: 'nav.approvals', name: 'Pending Approvals Link', module: 'Navigation' },
  { id: 'nav.reports', name: 'Reports Link', module: 'Navigation' },
  { id: 'nav.administration', name: 'Administration Link', module: 'Navigation' },
  { id: 'nav.profile', name: 'Profile Link', module: 'Navigation' },

  // Leave
  { id: 'leave.create.button', name: 'Create Leave Request Button', module: 'Leave' },
  { id: 'leave.create.form', name: 'Create Leave Request Form', module: 'Leave' },
  { id: 'leave.list.view', name: 'Leave Requests List', module: 'Leave' },
  { id: 'leave.edit.action', name: 'Edit Leave Request', module: 'Leave' },
  { id: 'leave.approve.action', name: 'Approve Leave Request', module: 'Leave' },
  { id: 'leave.decline.action', name: 'Decline Leave Request', module: 'Leave' },
  { id: 'leave.balances.view', name: 'Leave Balances View', module: 'Leave' },
  { id: 'leave.types.view', name: 'Leave Types View', module: 'Leave' },

  // Timesheets
  { id: 'timesheet.create.button', name: 'Create Timesheet Button', module: 'Timesheet' },
  { id: 'timesheet.create.form', name: 'Create Timesheet Form', module: 'Timesheet' },
  { id: 'timesheet.list.view', name: 'Timesheets List', module: 'Timesheet' },
  { id: 'timesheet.edit.action', name: 'Edit Timesheet', module: 'Timesheet' },
  { id: 'timesheet.submit.action', name: 'Submit Timesheet', module: 'Timesheet' },
  { id: 'timesheet.delete.action', name: 'Delete Timesheet', module: 'Timesheet' },
  { id: 'timesheet.weekend-extra.button', name: 'Request Weekend Extra Button', module: 'Timesheet' },
  { id: 'timesheet.overtime.button', name: 'Request Overtime Button', module: 'Timesheet' },
  { id: 'timesheet.approve.action', name: 'Approve Timesheet', module: 'Timesheet' },
  { id: 'timesheet.decline.action', name: 'Decline Timesheet', module: 'Timesheet' },

  // Users
  { id: 'users.create.button', name: 'Create User Button', module: 'Users' },
  { id: 'users.bulk.upload', name: 'Bulk User Upload', module: 'Users' },
  { id: 'users.list.view', name: 'Users List', module: 'Users' },
  { id: 'users.edit.action', name: 'Edit User', module: 'Users' },
  { id: 'users.delete.action', name: 'Delete User', module: 'Users' },
  { id: 'users.view.detail', name: 'User Detail View', module: 'Users' },
  { id: 'users.assign.roles', name: 'Assign Roles to User', module: 'Users' },

  // Workflows
  { id: 'workflows.list.view', name: 'Workflows List', module: 'Workflows' },
  { id: 'workflows.templates.create', name: 'Create Workflow Template', module: 'Workflows' },
  { id: 'workflows.templates.edit', name: 'Edit Workflow Template', module: 'Workflows' },
  { id: 'workflows.templates.delete', name: 'Delete Workflow Template', module: 'Workflows' },
  { id: 'workflows.simulator.view', name: 'Workflow Simulator', module: 'Workflows' },
  { id: 'workflows.approve.action', name: 'Approve Workflow Step', module: 'Workflows' },
  { id: 'workflows.decline.action', name: 'Decline Workflow Step', module: 'Workflows' },

  // Reports
  { id: 'reports.dashboard.view', name: 'Reports Dashboard', module: 'Reports' },
  { id: 'reports.leave.view', name: 'Leave Reports', module: 'Reports' },
  { id: 'reports.timesheet.view', name: 'Timesheet Reports', module: 'Reports' },
  { id: 'reports.export.action', name: 'Export Reports', module: 'Reports' },

  // Administration
  { id: 'admin.roles.view', name: 'Roles Management', module: 'Administration' },
  { id: 'admin.roles.create', name: 'Create Role', module: 'Administration' },
  { id: 'admin.roles.edit', name: 'Edit Role', module: 'Administration' },
  { id: 'admin.roles.delete', name: 'Delete Role', module: 'Administration' },
  { id: 'admin.permissions.view', name: 'Permissions View', module: 'Administration' },
  { id: 'admin.locations.view', name: 'Locations Management', module: 'Administration' },
  { id: 'admin.locations.create', name: 'Create Location', module: 'Administration' },
  { id: 'admin.locations.edit', name: 'Edit Location', module: 'Administration' },
  { id: 'admin.locations.delete', name: 'Delete Location', module: 'Administration' },
  { id: 'admin.workflow-assignments.view', name: 'Workflow Assignments', module: 'Administration' },
  { id: 'admin.workflow-assignments.create', name: 'Create Workflow Assignment', module: 'Administration' },
  { id: 'admin.component-visibility.view', name: 'Component Visibility', module: 'Administration' },
  { id: 'admin.user-categories.view', name: 'User Categories', module: 'Administration' },
];

const baseAllUsers = new Set<string>([
  'nav.dashboard',
  'nav.leave',
  'nav.timesheets',
  'nav.profile',
  'dashboard.stats.pending-leave',
  'dashboard.stats.pending-timesheets',
  'dashboard.quick-links',
  'dashboard.overview.personal',
  'leave.create.button',
  'leave.create.form',
  'leave.list.view',
  'leave.edit.action',
  'timesheet.create.button',
  'timesheet.create.form',
  'timesheet.list.view',
  'timesheet.edit.action',
  'timesheet.submit.action',
  'timesheet.weekend-extra.button',
  'timesheet.overtime.button',
]);

const managerAndUp = new Set<string>([
  'nav.users',
  'nav.workflows',
  'nav.approvals',
  'dashboard.stats.total-users',
  'dashboard.stats.active-users',
  'dashboard.stats.pending-approvals',
  'dashboard.actions.approve-leave',
  'dashboard.actions.approve-timesheets',
  'dashboard.overview.team',
  'users.list.view',
  'users.view.detail',
  'workflows.list.view',
  'workflows.simulator.view',
  'workflows.approve.action',
  'workflows.decline.action',
  'leave.approve.action',
  'leave.decline.action',
  'timesheet.approve.action',
  'timesheet.decline.action',
]);

const hrAndUp = new Set<string>([
  'nav.reports',
  'dashboard.actions.manage-users',
  'dashboard.actions.view-reports',
  'dashboard.overview.location',
  'reports.dashboard.view',
  'reports.leave.view',
  'reports.timesheet.view',
  'reports.export.action',
  'users.create.button',
  'users.bulk.upload',
  'users.edit.action',
  'users.assign.roles',
  'leave.balances.view',
  'leave.types.view',
  'timesheet.delete.action',
  'workflows.templates.create',
  'workflows.templates.edit',
  'workflows.templates.delete',
]);

const adminOnly = new Set<string>([
  'nav.administration',
  'dashboard.actions.create-user',
  'dashboard.overview.system',
  'admin.roles.view',
  'admin.roles.create',
  'admin.roles.edit',
  'admin.roles.delete',
  'admin.permissions.view',
  'admin.locations.view',
  'admin.locations.create',
  'admin.locations.edit',
  'admin.locations.delete',
  'admin.workflow-assignments.view',
  'admin.workflow-assignments.create',
  'admin.component-visibility.view',
  'admin.user-categories.view',
  'users.delete.action',
]);

export function resolveRoleProfile(roleName: string): RoleProfile {
  const normalized = roleName.toLowerCase();

  if (normalized.includes('system admin') || normalized.includes('administrator')) {
    return 'system_admin';
  }
  if (normalized.includes('hr manager') || (normalized.includes('hr') && normalized.includes('manager'))) {
    return 'hr_manager';
  }
  if (normalized.includes('program officer')) {
    return 'program_officer';
  }
  if (normalized.includes('manager')) {
    return 'manager';
  }
  return 'employee';
}

export function isComponentVisibleForProfile(componentId: string, profile: RoleProfile): boolean {
  if (profile === 'system_admin') {
    return true;
  }

  if (profile === 'hr_manager') {
    return baseAllUsers.has(componentId) || managerAndUp.has(componentId) || hrAndUp.has(componentId);
  }

  if (profile === 'program_officer') {
    return baseAllUsers.has(componentId) || managerAndUp.has(componentId);
  }

  if (profile === 'manager') {
    return baseAllUsers.has(componentId) || managerAndUp.has(componentId);
  }

  return baseAllUsers.has(componentId);
}
