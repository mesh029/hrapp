# User Switcher & UI Visibility Guide

## Overview

The system now includes:
1. **User Switcher**: Admins can quickly login as any user for testing
2. **Permission-Based UI**: Users only see features they have permission for
3. **Fixed Dropdowns**: Template assignment page now properly loads locations and templates

---

## 1. User Switcher (Quick Login)

### How to Use

1. **Login as Admin First**:
   - Use the "Quick Login as Admin" button on the login page
   - Or login normally with admin credentials

2. **Access User Switcher**:
   - On the login page, you'll see a collapsible "Quick Login (Admin Only)" section
   - Click to expand it

3. **Select a User**:
   - A dropdown shows all active users in the system
   - Select the user you want to login as

4. **Login as Selected User**:
   - Click "Login as Selected User"
   - You'll be instantly logged in as that user
   - You'll see their dashboard with their permissions

### Features

- **Admin Only**: Only users with `system.admin` permission can use this feature
- **Instant Switch**: No need to logout/login - just select and switch
- **Full Access**: You'll have the exact same permissions as the selected user
- **Testing**: Perfect for testing workflows, approvals, and notifications as different users

### API Endpoint

- **POST** `/api/admin/users/quick-login`
- **Body**: `{ userId: "user-uuid" }`
- **Requires**: `system.admin` permission

---

## 2. UI Visibility Based on Permissions

### How It Works

The system automatically hides/shows UI elements based on user permissions:

1. **Navigation Items**: Filtered by permissions
2. **Buttons/Actions**: Hidden if user doesn't have permission
3. **Pages**: Protected by permission checks
4. **Features**: Enabled/disabled based on permissions

### Navigation Filtering

The `useDynamicUI` hook automatically filters navigation items:

```typescript
// Navigation items are filtered based on permissions
const navigationItems = useDynamicUI().navigationItems;

// Only shows items the user has permission for:
// - Dashboard: Everyone
// - Users: users.read or system.admin
// - Leave: leave.read, leave.create, leave.approve, or system.admin
// - Timesheets: timesheet.read, timesheet.create, timesheet.approve, or system.admin
// - Workflows: workflows.read, workflows.manage, or system.admin
// - Administration: system.admin, roles.manage, or permissions.manage
```

### Component Visibility

Individual components use `useComponentVisibility`:

```typescript
const { isVisible, isEnabled } = useComponentVisibility('leave.create.button', {
  fallbackPermission: 'leave.create',
  fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
});

if (!isVisible) return null; // Component hidden
```

### What Regular Employees See

**Regular employees** (without admin permissions) see:
- ✅ Dashboard
- ✅ Leave (create/view own)
- ✅ Timesheets (create/view own)
- ✅ Pending Approvals (if they have approve permission)
- ✅ Profile
- ❌ Users (hidden - no users.read)
- ❌ Administration (hidden - no system.admin)
- ❌ Workflows (hidden - no workflows.read)
- ❌ Reports (hidden - no reports.read)
- ❌ Configuration (hidden - no config.manage)

### What Admins See

**System Administrators** see:
- ✅ Everything regular employees see
- ✅ Users (can manage all users)
- ✅ Administration (full admin access)
- ✅ Workflows (can manage templates)
- ✅ Reports (can view all reports)
- ✅ Configuration (can manage settings)

### Permission-Based Features

The `features` object from `useDynamicUI` provides boolean flags:

```typescript
const { features } = useDynamicUI();

features.canCreateUsers      // true/false
features.canApproveLeave     // true/false
features.canCreateTimesheet  // true/false
features.canManageWorkflows  // true/false
features.isAdmin            // true/false
// etc.
```

---

## 3. Fixed Dropdowns in Template Assignment

### What Was Fixed

1. **Better Error Handling**: 
   - Added try-catch blocks
   - Better error messages
   - Loading states

2. **Response Parsing**:
   - Handles different API response formats
   - Supports both array and object responses
   - Handles nested data structures

3. **User Feedback**:
   - Shows "Loading..." when fetching data
   - Shows "No locations found" if empty
   - Shows "No templates found" if empty
   - Displays helpful error messages

### How It Works Now

1. **Locations Dropdown**:
   - Fetches from `/api/locations?tree=false`
   - Parses response (handles `locations`, `flat`, or array format)
   - Shows all active locations
   - Disabled if no locations found

2. **Templates Dropdown**:
   - Fetches from `/api/workflows/templates?resource_type=leave&status=active`
   - Filters by resource type (leave/timesheet)
   - Shows template name with area-wide indicator
   - Disabled if no templates found

---

## 4. Testing the System

### Test User Switcher

1. Login as admin
2. Go to login page (or refresh)
3. Expand "Quick Login (Admin Only)"
4. Select a regular employee
5. Click "Login as Selected User"
6. Verify you see their limited UI (no admin features)

### Test UI Visibility

1. Login as regular employee
2. Check navigation sidebar:
   - Should NOT see "Administration"
   - Should NOT see "Workflows" (unless they have permission)
   - Should see "Leave", "Timesheets", "Dashboard"
3. Try accessing admin URLs directly:
   - `/administration` → Should be blocked or show "No permission"
   - `/workflows/templates` → Should be blocked

### Test Template Assignment

1. Login as admin
2. Go to Administration → Template Assignments
3. Click "Assign Template"
4. Verify:
   - Location dropdown shows all locations
   - Template dropdown shows all templates for selected resource type
   - Can select and assign successfully

---

## Summary

✅ **User Switcher**: Admins can quickly test as different users  
✅ **UI Visibility**: Features automatically hidden based on permissions  
✅ **Fixed Dropdowns**: Template assignment page now works correctly  
✅ **Permission-Based**: Everything respects user permissions  
✅ **Admin Control**: Admins can configure component visibility  

The system ensures that:
- Regular employees only see what they need
- Admins can test as any user
- UI adapts automatically to permissions
- No hard-coded role checks (all permission-based)
