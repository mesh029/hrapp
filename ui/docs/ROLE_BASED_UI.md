# Role-Based UI Rendering

**Date:** February 22, 2025  
**Purpose:** Define how different user roles see and interact with the HR Management System UI

---

## Overview

The HR Management System uses **role-based UI rendering** to provide different experiences based on user roles and permissions. This ensures that:
- **Administrators** see management and oversight features
- **Regular Employees** see their personal HR tasks
- **Managers** see team management features
- Each user only sees what they need and have permission to access

---

## User Roles

### 1. System Administrator (Admin)

**Role Identifier:** User has a role with "admin" in the name or has `system.admin` permission

**What They See:**
- **Dashboard:**
  - System-wide statistics (total users, all pending items)
  - Admin-focused quick actions (Create User, Manage Users, View Approvals, View Reports)
  - System overview metrics
  - All pending approvals across the organization

- **Navigation:**
  - ✅ Dashboard
  - ✅ Users (full access)
  - ✅ Leave (can view all, manage balances)
  - ✅ Timesheets (can view all, manage)
  - ✅ Workflows (manage templates, view all instances)
  - ✅ Reports (all reports and analytics)
  - ✅ Configuration (locations, staff types, work hours, holidays)
  - ✅ Administration (roles, permissions, delegations, audit logs)
  - ✅ Profile

- **Key Features:**
  - Create and manage all users
  - Bulk user upload
  - View and approve all leave requests
  - View and manage all timesheets
  - Configure system settings
  - Manage roles and permissions
  - View audit logs
  - Access all reports

- **What They DON'T See:**
  - ❌ Personal "Create Leave Request" button on dashboard (they manage all requests, not create personal ones)
  - ❌ Personal "Create Timesheet" button on dashboard (they manage all timesheets, not create personal ones)
  - ❌ "My Leave Requests" (they see "All Leave Requests" instead)
  - ❌ "My Timesheets" (they see "All Timesheets" instead)
  - ❌ Personal task-focused quick actions

---

### 2. Regular Employee

**Role Identifier:** User without admin role

**What They See:**
- **Dashboard:**
  - Personal statistics (their own pending items)
  - Employee-focused quick actions (Create Leave Request, Create Timesheet, My Requests, My Timesheets)
  - Personal overview

- **Navigation:**
  - ✅ Dashboard
  - ❌ Users (hidden)
  - ✅ Leave (their own requests and balances)
  - ✅ Timesheets (their own timesheets)
  - ❌ Workflows (hidden)
  - ❌ Reports (hidden)
  - ❌ Configuration (hidden)
  - ❌ Administration (hidden)
  - ✅ Profile

- **Key Features:**
  - Create their own leave requests
  - Create and submit their own timesheets
  - View their leave balances
  - View their leave request history
  - View their timesheet history
  - Update their profile

- **What They DON'T See:**
  - User management
  - System configuration
  - Reports and analytics
  - Workflow management
  - Administration features
  - Other users' data (unless they're a manager)

---

### 3. Manager

**Role Identifier:** User with manager permissions (has direct reports or `leave.approve`/`timesheet.approve` permissions)

**What They See:**
- **Dashboard:**
  - Team statistics (their direct reports' pending items)
  - Manager-focused quick actions (Approve Requests, View Team Reports)
  - Team overview

- **Navigation:**
  - ✅ Dashboard
  - ❌ Users (hidden, unless also admin)
  - ✅ Leave (their own + team members' requests)
  - ✅ Timesheets (their own + team members' timesheets)
  - ✅ Workflows (pending approvals for their team)
  - ✅ Reports (team-level reports)
  - ❌ Configuration (hidden)
  - ❌ Administration (hidden)
  - ✅ Profile

- **Key Features:**
  - All employee features PLUS:
  - Approve/reject leave requests for their team
  - Approve/reject timesheets for their team
  - View team leave balances
  - View team timesheet summaries
  - View pending approvals for their team

---

## Implementation

### 1. Role Detection Hook

Use the `useUserRole` hook to detect user role:

```typescript
import { useUserRole } from '@/ui/src/hooks/use-user-role';

function MyComponent() {
  const { isAdmin, roles, isLoading } = useUserRole();
  
  if (isLoading) return <Loading />;
  
  if (isAdmin) {
    // Render admin UI
  } else {
    // Render employee UI
  }
}
```

### 2. Conditional Rendering

**Navigation Items:**
```typescript
const navigationItems = allNavigationItems.filter(item => 
  !item.adminOnly || isAdmin
);
```

**Dashboard Cards:**
```typescript
{isAdmin ? (
  <AdminDashboardCards />
) : (
  <EmployeeDashboardCards />
)}
```

**Quick Actions:**
```typescript
{isAdmin ? (
  <>
    <Button>Create User</Button>
    <Button>Manage Users</Button>
    <Button>View Approvals</Button>
  </>
) : (
  <>
    <Button>Create Leave Request</Button>
    <Button>Create Timesheet</Button>
    <Button>My Requests</Button>
  </>
)}
```

### 3. API Permission Checks

All API endpoints check permissions server-side. The UI should:
- Hide features the user can't access
- Show appropriate error messages if they try to access restricted features
- Redirect unauthorized users appropriately

---

## UI Component Guidelines

### Dashboard Cards

**Admin Dashboard:**
- Total Users
- Active Users
- Pending Leave Requests (all)
- Pending Timesheets (all)
- Pending Approvals (all)

**Employee Dashboard:**
- My Pending Leave Requests
- My Pending Timesheets
- My Leave Balance
- Recent Activity

**Manager Dashboard:**
- Team Pending Leave Requests
- Team Pending Timesheets
- My Pending Approvals
- Team Overview

### Navigation Menu

**Admin Navigation:**
- Full access to all sections
- Emphasis on management and configuration

**Employee Navigation:**
- Limited to personal features
- No access to admin sections

**Manager Navigation:**
- Personal features + team management
- Approval workflows visible

### Quick Actions

**Admin Quick Actions:**
- ✅ Create New User
- ✅ Manage Users
- ✅ View Pending Approvals
- ✅ View Reports
- ❌ **NO** "Create Leave Request" (admin manages all, doesn't create personal requests)
- ❌ **NO** "Create Timesheet" (admin manages all, doesn't create personal timesheets)

**Employee Quick Actions:**
- ✅ Create Leave Request
- ✅ Create Timesheet
- ✅ My Leave Requests
- ✅ My Timesheets
- ✅ View Leave Balance

**Manager Quick Actions:**
- ✅ Approve Leave Requests (for team)
- ✅ Approve Timesheets (for team)
- ✅ View Team Reports
- ✅ Create Leave Request (for self - if they're also an employee)
- ✅ Create Timesheet (for self - if they're also an employee)

---

## Best Practices

1. **Always Check Roles Client-Side AND Server-Side**
   - Client-side: Hide/show UI elements
   - Server-side: Enforce permissions in API

2. **Progressive Disclosure**
   - Show what users need, hide what they don't
   - Don't show disabled buttons - hide them instead

3. **Clear Visual Hierarchy**
   - Admin UI: Management-focused, data-heavy
   - Employee UI: Task-focused, action-oriented
   - Manager UI: Team-focused, approval-oriented

4. **Consistent Patterns**
   - Use `useUserRole` hook consistently
   - Filter navigation items the same way everywhere
   - Apply role checks at component level

5. **Error Handling**
   - If user tries to access restricted feature, show clear message
   - Redirect to appropriate page (e.g., dashboard)
   - Log unauthorized access attempts

---

## Future Enhancements

1. **Role-Based Dashboard Widgets**
   - Admins: System health, user activity, compliance metrics
   - Employees: Personal calendar, upcoming leave, timesheet reminders
   - Managers: Team calendar, approval queue, team performance

2. **Customizable Dashboards**
   - Allow users to customize their dashboard layout
   - Save preferences per role

3. **Permission Granularity**
   - More granular permissions (e.g., "users.read" but not "users.create")
   - UI adapts to specific permissions, not just roles

4. **Multi-Role Support**
   - Users can have multiple roles
   - UI shows union of all permissions

---

## Testing Checklist

- [ ] Admin sees all navigation items
- [ ] Employee sees only personal navigation items
- [ ] Manager sees team + personal navigation items
- [ ] Admin dashboard shows system-wide stats
- [ ] Employee dashboard shows personal stats
- [ ] Quick actions are role-appropriate
- [ ] Hidden features are truly hidden (not just disabled)
- [ ] API calls respect permissions
- [ ] Error messages are user-friendly
- [ ] Navigation updates when role changes

---

**Last Updated:** February 22, 2025
