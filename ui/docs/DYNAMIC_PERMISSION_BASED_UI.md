# Dynamic Permission-Based UI System

**Date:** February 22, 2025  
**Purpose:** Scalable UI system that adapts based on user permissions and admin-configured visibility rules

---

## Overview

The HR Management System uses a **dynamic permission-based UI** that adapts in real-time based on:
1. **User Permissions:** Granular permission checks
2. **Admin Configuration:** Component visibility rules per user category
3. **Fallback Logic:** Permission-based checks when no admin config exists

This allows for:

- **Flexible User Categories:** Different user types (Jr, Sr, Manager, Admin, etc.) see different features
- **Admin-Configurable:** Admins can enable/disable UI components for different user categories without code changes
- **Granular Control:** Component-level visibility control
- **Scalable Architecture:** New permissions automatically reflect in the UI
- **No Hard-Coded Roles:** UI adapts to permission changes without code changes

---

## ⚠️ IMPORTANT: Component Visibility System

**Every configurable UI component MUST use the `useComponentVisibility` hook.**

This allows admins to configure component visibility for different user categories. See [ADMIN_CONFIGURABLE_UI.md](./ADMIN_CONFIGURABLE_UI.md) for complete documentation.

**Quick Start:**
```typescript
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';

const { isVisible, isEnabled } = useComponentVisibility('leave.create.button', {
  fallbackPermission: 'leave.create',
  fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
});

if (!isVisible) return null;
```

---

## How It Works

### 1. Permission Detection

The system fetches user permissions from the API and determines UI visibility:

```typescript
const { features, navigationItems } = useDynamicUI();

// Features object contains boolean flags for each capability
features.canCreateUsers      // true/false
features.canApproveLeave     // true/false
features.canCreateTimesheet  // true/false
// etc.
```

### 2. Dynamic Navigation

Navigation items are automatically filtered based on permissions:

```typescript
// Navigation items are dynamically generated
// Each item requires specific permissions
navigationItems = [
  { href: '/users', requiredPermissions: ['users.read'] },
  { href: '/leave', anyPermission: ['leave.read', 'leave.create', 'leave.approve'] },
  // etc.
]
```

### 3. Feature Flags

UI components check feature flags before rendering:

```typescript
{features.canCreateLeave && (
  <Button>Create Leave Request</Button>
)}

{features.canApproveLeave && (
  <Button>Approve Requests</Button>
)}
```

---

## Permission Categories

### System Permissions
- `system.admin` - Full system access (grants all permissions)

### User Management
- `users.read` - View users
- `users.create` - Create new users
- `users.update` - Edit users
- `users.delete` - Delete users
- `users.manage_roles` - Assign roles to users

### Leave Management
- `leave.read` - View leave requests
- `leave.create` - Create leave requests
- `leave.update` - Edit leave requests
- `leave.approve` - Approve/reject leave requests
- `leave.balances.manage` - Manage leave balances

### Timesheet Management
- `timesheet.read` - View timesheets
- `timesheet.create` - Create timesheets
- `timesheet.update` - Edit timesheets
- `timesheet.approve` - Approve/reject timesheets
- `timesheet.submit` - Submit timesheets

### Workflow Management
- `workflows.read` - View workflows
- `workflows.manage` - Manage workflow templates
- `workflows.approve` - Approve workflow steps

### Reports
- `reports.read` - View reports
- `reports.export` - Export reports

### Configuration
- `config.manage` - Manage system configuration
- `locations.manage` - Manage locations
- `staff_types.manage` - Manage staff types
- `work_hours.manage` - Manage work hours
- `holidays.manage` - Manage holidays

### Administration
- `roles.manage` - Manage roles
- `permissions.manage` - Manage permissions
- `delegations.manage` - Manage delegations
- `audit_logs.read` - View audit logs

---

## User Category Examples

### Junior Employee
**Permissions:**
- `leave.read`
- `leave.create`
- `timesheet.read`
- `timesheet.create`

**What They See:**
- ✅ Dashboard (personal stats)
- ✅ Leave (create requests, view own)
- ✅ Timesheets (create, view own)
- ✅ Profile
- ❌ No approval capabilities
- ❌ No user management
- ❌ No reports

### Senior Employee / Approver
**Permissions:**
- `leave.read`
- `leave.create`
- `leave.approve`
- `timesheet.read`
- `timesheet.create`
- `timesheet.approve`

**What They See:**
- ✅ All Junior Employee features PLUS:
- ✅ Approve Leave Requests
- ✅ Approve Timesheets
- ✅ View Pending Approvals
- ❌ Still no user management or reports

### Manager
**Permissions:**
- All Senior Employee permissions PLUS:
- `users.read` (for their team)
- `reports.read` (team reports)

**What They See:**
- ✅ All Senior Employee features PLUS:
- ✅ View Team Members
- ✅ Team Reports
- ✅ Team Leave Balances
- ❌ Still no system configuration

### Administrator
**Permissions:**
- `system.admin` (grants all)

**What They See:**
- ✅ Everything
- ✅ User Management
- ✅ System Configuration
- ✅ All Reports
- ✅ Administration Tools
- ❌ NO personal task creation buttons (they manage, not create for themselves)

---

## Implementation

### 1. Use `useDynamicUI` Hook

```typescript
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

function MyComponent() {
  const { features, navigationItems, isLoading } = useDynamicUI();
  
  if (isLoading) return <Loading />;
  
  return (
    <>
      {features.canCreateLeave && (
        <Button>Create Leave Request</Button>
      )}
      {features.canApproveLeave && (
        <Button>Approve Requests</Button>
      )}
    </>
  );
}
```

### 2. Check Individual Permissions

```typescript
import { usePermissions } from '@/ui/src/hooks/use-permissions';

function MyComponent() {
  const { hasPermission, hasAnyPermission } = usePermissions();
  
  if (hasPermission('leave.approve')) {
    // Show approval UI
  }
  
  if (hasAnyPermission(['leave.approve', 'timesheet.approve'])) {
    // Show approval section
  }
}
```

### 3. Dynamic Navigation

Navigation is automatically filtered - no manual filtering needed:

```typescript
// In MainLayout component
const { navigationItems } = useDynamicUI();

// navigationItems is already filtered based on permissions
navigationItems.map(item => (
  <SidebarItem href={item.href} label={item.label} />
))
```

---

## Excel Template Fix

### Issue
The Excel template was protected/read-only, preventing editing.

### Solution
- Removed worksheet protection
- Ensured all columns are editable
- Added proper formatting
- Added example rows with clear instructions

### Template Structure
- **Column 1:** Name (required)
- **Column 2:** Email (required)
- **Column 3:** Password (required, min 8 chars)
- **Column 4:** Staff Number (optional)
- **Column 5:** Charge Code (optional)
- **Column 6:** Primary Location ID (optional - can be left empty)
- **Column 7:** Manager Email (optional)
- **Column 8:** Status (active/suspended)

---

## Best Practices

1. **Always Use Feature Flags**
   - Don't hard-code role checks
   - Use `features.canXxx` flags
   - UI adapts automatically

2. **Permission-Based, Not Role-Based**
   - Check permissions, not role names
   - More flexible and scalable
   - Admins can configure without code changes

3. **Graceful Degradation**
   - If permission check fails, hide feature (don't show error)
   - User sees what they can access, nothing more

4. **Consistent Patterns**
   - Use `useDynamicUI` for navigation and major features
   - Use `usePermissions` for granular checks
   - Document permission requirements

5. **Admin Configuration**
   - Admins can assign permissions to roles
   - UI automatically adapts
   - No code changes needed for new user categories

---

## Future Enhancements

1. **Permission Groups**
   - Define permission groups (e.g., "Junior Employee", "Manager")
   - Assign groups to users
   - UI adapts to group permissions

2. **Custom Permission Sets**
   - Admins create custom permission sets
   - Assign to specific users or roles
   - UI reflects custom permissions

3. **Permission Inheritance**
   - Permissions can inherit from parent roles
   - UI shows union of all permissions

4. **Real-Time Permission Updates**
   - UI updates when permissions change
   - No page refresh needed

---

## Testing

- [ ] Junior employee sees only personal features
- [ ] Senior employee sees approval features
- [ ] Manager sees team management features
- [ ] Admin sees all features
- [ ] Navigation filters correctly
- [ ] Feature flags work correctly
- [ ] Excel template is editable
- [ ] Bulk upload works with template

---

**Last Updated:** February 22, 2025
