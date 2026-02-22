# Component Visibility Implementation Guide

**Quick Reference:** How to make UI components admin-configurable

---

## The Rule

**Every configurable UI component MUST use `useComponentVisibility` hook.**

This allows admins to configure component visibility for different user categories without code changes.

---

## Implementation Steps

### 1. Define Component ID

```typescript
// At the top of your component file
const COMPONENT_ID = 'leave.create.button'; // Use dot notation: module.action.element
```

**Naming Convention:**
- Format: `{module}.{action}.{element}`
- Examples:
  - `leave.create.button`
  - `leave.list.view`
  - `users.bulk.upload`
  - `timesheet.approve.action`

### 2. Import the Hook

```typescript
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
```

### 3. Use the Hook

```typescript
function MyComponent() {
  const { features } = useDynamicUI();
  const { isVisible, isEnabled } = useComponentVisibility(COMPONENT_ID, {
    // Fallback permission check if no admin config exists
    fallbackPermission: 'leave.create',
    
    // OR custom fallback check
    fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
    
    // Optional: default values
    defaultVisible: true,
    defaultEnabled: true,
  });
  
  // Don't render if not visible
  if (!isVisible) return null;
  
  // Render component (can be disabled if not enabled)
  return (
    <Button disabled={!isEnabled} onClick={handleAction}>
      Action
    </Button>
  );
}
```

---

## Examples

### Example 1: Create Leave Button

```typescript
'use client';

import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

const COMPONENT_ID = 'leave.create.button';

export function CreateLeaveButton() {
  const { features } = useDynamicUI();
  const { isVisible, isEnabled } = useComponentVisibility(COMPONENT_ID, {
    fallbackPermission: 'leave.create',
    fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
  });
  
  if (!isVisible) return null;
  
  return (
    <Button disabled={!isEnabled} onClick={handleCreate}>
      New Leave Request
    </Button>
  );
}
```

### Example 2: Bulk Upload Feature

```typescript
const COMPONENT_ID = 'users.bulk.upload';

export function BulkUploadSection() {
  const { isVisible, isEnabled } = useComponentVisibility(COMPONENT_ID, {
    fallbackPermission: 'users.create',
    fallbackCheck: (features) => features.canCreateUsers,
  });
  
  if (!isVisible) return null;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Upload</CardTitle>
      </CardHeader>
      <CardContent>
        <Button disabled={!isEnabled} onClick={handleBulkUpload}>
          Upload Users
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Example 3: Page-Level Access Control

```typescript
const COMPONENT_ID = 'leave.create.form';

export default function CreateLeavePage() {
  const { isVisible: canAccess } = useComponentVisibility(COMPONENT_ID, {
    fallbackPermission: 'leave.create',
    fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
  });
  
  const router = useRouter();
  
  React.useEffect(() => {
    if (!canAccess) {
      router.push('/leave/requests');
    }
  }, [canAccess, router]);
  
  if (!canAccess) return null;
  
  // ... rest of component
}
```

---

## Component ID Registry

When creating a new component, add its ID to this registry:

### Leave Management
- `leave.create.button` - Create leave request button
- `leave.create.form` - Create leave request form/page
- `leave.list.view` - Leave requests list view
- `leave.detail.view` - Leave request detail view
- `leave.approve.action` - Approve leave action
- `leave.decline.action` - Decline leave action
- `leave.balances.view` - Leave balances view

### Timesheet Management
- `timesheet.create.button` - Create timesheet button
- `timesheet.create.form` - Create timesheet form
- `timesheet.list.view` - Timesheets list view
- `timesheet.submit.action` - Submit timesheet action
- `timesheet.approve.action` - Approve timesheet action

### User Management
- `users.create.button` - Create user button
- `users.bulk.upload` - Bulk user upload feature
- `users.edit.action` - Edit user action
- `users.delete.action` - Delete user action

### Dashboard
- `dashboard.stats.cards` - Dashboard statistics cards
- `dashboard.quick.actions` - Quick actions section
- `dashboard.pending.approvals` - Pending approvals widget

---

## Migration Checklist

When updating existing components:

- [ ] Define component ID constant
- [ ] Import `useComponentVisibility` hook
- [ ] Replace hard-coded visibility checks with hook
- [ ] Add fallback permission check
- [ ] Test with different user categories
- [ ] Document component ID in registry
- [ ] Update component documentation

---

## Best Practices

1. **Always provide fallback:** Components should work even if admin config doesn't exist
2. **Use descriptive IDs:** Follow naming convention for consistency
3. **Document purpose:** Add comments explaining what the component does
4. **Test thoroughly:** Test with different user categories and permissions
5. **Group related components:** Use consistent prefixes for related components

---

## Troubleshooting

### Component not showing?

1. Check if `isVisible` is `true`
2. Check browser console for errors
3. Verify component ID is correct
4. Check if fallback permission is correct
5. Verify user has required permissions

### Component always visible?

1. Check if fallback check is too permissive
2. Verify admin config (if exists)
3. Check component ID matches config

---

**Remember:** The goal is to make components configurable by admins without code changes!
