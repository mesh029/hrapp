# UserPermissionScope Explained

## What is UserPermissionScope?

`UserPermissionScope` is a database table that tracks **WHERE** and **WHEN** a user can use a specific permission. It's different from `RolePermission`, which only says "this role has this permission."

### The Two-Layer Permission System

Your system uses a **two-layer permission model**:

1. **RolePermission** (Layer 1): Links roles to permissions
   - Example: "HR Assistant role has `timesheet.approve` permission"
   - This is what you see when you assign permissions to roles

2. **UserPermissionScope** (Layer 2): Defines WHERE and WHEN users can use permissions
   - Example: "User X can use `timesheet.approve` at Location Y from Date A to Date B"
   - This is what the `checkAuthority` function requires

### Why Both Are Needed

The `checkAuthority` function requires **both** layers to authorize a user:

```typescript
// Step 1: Check if user's role has the permission (RolePermission)
if (!rolePermissions.has(permission)) {
  return { authorized: false };
}

// Step 2: Check if user has an active scope for that permission (UserPermissionScope)
const scopes = await prisma.userPermissionScope.findMany({...});
if (!scopes.some(scope => locationMatch)) {
  return { authorized: false };
}
```

### The Problem

When you assign a permission to a role (e.g., `timesheet.approve` to "HR Assistant"), the system creates a `RolePermission` entry, but **doesn't automatically create `UserPermissionScope` entries** for users who already have that role.

This means:
- ✅ Users have the permission through their role (Layer 1)
- ❌ Users don't have scopes to actually use it (Layer 2)
- ❌ `checkAuthority` fails, so users can't approve

## The Solution

We've implemented **automatic scope synchronization** that:

1. **When a permission is assigned to a role**: Automatically creates `UserPermissionScope` entries for all users who have that role
2. **When a role is assigned to a user**: Automatically creates `UserPermissionScope` entries for all permissions that role has
3. **When a permission is removed from a role**: Cleans up scopes (only if user doesn't have permission through another role)
4. **When a role is removed from a user**: Cleans up scopes (only if user doesn't have permission through another role)

### How It Works

The sync happens automatically in these API endpoints:

- `POST /api/roles/[id]/permissions` - When assigning permission to role
- `POST /api/users/[id]/roles` - When assigning role to user
- `DELETE /api/roles/[id]/permissions/[permissionId]` - When removing permission from role
- `DELETE /api/users/[id]/roles/[roleId]` - When removing role from user

### Scope Creation Rules

When creating scopes automatically, the system uses these rules:

- **Location**: Uses the user's `primary_location_id` if they have one
- **Global**: If user has no location, creates a global scope (`is_global: true`)
- **Valid From**: Current date/time
- **Valid Until**: `null` (no expiration)
- **Include Descendants**: `false` (can be changed manually if needed)

## Backfilling Existing Users

For users who already have roles assigned, run the backfill script:

```bash
npm run backfill:user-scopes
```

This will:
- Find all active users
- Get all permissions from their roles
- Create `UserPermissionScope` entries for any missing ones
- Skip existing scopes (won't create duplicates)

## Workflow Resolution Bypass

Even with the automatic sync, we've also added a **bypass for role-based workflow steps**:

If a user has the required role with the required permission, they will be included as an approver **even if they don't have a UserPermissionScope entry**. This ensures workflow resolution works correctly.

However, for actual approval actions, the `checkAuthority` function still requires scopes. So it's best to have scopes created automatically.

## Summary

**Before the fix:**
- Assign permission to role → Only creates RolePermission
- Users can't approve because they lack UserPermissionScope entries

**After the fix:**
- Assign permission to role → Creates RolePermission + UserPermissionScope for all users with that role
- Assign role to user → Creates UserPermissionScope for all permissions in that role
- Users can now approve because they have both layers

**To fix existing data:**
- Run `npm run backfill:user-scopes` to create scopes for all existing users
