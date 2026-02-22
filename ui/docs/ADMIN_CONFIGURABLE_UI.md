# Admin-Configurable UI System

**Date:** February 22, 2025  
**Purpose:** Allow admins to configure which UI components are visible for different user categories without code changes

---

## Overview

The HR Management System uses an **admin-configurable UI system** where administrators can control which components and features are visible to different user categories. This provides:

- **Zero-Code Configuration:** Admins can enable/disable UI components for different user categories
- **Flexible User Categories:** Admins define user categories (e.g., "Junior Employee", "Senior Employee", "Manager", "HR Admin")
- **Component-Level Control:** Each UI component can be configured per user category
- **Dynamic Adaptation:** UI automatically adapts when admin changes configurations
- **Fallback to Permissions:** If no category config exists, falls back to permission-based checks

---

## Architecture

### 1. User Categories

User categories are defined by admins and assigned to users. Categories can be:
- **Role-based:** Categories tied to roles (e.g., "Admin", "Manager", "Employee")
- **Custom:** Custom categories created by admins (e.g., "Junior Staff", "Senior Staff", "Contractor")

### 2. Component Visibility Configuration

Each UI component has a **visibility configuration** that specifies:
- Which user categories can see it
- Whether it's enabled/disabled for specific categories
- Fallback behavior if category config doesn't exist

### 3. Configuration Storage

Component visibility is stored in the database as:
```typescript
interface ComponentVisibilityConfig {
  id: string;
  componentId: string;        // e.g., "leave.create.button"
  userCategoryId: string;    // Which category this applies to
  visible: boolean;           // Is this component visible?
  enabled: boolean;           // Is this component enabled (clickable)?
  priority: number;           // Priority if multiple configs apply
  created_at: Date;
  updated_at: Date;
}
```

---

## Component Properties

Every UI component that should be configurable must include:

### 1. Component ID

A unique identifier for the component:
```typescript
const COMPONENT_ID = 'leave.create.button';
```

### 2. Visibility Check

Components check visibility using the `useComponentVisibility` hook:
```typescript
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';

function CreateLeaveButton() {
  const { isVisible, isEnabled } = useComponentVisibility('leave.create.button');
  
  if (!isVisible) return null;
  
  return (
    <Button disabled={!isEnabled} onClick={handleCreate}>
      New Leave Request
    </Button>
  );
}
```

### 3. Fallback Permissions

If no category config exists, components fall back to permission checks:
```typescript
const { isVisible, isEnabled } = useComponentVisibility('leave.create.button', {
  fallbackPermission: 'leave.create',
  fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
});
```

---

## Implementation Pattern

### Step 1: Define Component ID

```typescript
// In component file
const COMPONENT_ID = 'leave.create.button';
```

### Step 2: Use Visibility Hook

```typescript
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

function CreateLeaveButton() {
  const { features } = useDynamicUI();
  const { isVisible, isEnabled } = useComponentVisibility(COMPONENT_ID, {
    // Fallback to permission check if no category config
    fallbackPermission: 'leave.create',
    fallbackCheck: () => features.canCreateLeave && !features.isAdmin,
  });
  
  if (!isVisible) return null;
  
  return (
    <Button disabled={!isEnabled} onClick={handleCreate}>
      New Leave Request
    </Button>
  );
}
```

### Step 3: Register Component

Components are automatically registered when first used. Admins can then configure visibility in the admin panel.

---

## Admin Configuration UI

Admins can configure component visibility through:

### 1. Component Visibility Manager

**Route:** `/administration/component-visibility`

**Features:**
- List all configurable components
- Filter by component ID, category, or status
- Enable/disable components per category
- Set visibility rules
- Preview changes before saving

### 2. User Category Manager

**Route:** `/administration/user-categories`

**Features:**
- Create/edit user categories
- Assign categories to users
- View category assignments
- Set category hierarchy (if needed)

---

## Component Registration

### Standard Component IDs

Components should follow a naming convention:

```
{module}.{action}.{element}
```

Examples:
- `leave.create.button` - Create leave request button
- `leave.list.view` - Leave requests list view
- `leave.approve.action` - Approve leave action
- `timesheet.create.button` - Create timesheet button
- `users.bulk.upload` - Bulk user upload feature
- `dashboard.stats.cards` - Dashboard statistics cards

### Component Metadata

Each component can have metadata:

```typescript
interface ComponentMetadata {
  id: string;
  name: string;              // Human-readable name
  description: string;      // What this component does
  module: string;           // Which module it belongs to
  category: string;          // Component category
  defaultVisible: boolean;   // Default visibility if no config
  defaultEnabled: boolean;   // Default enabled state
  requiresPermission?: string; // Required permission (for fallback)
}
```

---

## Priority System

When multiple configurations apply:

1. **User-specific config** (highest priority)
2. **Category-specific config**
3. **Role-based config**
4. **Permission-based fallback** (lowest priority)

---

## Migration Strategy

### Phase 1: Add Component IDs

1. Add `componentId` prop to all configurable components
2. Use `useComponentVisibility` hook
3. Keep existing permission checks as fallback

### Phase 2: Build Admin UI

1. Create component visibility manager
2. Create user category manager
3. Add API endpoints for configuration

### Phase 3: Database Schema

1. Add `ComponentVisibilityConfig` table
2. Add `UserCategory` table (if not exists)
3. Add migration scripts

### Phase 4: Full Integration

1. Replace all hard-coded visibility checks
2. Remove fallback permission checks (optional)
3. Test with different user categories

---

## Best Practices

### 1. Always Provide Fallback

```typescript
const { isVisible } = useComponentVisibility('my.component', {
  fallbackPermission: 'my.permission',
  fallbackCheck: () => features.canDoSomething,
});
```

### 2. Use Descriptive Component IDs

```typescript
// ✅ Good
'leave.create.button'
'users.bulk.upload.modal'
'timesheet.approve.action'

// ❌ Bad
'btn1'
'component2'
'feature-x'
```

### 3. Group Related Components

```typescript
// All leave-related components
'leave.create.button'
'leave.create.form'
'leave.list.view'
'leave.detail.view'
'leave.approve.action'
```

### 4. Document Component Purpose

```typescript
/**
 * Create Leave Request Button
 * 
 * Component ID: leave.create.button
 * 
 * Visibility Rules:
 * - Default: Requires 'leave.create' permission
 * - Admins: Hidden (admins don't create their own requests)
 * - Configurable: Yes (admins can override per category)
 */
const COMPONENT_ID = 'leave.create.button';
```

---

## Example: Leave Create Button

### Before (Hard-coded)

```typescript
{features.canCreateLeave && !features.isAdmin && (
  <Button>New Leave Request</Button>
)}
```

### After (Configurable)

```typescript
const { isVisible, isEnabled } = useComponentVisibility('leave.create.button', {
  fallbackPermission: 'leave.create',
  fallbackCheck: () => features.canCreateLeave && !features.isAdmin,
});

{isVisible && (
  <Button disabled={!isEnabled} onClick={handleCreate}>
    New Leave Request
  </Button>
)}
```

---

## API Endpoints

### Component Visibility

- `GET /api/admin/component-visibility` - List all component configs
- `GET /api/admin/component-visibility/[componentId]` - Get component config
- `POST /api/admin/component-visibility` - Create/update config
- `DELETE /api/admin/component-visibility/[id]` - Delete config
- `GET /api/admin/component-visibility/user/[userId]` - Get user's visible components

### User Categories

- `GET /api/admin/user-categories` - List categories
- `POST /api/admin/user-categories` - Create category
- `PATCH /api/admin/user-categories/[id]` - Update category
- `DELETE /api/admin/user-categories/[id]` - Delete category
- `GET /api/admin/user-categories/[id]/users` - Get users in category

---

## Future Enhancements

1. **Component Groups:** Group related components for bulk configuration
2. **Conditional Visibility:** Show/hide based on data state (e.g., only show if user has pending requests)
3. **Time-based Visibility:** Show/hide components based on date/time
4. **Location-based Visibility:** Different components for different locations
5. **A/B Testing:** Test different component configurations
6. **Analytics:** Track which components are used most

---

## Summary

This system allows admins to:
- ✅ Configure UI component visibility without code changes
- ✅ Control what different user categories see
- ✅ Enable/disable features dynamically
- ✅ Maintain flexibility as the system evolves

**Key Principle:** Every configurable UI component should use `useComponentVisibility` hook with appropriate fallback permissions.
