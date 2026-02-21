# Manager Assignment Feature

## Overview

The system now supports optional manager assignment for users. This allows organizations to:
- Assign managers to employees who need them
- Leave employees without managers (for those who don't need hierarchical approval)
- Use manager relationships in workflow approver resolution (dynamically)

## Implementation Details

### Database Schema

Added to `User` model:
- `manager_id` (String?, nullable) - Optional reference to another User
- `manager` (User?, relation) - Self-referential relationship
- `direct_reports` (User[], relation) - Inverse relationship

### API Endpoints

#### User Creation/Update
- `POST /api/users` - Create user with optional `manager_id`
- `PATCH /api/users/:id` - Update user, including `manager_id`
- `PATCH /api/users/:id/manager` - Dedicated endpoint to update manager

#### Manager Queries
- `GET /api/users/:id/direct-reports` - Get all employees managed by a user

### Validation Rules

1. **Manager must exist and be active** - Cannot assign inactive or deleted users as managers
2. **No self-assignment** - User cannot be their own manager
3. **No circular relationships** - Prevents manager loops (A manages B, B manages A)
4. **Optional** - Manager assignment is completely optional

### Workflow Integration

The `resolveApprovers()` function in the workflow service now supports an optional parameter:

```typescript
resolveApprovers(
  stepOrder: number,
  workflowInstanceId: string,
  locationId: string,
  options?: {
    includeEmployeeManager?: boolean; // Include the employee's manager as approver
  }
)
```

**Important Clarification:**
- **Workflow Templates** are created by admins/HR managers (define approval sequences)
- **Workflow Instances** are created by **EMPLOYEES** when they submit leave requests or timesheets
- The `workflow_instance.created_by` field is the **EMPLOYEE** who submitted the request
- When `includeEmployeeManager: true`, the system checks if the **EMPLOYEE** (not admin) has a manager

**How it works:**
- When `includeEmployeeManager: true` is passed, the system:
  1. Gets the employee from `workflow_instance.created_by` (the one who submitted the request)
  2. Checks if the employee has a `manager_id` assigned
  3. If manager has the required permission and location scope, adds them to the approver list
- Managers are only included if they meet all authority requirements (permission + location scope)
- This is **completely optional** - workflows can work with or without manager consideration
- Some employees need managers (Regular Staff, Temp Staff), others don't (HRH, executives, etc.)

### Usage Examples

#### Create User with Manager
```json
POST /api/users
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "primary_location_id": "location-uuid",
  "manager_id": "manager-uuid"  // Optional
}
```

#### Update Manager
```json
PATCH /api/users/:id/manager
{
  "manager_id": "new-manager-uuid"  // or null to remove manager
}
```

#### Get Direct Reports
```
GET /api/users/:id/direct-reports
```

Returns:
```json
{
  "success": true,
  "data": {
    "manager": {
      "id": "...",
      "name": "Manager Name",
      "email": "manager@example.com"
    },
    "directReports": [
      {
        "id": "...",
        "name": "Employee Name",
        "email": "employee@example.com",
        "status": "active",
        ...
      }
    ],
    "count": 1
  }
}
```

### Design Principles

1. **Optional by Design** - Manager assignment is never required
2. **Dynamic Workflows** - Managers are just one option for approvers, not a requirement
3. **Authority-Based** - Managers must still have the required permissions to approve
4. **Location-Aware** - Managers must have location scope for the workflow location
5. **No Hardcoding** - Workflows can work with or without manager consideration

### Benefits

- **Flexibility**: Some employees need managers, others don't
- **Dynamic Workflows**: Managers can be part of approval chains when needed
- **Hierarchical Support**: Supports organizational hierarchies without forcing them
- **Permission-Based**: Managers still need proper permissions to approve

---

**Note**: The dev server may need to be restarted to pick up the new Prisma types for `manager_id`.
