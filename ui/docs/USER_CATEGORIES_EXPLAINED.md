# User Categories Explained

## What are User Categories?

**User Categories** are **admin-created custom groupings** of users used **exclusively for controlling UI component visibility**. They are stored in the `user_categories` database table.

### Purpose
- Allow admins to control which UI components are visible/enabled for different groups of users
- Enable dynamic UI configuration without code changes
- Support flexible user grouping beyond roles and permissions

### Examples
- "Managers" - Show approval workflows
- "HR Team" - Show user management features
- "Finance Department" - Show financial reports
- "Contractors" - Hide certain internal features

---

## User Categories vs Staff Types

### Staff Types (`StaffType` model)
- **Purpose**: Employee classification for business logic
- **Used for**: Work hours, leave accrual, payroll, system configuration
- **Storage**: `staff_types` table
- **Examples**: "Regular Staff", "Temporary Staff", "HRH Staff"
- **System-level**: Predefined or admin-created for operational purposes

### User Categories (`UserCategory` model)
- **Purpose**: UI visibility control only
- **Used for**: Showing/hiding UI components
- **Storage**: `user_categories` table
- **Examples**: "Managers", "HR Team", "Finance"
- **Admin-created**: Must be explicitly created by admins

**Key Difference**: Staff Types affect **system behavior** (work hours, leave rules), while User Categories affect **UI visibility** only.

---

## Why "No Categories Found"?

If you see "No categories found" but know categories exist in the database, check:

### 1. **Categories Must Be Created by Admin**
User Categories are **not automatically created**. They must be:
- Created via `/administration/user-categories` page
- Or inserted directly into the `user_categories` table

### 2. **Soft-Deleted Categories**
The API filters out categories where `deleted_at IS NOT NULL`. Check:
```sql
SELECT * FROM user_categories WHERE deleted_at IS NULL;
```

### 3. **Permission Issue**
The API requires `system.admin` permission. If you don't have this permission:
- API returns 403 Forbidden
- Frontend shows empty list

### 4. **API Response Structure**
The API returns:
```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "Managers", ... },
    { "id": "...", "name": "HR Team", ... }
  ]
}
```

If the proxy is double-wrapping, you might get:
```json
{
  "success": true,
  "data": {
    "data": [...]
  }
}
```

**Check browser console** for `[UserCategories] Full API Response:` logs to see the actual structure.

### 5. **Empty Database**
If no categories exist:
- Go to `/administration/user-categories`
- Click "New Category"
- Create your first category

---

## How to Debug

1. **Check Browser Console**
   - Look for `[UserCategories] Full API Response:` logs
   - Verify the response structure
   - Check for errors

2. **Check Server Logs**
   - Look for `Error getting user categories:` messages
   - Verify permission checks
   - Check database queries

3. **Check Database Directly**
   ```sql
   SELECT id, name, description, deleted_at 
   FROM user_categories 
   WHERE deleted_at IS NULL 
   ORDER BY priority DESC, name ASC;
   ```

4. **Test API Directly**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        http://localhost:3000/api/admin/user-categories
   ```

---

## Creating User Categories

1. Navigate to `/administration/user-categories`
2. Click "New Category"
3. Fill in:
   - **Name**: Required, unique (e.g., "Managers")
   - **Description**: Optional
   - **Color**: Optional hex color for UI display
   - **Priority**: Higher = more specific (default: 0)
4. Click "Create"

---

## Using User Categories

Once created, you can:

1. **Assign Users to Categories**
   - Via User Category Assignment API
   - Or through admin UI (if implemented)

2. **Configure Component Visibility**
   - Go to `/administration/component-visibility`
   - Select a component (e.g., "Create Leave Request Button")
   - Select a User Category
   - Configure visibility/enabled state

3. **Component Visibility Logic**
   - Components check User Category assignments first
   - Fall back to permission-based checks if no category config exists
   - User-specific overrides take highest priority

---

## Summary

- **User Categories** = Admin-created groups for UI visibility control
- **Staff Types** = Employee classifications for system behavior
- **No Categories Found** = Either none exist, all deleted, or API/permission issue
- **Check console logs** for detailed debugging information
