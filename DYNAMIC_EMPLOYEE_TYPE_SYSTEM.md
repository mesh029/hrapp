# PATH HR System - Dynamic Employee Type Configuration

## Overview

The system is designed to handle **unlimited employee types** dynamically. While PATH company initially has three employee types (Regular, Temporary, and HRH), the system allows **creating new employee types at runtime** without code changes. This document explains how the system dynamically factors in different employee types and how to create and configure new ones.

---

## 0. Dynamic Employee Type Creation & Management

### Overview

Employee types are **fully dynamic** - you can create, modify, and delete employee types at runtime. This allows the system to work for **any organization**, not just PATH, with their own unique employee classifications.

### Database Schema

```sql
CREATE TABLE employee_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'regular', 'temporary', 'hrh', 'contractor'
    name VARCHAR(255) NOT NULL, -- e.g., 'Regular Staff', 'Temporary Staff', 'HRH Staff'
    description TEXT,
    default_location_type VARCHAR(50), -- 'office', 'facility', 'remote', etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB, -- Flexible storage for organization-specific fields
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_employee_type_code UNIQUE (code),
    
    -- Indexes
    INDEX idx_employee_types_code (code),
    INDEX idx_employee_types_active (is_active)
);
```

### Employee Type Creation Workflow

When creating a new employee type, the system follows this workflow:

```
1. Admin/HR Manager creates employee type
   ↓
2. System validates employee type (code uniqueness, required fields)
   ↓
3. Configure work hours for the new employee type
   ↓
4. Create workflow templates (optional - can use defaults)
   ↓
5. Assign users to the new employee type
   ↓
6. Employee type is active and ready to use
```

### API Endpoints for Employee Type Management

#### Create Employee Type
```http
POST /api/employee-types
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "contractor",
  "name": "Contractor",
  "description": "Contract-based employees working on specific projects",
  "default_location_type": "office",
  "metadata": {
    "contract_duration": "project-based",
    "benefits_eligible": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "emp-type-123",
    "code": "contractor",
    "name": "Contractor",
    "description": "Contract-based employees working on specific projects",
    "default_location_type": "office",
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z",
    "created_by": "user-456"
  }
}
```

#### List Employee Types
```http
GET /api/employee-types?is_active=true
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "emp-type-1",
      "code": "regular",
      "name": "Regular Staff",
      "description": "Full-time permanent employees",
      "is_active": true,
      "user_count": 150
    },
    {
      "id": "emp-type-2",
      "code": "temporary",
      "name": "Temporary Staff",
      "description": "Temporary contract employees",
      "is_active": true,
      "user_count": 25
    },
    {
      "id": "emp-type-3",
      "code": "hrh",
      "name": "HRH Staff",
      "description": "Human Resources for Health staff at facilities",
      "is_active": true,
      "user_count": 80
    },
    {
      "id": "emp-type-123",
      "code": "contractor",
      "name": "Contractor",
      "description": "Contract-based employees",
      "is_active": true,
      "user_count": 0
    }
  ]
}
```

#### Update Employee Type
```http
PATCH /api/employee-types/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Contractor Staff",
  "description": "Updated description",
  "metadata": {
    "contract_duration": "project-based",
    "benefits_eligible": false,
    "max_leave_days": 10
  }
}
```

#### Delete/Deactivate Employee Type
```http
DELETE /api/employee-types/:id
Authorization: Bearer {token}
```

**Note:** Deleting an employee type will:
- Set `is_active = false` (soft delete)
- Prevent new users from being assigned to this type
- Existing users remain assigned (for historical data integrity)
- Work hours configurations remain (for historical timesheets)

### Assigning Users to Employee Types

#### Update User's Employee Type
```http
PATCH /api/users/:userId/employee-type
Authorization: Bearer {token}
Content-Type: application/json

{
  "employee_type_id": "emp-type-123",
  "effective_date": "2024-02-01" // Optional: when the change takes effect
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "user-789",
    "employee_type": {
      "id": "emp-type-123",
      "code": "contractor",
      "name": "Contractor"
    },
    "effective_date": "2024-02-01",
    "updated_at": "2024-01-20T14:30:00Z"
  }
}
```

#### Bulk Assign Users
```http
POST /api/users/bulk-assign-employee-type
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_ids": ["user-1", "user-2", "user-3"],
  "employee_type_id": "emp-type-123",
  "effective_date": "2024-02-01"
}
```

### Complete Employee Type Setup Process

When creating a new employee type, follow these steps:

#### Step 1: Create Employee Type
```http
POST /api/employee-types
{
  "code": "intern",
  "name": "Intern",
  "description": "Internship program participants"
}
```

#### Step 2: Configure Work Hours
```http
POST /api/work-hours/configurations
{
  "employee_type_id": "emp-type-456", // Reference to the new employee type
  "location_id": null, // Global default
  "monday_hours": 4.0,
  "tuesday_hours": 4.0,
  "wednesday_hours": 4.0,
  "thursday_hours": 4.0,
  "friday_hours": 4.0,
  "saturday_hours": 0,
  "sunday_hours": 0,
  "weekly_total": 20.0
}
```

#### Step 3: Create Workflow Templates (Optional)
```http
POST /api/workflows/templates
{
  "name": "Intern Leave Request",
  "resource_type": "leave_request",
  "location_id": "nairobi-id",
  "employee_type_id": "emp-type-456",
  "steps": [
    {
      "step_order": 1,
      "required_permission": "leave.approve",
      "required_role_id": "manager-role-id"
    }
  ]
}
```

#### Step 4: Assign Users
```http
POST /api/users/bulk-assign-employee-type
{
  "user_ids": ["intern-1", "intern-2"],
  "employee_type_id": "emp-type-456"
}
```

### Employee Type Configuration Options

Each employee type can have:

1. **Work Hours Configuration**
   - Per day of week
   - Per location (optional override)
   - Weekly total calculation

2. **Workflow Templates**
   - Leave request workflows
   - Timesheet approval workflows
   - Can be location-specific

3. **Leave Entitlements**
   - Default leave days per year
   - Leave accrual rules
   - Leave type eligibility

4. **Location Assignments**
   - Default location type (office, facility, remote)
   - Allowed locations

5. **Metadata**
   - Custom fields (JSONB)
   - Organization-specific configurations
   - Benefits eligibility
   - Pay structure references

### Example: Creating "Consultant" Employee Type

```typescript
// Step 1: Create employee type
const consultantType = await createEmployeeType({
  code: 'consultant',
  name: 'Consultant',
  description: 'External consultants working on projects',
  default_location_type: 'remote',
  metadata: {
    pay_structure: 'hourly',
    benefits_eligible: false,
    requires_timesheet: true
  }
});

// Step 2: Configure work hours (flexible hours)
await createWorkHoursConfiguration({
  employee_type_id: consultantType.id,
  monday_hours: 0, // Flexible - no fixed hours
  tuesday_hours: 0,
  wednesday_hours: 0,
  thursday_hours: 0,
  friday_hours: 0,
  saturday_hours: 0,
  sunday_hours: 0,
  weekly_total: 0, // Hours tracked via timesheet entries
  metadata: {
    flexible_hours: true,
    minimum_hours: 0,
    maximum_hours: null
  }
});

// Step 3: Create simple workflow (1-step approval)
await createWorkflowTemplate({
  name: 'Consultant Leave Request',
  resource_type: 'leave_request',
  employee_type_id: consultantType.id,
  steps: [{
    step_order: 1,
    required_permission: 'leave.approve'
  }]
});

// Step 4: Assign consultant users
await bulkAssignEmployeeType({
  user_ids: ['consultant-1', 'consultant-2'],
  employee_type_id: consultantType.id
});
```

### Employee Type Validation Rules

When creating/updating employee types:

1. **Code Uniqueness:** Employee type code must be unique
2. **Required Fields:** `code`, `name` are required
3. **Active Status:** Cannot delete employee type with active users (soft delete only)
4. **Work Hours:** Must configure work hours before assigning users
5. **Workflow Templates:** Optional but recommended for leave/timesheet workflows

### Migration from Enum to Dynamic Table

If the system initially used an enum for employee types:

```sql
-- Migration: Convert enum to dynamic table
-- Step 1: Create employee_types table (see schema above)

-- Step 2: Insert default employee types
INSERT INTO employee_types (code, name, description, default_location_type)
VALUES
  ('regular', 'Regular Staff', 'Full-time permanent employees', 'office'),
  ('temporary', 'Temporary Staff', 'Temporary contract employees', 'office'),
  ('hrh', 'HRH Staff', 'Human Resources for Health staff', 'facility');

-- Step 3: Update users table to reference employee_types
ALTER TABLE users
ADD COLUMN employee_type_id UUID REFERENCES employee_types(id);

-- Step 4: Migrate existing data
UPDATE users
SET employee_type_id = (
  SELECT id FROM employee_types WHERE code = users.staff_type
);

-- Step 5: Remove old enum column (after verification)
-- ALTER TABLE users DROP COLUMN staff_type;
```

### Permissions Required

- `employee_types.create` - Create new employee types
- `employee_types.read` - View employee types
- `employee_types.update` - Update employee types
- `employee_types.delete` - Delete/deactivate employee types
- `users.assign_employee_type` - Assign users to employee types

---

## The PATH Company Context

### Employee Types & Their Characteristics

1. **Regular Staff**
   - **Location:** Offices (Nairobi, Kisumu, Kakamega, Vihiga, Nyamira)
   - **Work Hours:** 40 hrs/week (Mon-Thu: 8.5hrs, Fri: 6hrs)
   - **Leave:** Paid leave days
   - **Approval Flow:** Multi-level (Manager → Program Officer → HR Manager)

2. **Temporary Staff**
   - **Location:** Offices (same as Regular)
   - **Work Hours:** 40 hrs/week (Mon-Thu: 8.5hrs, Fri: 6hrs) - *Same as Regular*
   - **Leave:** Paid leave days
   - **Approval Flow:** May differ from Regular (could be simpler: Manager only)

3. **HRH Staff (Human Resources for Health)**
   - **Location:** Facilities (not offices)
   - **Work Hours:** 40 hrs/week (Mon-Fri: 8hrs each day) - *Different pattern*
   - **Leave:** Paid leave days
   - **Approval Flow:** Potentially different hierarchy (facility-based approvers)

---

## 1. Dynamic Work Hours Configuration

### How It Works

The system uses a **`work_hours_configurations`** table that allows **runtime configuration** of work schedules per staff type and optionally per location.

#### Database Schema

```sql
CREATE TABLE work_hours_configurations (
    id UUID PRIMARY KEY,
    employee_type_id UUID NOT NULL REFERENCES employee_types(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL, -- Optional: can be global or location-specific
    monday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    tuesday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    wednesday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    thursday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    friday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    saturday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    sunday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    weekly_total DECIMAL(5,2) NOT NULL, -- Calculated: sum of all days
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### PATH Default Configurations

**Regular Staff (Global or per Location):**
```json
{
  "employee_type_id": "emp-type-regular-id",
  "location_id": null, // Global default
  "monday_hours": 8.5,
  "tuesday_hours": 8.5,
  "wednesday_hours": 8.5,
  "thursday_hours": 8.5,
  "friday_hours": 6.0,
  "saturday_hours": 0,
  "sunday_hours": 0,
  "weekly_total": 40.0
}
```

**Temporary Staff (Global or per Location):**
```json
{
  "employee_type_id": "emp-type-temporary-id",
  "location_id": null, // Global default
  "monday_hours": 8.5,
  "tuesday_hours": 8.5,
  "wednesday_hours": 8.5,
  "thursday_hours": 8.5,
  "friday_hours": 6.0,
  "saturday_hours": 0,
  "sunday_hours": 0,
  "weekly_total": 40.0
}
```

**HRH Staff (Global or per Location):**
```json
{
  "employee_type_id": "emp-type-hrh-id",
  "location_id": null, // Global default
  "monday_hours": 8.0,
  "tuesday_hours": 8.0,
  "wednesday_hours": 8.0,
  "thursday_hours": 8.0,
  "friday_hours": 8.0,
  "saturday_hours": 0,
  "sunday_hours": 0,
  "weekly_total": 40.0
}
```

### Dynamic Resolution Logic

When calculating work hours for timesheets or leave requests:

```typescript
// Pseudo-code for work hours resolution
function getWorkHoursForEmployee(employee: User, date: Date): number {
  // 1. Check for location-specific configuration first
  const locationConfig = workHoursConfigurations.find(
    config => config.employee_type_id === employee.employee_type_id 
      && config.location_id === employee.location_id
      && config.status === 'active'
  );
  
  // 2. Fall back to global configuration for employee type
  if (!locationConfig) {
    locationConfig = workHoursConfigurations.find(
      config => config.employee_type_id === employee.employee_type_id 
        && config.location_id === null
        && config.status === 'active'
    );
  }
  
  // 3. Get day-specific hours
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  switch(dayOfWeek) {
    case 1: return locationConfig.monday_hours;
    case 2: return locationConfig.tuesday_hours;
    case 3: return locationConfig.wednesday_hours;
    case 4: return locationConfig.thursday_hours;
    case 5: return locationConfig.friday_hours;
    case 6: return locationConfig.saturday_hours;
    case 0: return locationConfig.sunday_hours;
  }
}
```

### Benefits

- ✅ **No Hardcoding:** Work hours are database-driven
- ✅ **Location-Specific Overrides:** Nairobi office can have different hours than Kisumu
- ✅ **Runtime Changes:** Update work hours without code deployment
- ✅ **Extensible:** Add new staff types with any work pattern
- ✅ **Historical Accuracy:** Changes don't affect past timesheets (versioning)

---

## 2. Dynamic Pay Structure Configuration

### How Pay Differs by Employee Type

While the system doesn't store salary information directly, **pay calculations** are influenced by:

1. **Work Hours Configuration** (different hours = different pay calculations)
2. **Leave Type Configuration** (paid vs unpaid leave)
3. **Timesheet Entries** (regular work vs leave hours)

#### Pay Calculation Logic

```typescript
// Pseudo-code for pay calculation
function calculateMonthlyPay(employee: User, timesheet: Timesheet): PayCalculation {
  const workHoursConfig = getWorkHoursForEmployee(employee);
  let totalHours = 0;
  let regularWorkHours = 0;
  let leaveHours = 0;
  let holidayHours = 0;
  
  // Process each day in the timesheet
  timesheet.entries.forEach(entry => {
    if (entry.is_holiday) {
      holidayHours += workHoursConfig.getHoursForDay(entry.date);
    } else if (entry.is_leave && entry.leave_type.is_paid) {
      // Paid leave contributes to total hours
      leaveHours += workHoursConfig.getHoursForDay(entry.date);
    } else if (entry.is_leave && !entry.leave_type.is_paid) {
      // Unpaid leave doesn't contribute
      // (no hours added)
    } else {
      // Regular work
      regularWorkHours += entry.hours_worked;
    }
  });
  
  totalHours = regularWorkHours + leaveHours + holidayHours;
  
  // Pay calculation would use:
  // - Employee's hourly rate (stored elsewhere)
  // - Total hours (regular + paid leave + holidays)
  // - Overtime calculations (if applicable)
  
  return {
    regularWorkHours,
    leaveHours,
    holidayHours,
    totalHours,
    // ... pay calculation details
  };
}
```

#### Key Differences by Employee Type

**Regular Staff:**
- Full-time employment
- Accrued leave days
- Standard pay rate
- Benefits eligibility

**Temporary Staff:**
- Contract-based
- May have different pay rates
- Limited leave accrual
- Different benefits (or none)

**HRH Staff:**
- Facility-based work
- Potentially different pay scales
- Different leave policies
- Facility-specific benefits

### Dynamic Leave Type Configuration

Each leave type can be configured as **paid** or **unpaid**, affecting pay calculations:

```sql
CREATE TABLE leave_types (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT true,
    max_days_per_year INTEGER,
    -- ... other fields
);
```

**Example Leave Types:**
- **Sick Leave:** `is_paid = true` → Contributes to pay
- **Vacation:** `is_paid = true` → Contributes to pay
- **Unpaid Leave:** `is_paid = false` → Doesn't contribute to pay
- **Maternity Leave:** `is_paid = true` → Contributes to pay

---

## 3. Dynamic Approver Assignment

### How Approvers Differ by Employee Type

The system uses **Workflow Templates** that are **location-specific** and can be **staff-type-specific** (via role assignments and permissions).

#### Workflow Template Structure

```sql
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'leave_request', 'timesheet'
    location_id UUID REFERENCES locations(id), -- Location-specific
    employee_type_id UUID REFERENCES employee_types(id), -- Optional: can be employee-type-specific
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- ... other fields
);

CREATE TABLE workflow_template_steps (
    id UUID PRIMARY KEY,
    template_id UUID REFERENCES workflow_templates(id),
    step_order INTEGER NOT NULL,
    required_permission VARCHAR(100), -- e.g., 'leave.approve'
    required_role_id UUID REFERENCES roles(id), -- Optional
    allow_decline BOOLEAN NOT NULL DEFAULT true,
    allow_adjust BOOLEAN NOT NULL DEFAULT false,
    -- ... other fields
);
```

#### PATH Example Workflows (All Configurable - NOT Hardcoded)

**IMPORTANT:** These are just PATH's default examples. You can:
- Change the first step to ANY role/permission
- Add/remove/reorder steps
- Create completely different workflows
- Delete these defaults and create your own

**Regular Staff - Leave Request (Nairobi) - Example Default:**
```
Step 1: Manager (with 'leave.approve' permission)
  → Can be changed to ANY role/permission
Step 2: Program Officer - Nairobi Region (with 'leave.approve' permission + role)
  → Can be removed, reordered, or changed
Step 3: HR Manager - Nairobi Region (with 'leave.approve' permission + role)
  → Can be removed, reordered, or changed
```

**Temporary Staff - Leave Request (Nairobi) - Example Default:**
```
Step 1: Manager (with 'leave.approve' permission)
  → Can be changed to ANY role/permission (e.g., "Supervisor", "Team Lead", etc.)
// This is just an example - you can add more steps or change the approver
```

**HRH Staff - Leave Request (Facility-based) - Example Default:**
```
Step 1: Facility Manager (with 'leave.approve' permission)
  → Can be changed to ANY role/permission
Step 2: Regional HR Manager (with 'leave.approve' permission)
  → Can be removed, reordered, or changed
// Different hierarchy for facility-based staff - but this is just an example
```

**Custom Workflow Examples (All Possible):**
```
Example 1: Start with "Supervisor" instead of "Manager"
Step 1: Supervisor (with 'leave.approve' permission)
Step 2: Department Head (with 'leave.approve' permission)
Step 3: HR Manager (with 'leave.approve' permission)

Example 2: Start with "Finance Officer"
Step 1: Finance Officer (with 'leave.approve' permission)
Step 2: CEO (with 'leave.approve' permission)

Example 3: Permission-based only (no specific roles)
Step 1: Any user with 'leave.approve' permission
Step 2: Any user with 'leave.approve' permission + 'senior' scope
```

#### Dynamic Approver Resolution

```typescript
// Pseudo-code for approver resolution
function resolveApproversForWorkflow(
  employee: User, 
  workflowTemplate: WorkflowTemplate
): User[] {
  const approvers: User[] = [];
  
  // Get workflow steps in order
  const steps = workflowTemplate.steps.sort((a, b) => a.step_order - b.step_order);
  
  steps.forEach(step => {
    // Find users who can approve at this step
    const stepApprovers = users.filter(user => {
      // Check permission
      const hasPermission = user.permissions.includes(step.required_permission);
      
      // Check role (if specified)
      const hasRole = !step.required_role_id 
        || user.roles.some(role => role.id === step.required_role_id);
      
      // Check location scope (approver must be in same location or parent location)
      const inLocationScope = isUserInLocationScope(user, employee.location);
      
      return hasPermission && hasRole && inLocationScope;
    });
    
    // For each step, we need at least one approver
    // The system will assign the first available approver or use delegation
    approvers.push(...stepApprovers);
  });
  
  return approvers;
}
```

#### Location-Based Approver Assignment

**Regular Staff (Nairobi Office):**
- Manager: Any user with 'leave.approve' in Nairobi
- Program Officer: User with 'Program Officer' role in Nairobi region
- HR Manager: User with 'HR Manager' role in Nairobi region

**HRH Staff (Facility in Kisumu):**
- Facility Manager: User with 'leave.approve' at the facility
- Regional HR Manager: User with 'HR Manager' role in Kisumu region
- (Different hierarchy because they work at facilities, not offices)

#### Role & Permission System

```sql
-- Roles are dynamic
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    -- ... other fields
);

-- Permissions are dynamic
CREATE TABLE permissions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE, -- e.g., 'leave.approve'
    description TEXT,
    -- ... other fields
);

-- Role-Permission mapping (many-to-many)
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id),
    permission_id UUID REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- User-Role mapping (many-to-many)
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    location_id UUID REFERENCES locations(id), -- Role can be location-specific
    PRIMARY KEY (user_id, role_id, location_id)
);
```

---

## 4. Complete Dynamic System Architecture

### How Everything Works Together

```
┌─────────────────────────────────────────────────────────────┐
│                    EMPLOYEE CREATION                          │
│  User: John Doe                                              │
│  Staff Type: Regular                                         │
│  Location: Nairobi Office                                    │
│  Roles: [Employee]                                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              SYSTEM AUTOMATICALLY RESOLVES:                  │
│                                                              │
│  1. Work Hours Config → Regular Staff (Mon-Thu: 8.5, Fri: 6)│
│  2. Workflow Template → Regular Staff Leave (3-step)        │
│  3. Approvers → Manager → Program Officer → HR Manager     │
│  4. Leave Types → All active leave types available          │
│  5. Pay Calculation → Based on work hours + paid leave       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              LEAVE REQUEST SUBMISSION                        │
│  John submits leave request for 5 days                      │
│  System:                                                      │
│  - Calculates hours: 5 days × 8.5hrs = 42.5 hours          │
│  - Creates workflow instance with 3-step approval            │
│  - Assigns approvers based on location + roles              │
│  - Sends notifications to Step 1 approver (Manager)          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              APPROVAL WORKFLOW                               │
│  Step 1: Manager approves → Digital signature + timestamp   │
│  Step 2: Program Officer approves → Digital signature        │
│  Step 3: HR Manager approves → Digital signature           │
│  → Leave request fully approved                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              AUTOMATIC TIMESHEET INTEGRATION                 │
│  System automatically:                                       │
│  - Adds approved leave to John's timesheet                   │
│  - Labels entries with leave type name                      │
│  - Calculates total hours: Regular work + Leave hours        │
│  - Contributes to monthly pay calculation                    │
└─────────────────────────────────────────────────────────────┘
```

### Key Dynamic Resolution Points

1. **Work Hours Resolution:**
   ```
   Employee → Employee Type → Location → Work Hours Config → Day of Week → Hours
   ```

2. **Workflow Resolution:**
   ```
   Employee → Employee Type → Location → Resource Type → Workflow Template → Steps
   ```

3. **Approver Resolution:**
   ```
   Workflow Step → Required Permission + Role → Location Scope → Available Users
   ```

4. **Pay Calculation:**
   ```
   Timesheet → Work Hours Config → Regular Hours + Paid Leave Hours + Holidays → Total Hours → Pay
   ```

---

## 5. Runtime Configuration Examples

### Example 1: Adding a New Employee Type (Complete Process)

```sql
-- Step 1: Create the employee type
INSERT INTO employee_types (code, name, description, default_location_type)
VALUES ('contractor', 'Contractor', 'Contract-based employees', 'office')
RETURNING id; -- Returns: contractor-type-id

-- Step 2: Create work hours configuration for new employee type
INSERT INTO work_hours_configurations (
  employee_type_id, monday_hours, tuesday_hours, wednesday_hours,
  thursday_hours, friday_hours, weekly_total
) VALUES (
  'contractor-type-id', 4.0, 4.0, 4.0, 4.0, 4.0, 20.0
);

-- Step 3: Create workflow template for contractors
INSERT INTO workflow_templates (
  name, resource_type, location_id, employee_type_id
) VALUES (
  'Contractor Leave Request', 'leave_request', 'nairobi-id', 'contractor-type-id'
);

-- Step 4: Add workflow steps (simpler: 1-step approval)
INSERT INTO workflow_template_steps (
  template_id, step_order, required_permission
) VALUES (
  'template-id', 1, 'leave.approve'
);

-- Step 5: Assign users to the new employee type
UPDATE users
SET employee_type_id = 'contractor-type-id'
WHERE id IN ('user-1', 'user-2', 'user-3');
```

### Example 2: Changing Work Hours for HRH Staff

```sql
-- Update HRH work hours to 9 hours/day (45 hours/week)
UPDATE work_hours_configurations
SET 
  monday_hours = 9.0,
  tuesday_hours = 9.0,
  wednesday_hours = 9.0,
  thursday_hours = 9.0,
  friday_hours = 9.0,
  weekly_total = 45.0,
  updated_at = NOW()
WHERE employee_type_id = (SELECT id FROM employee_types WHERE code = 'hrh')
  AND location_id IS NULL;
```

### Example 3: Location-Specific Override

```sql
-- Nairobi Regular Staff work 9 hours/day (different from global)
INSERT INTO work_hours_configurations (
  employee_type_id, location_id, monday_hours, tuesday_hours,
  wednesday_hours, thursday_hours, friday_hours, weekly_total
) VALUES (
  (SELECT id FROM employee_types WHERE code = 'regular'), 
  'nairobi-id', 9.0, 9.0, 9.0, 9.0, 4.0, 40.0
);
-- This overrides the global configuration for Nairobi only
```

### Example 4: Changing Approval Workflow

```sql
-- Add a 4th approval step to Regular Staff leave requests
INSERT INTO workflow_template_steps (
  template_id, step_order, required_permission, required_role_id
) VALUES (
  'regular-leave-template-id', 
  4, 
  'leave.approve', 
  'finance-director-role-id'
);
```

---

## 6. Benefits of This Dynamic System

### ✅ Scalability
- Add new staff types without code changes
- Add new locations with different configurations
- Extend workflows to any number of steps

### ✅ Flexibility
- Change work hours at runtime
- Modify approval workflows per location
- Adjust leave policies per staff type

### ✅ Maintainability
- No hardcoded business logic
- Configuration-driven system
- Easy to audit and modify

### ✅ Compliance
- Digital signatures for all approvals
- Complete audit trail
- Version isolation (changes don't affect running instances)

### ✅ Multi-Tenancy Ready
- Can support multiple organizations
- Each organization can have different configurations
- Isolated data and workflows

---

## 7. API Endpoints for Dynamic Configuration

### Employee Types
- `GET /api/employee-types` - List all employee types (filter by `is_active`)
- `GET /api/employee-types/:id` - Get employee type details
- `POST /api/employee-types` - Create new employee type
- `PATCH /api/employee-types/:id` - Update employee type
- `DELETE /api/employee-types/:id` - Deactivate employee type (soft delete)
- `GET /api/employee-types/:id/users` - List users assigned to employee type
- `POST /api/users/:userId/employee-type` - Assign user to employee type
- `POST /api/users/bulk-assign-employee-type` - Bulk assign users to employee type

### Work Hours Configuration
- `GET /api/work-hours/configurations` - List all configurations (filter by `employee_type_id`, `location_id`)
- `POST /api/work-hours/configurations` - Create new configuration
- `PATCH /api/work-hours/configurations/:id` - Update configuration
- `DELETE /api/work-hours/configurations/:id` - Delete configuration
- `GET /api/work-hours/configurations/by-employee-type/:employeeTypeId` - Get configurations for employee type

### Workflow Templates
- `GET /api/workflows/templates` - List templates (filter by location, employee_type_id)
- `POST /api/workflows/templates` - Create template
- `PATCH /api/workflows/templates/:id` - Update template
- `POST /api/workflows/templates/:id/steps` - Add approval step
- `DELETE /api/workflows/templates/:id/steps/:stepId` - Remove step

### Roles & Permissions
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create role
- `POST /api/roles/:id/permissions` - Assign permission to role
- `GET /api/permissions` - List all permissions

---

## Conclusion

The HR System is designed as a **fully dynamic, configuration-driven platform** that factors in different employee types through:

1. **Dynamic Employee Types:** Create, modify, and delete employee types at runtime
2. **Dynamic Work Hours:** Database-driven schedules per employee type/location
3. **Dynamic Pay Structures:** Calculated from work hours + leave types (paid/unpaid)
4. **Dynamic Approvers:** Workflow templates with role/permission-based assignment
5. **Dynamic Workflows:** Configurable approval chains (1 to N steps)
6. **Location-Specific Overrides:** Different configurations per location
7. **Runtime Changes:** All configurations can be modified without code deployment
8. **User Assignment:** Assign users to employee types individually or in bulk

This architecture ensures the system can scale to handle **endless possibilities** and work for **any organization** (not just PATH) while maintaining efficiency, compliance, and clarity. The system is truly multi-tenant ready and can adapt to any organization's unique employee classification needs.
