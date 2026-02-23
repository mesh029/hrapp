# Workflow System Deep Analysis

## Current Workflow Architecture

### 1. Workflow Templates
**Purpose:** Pre-defined approval sequences created by admins

**Structure:**
- `WorkflowTemplate`: Template metadata (name, resource_type, location_id, status)
- `WorkflowStep`: Ordered steps with:
  - `step_order`: Sequence number
  - `required_permission`: Permission needed to approve
  - `allow_decline`: Can approver decline?
  - `allow_adjust`: Can approver adjust?

**Current Limitation:** Steps only specify permission, not HOW to find approvers

---

### 2. Workflow Instances
**Purpose:** Actual approval workflows tied to resources (leave/timesheet)

**Creation Flow:**
1. Employee creates resource (leave/timesheet) → Status: Draft
2. Employee submits → System:
   - Finds matching template (by location + resource_type)
   - Creates `WorkflowInstance` with `created_by = employee.id`
   - Creates `WorkflowStepInstance` for each step
   - Sets status to "Submitted"
   - Moves to first step

**Key Fields:**
- `created_by`: The EMPLOYEE who submitted (not admin)
- `resource_id`: Leave request or timesheet ID
- `resource_type`: 'leave' or 'timesheet'
- `current_step_order`: Current step being processed

---

### 3. Approver Resolution (Current Implementation)

**Function:** `resolveApprovers(stepOrder, workflowInstanceId, locationId, options)`

**Current Logic:**
1. Find all users with `required_permission` for the location
2. Filter by `checkAuthority` (permission + location scope)
3. Optionally include employee's manager (if `includeEmployeeManager: true`)
   - Gets employee from `workflow_instance.created_by`
   - Checks `employee.manager_id`
   - Verifies manager has permission + authority
4. Returns array of approver user IDs

**Current Limitations:**
- No role-based selection (only permission-based)
- No location hierarchy support
- No conditional routing
- Manager inclusion is binary (on/off)
- No way to specify "only manager" or "only roles"

---

### 4. Manager Relationship

**Database:**
- `User.manager_id` → References another User
- Self-referential relationship
- Optional (not all users have managers)

**Usage:**
- Used in `resolveApprovers` when `includeEmployeeManager: true`
- Manager must have required permission + location authority
- Supports multi-level hierarchy (manager's manager, etc.)

---

### 5. Authority Checking

**Function:** `checkAuthority(userId, permission, locationId, ...)`

**Checks:**
- User has permission (via roles)
- Permission scope for location:
  - Global permissions (system.admin)
  - Location-specific permissions
  - Location hierarchy (parent/child)
  - Delegation (temporary assignments)

---

## What Needs to Be Enhanced

### 1. Step Configuration
**Current:** Steps only have permission requirement
**Needed:** 
- Approver resolution strategy per step
- Role selection (multiple roles)
- Manager inclusion toggle
- Location filtering options
- Conditional rules

### 2. Approver Resolution
**Current:** Permission + optional manager
**Needed:**
- Role-based approver selection
- Location-based filtering
- Combined strategies (manager + roles)
- Priority ordering
- Fallback strategies

### 3. Workflow Builder
**Current:** Basic form with steps
**Needed:**
- Visual drag-and-drop builder
- Step configuration dialog
- Approver preview
- Test simulation

### 4. Testing Framework
**Current:** Manual testing only
**Needed:**
- Test scenario builder
- Workflow simulator
- Approver resolution testing
- End-to-end testing with 4 users

---

## Proposed Enhancements

### Enhanced WorkflowStep Schema
```typescript
{
  step_order: number;
  required_permission: string;
  allow_decline: boolean;
  allow_adjust: boolean;
  
  // NEW: Approver Resolution Config
  approver_strategy: 'permission' | 'manager' | 'role' | 'combined';
  include_manager?: boolean;
  required_roles?: string[]; // Role IDs
  location_scope?: 'same' | 'parent' | 'descendants' | 'all';
  conditional_rules?: {
    condition: string; // e.g., "amount > 5"
    approver_strategy: string; // Different strategy if condition met
  }[];
}
```

### Enhanced resolveApprovers Function
```typescript
async function resolveApprovers(
  stepOrder: number,
  workflowInstanceId: string,
  locationId: string,
  stepConfig: WorkflowStepConfig // NEW: Step-specific config
): Promise<Approver[]> {
  const approvers: Approver[] = [];
  
  // Strategy 1: Manager-based
  if (stepConfig.include_manager || stepConfig.approver_strategy === 'manager') {
    const manager = await getEmployeeManager(instance.created_by);
    if (manager && hasPermission(manager, step.required_permission, locationId)) {
      approvers.push({ id: manager.id, source: 'manager' });
    }
  }
  
  // Strategy 2: Role-based
  if (stepConfig.required_roles?.length > 0) {
    const roleApprovers = await findUsersByRoles(
      stepConfig.required_roles,
      locationId,
      step.required_permission
    );
    approvers.push(...roleApprovers.map(id => ({ id, source: 'role' })));
  }
  
  // Strategy 3: Permission-based (fallback)
  if (stepConfig.approver_strategy === 'permission') {
    const permissionApprovers = await findUsersByPermission(
      step.required_permission,
      locationId
    );
    approvers.push(...permissionApprovers.map(id => ({ id, source: 'permission' })));
  }
  
  // Remove duplicates, apply priority, return
  return deduplicateAndPrioritize(approvers);
}
```

---

## Test Scenario Requirements

### 4 Users Setup:
1. **Employee** (submits timesheet)
   - Name: "John Employee"
   - Location: Nairobi
   - Manager: Manager 1
   - Role: Employee

2. **Manager 1** (first approver - employee's manager)
   - Name: "Jane Manager"
   - Location: Nairobi
   - Role: Manager
   - Permission: timesheet.approve

3. **HR Manager** (second approver - role-based)
   - Name: "Bob HR"
   - Location: Nairobi
   - Role: HR Manager
   - Permission: timesheet.approve

4. **Finance Manager** (third approver - role-based)
   - Name: "Alice Finance"
   - Location: Nairobi
   - Role: Finance Manager
   - Permission: timesheet.approve

### Workflow Template:
- Step 1: Manager approval (include_manager: true)
- Step 2: HR Manager approval (required_roles: ["HR Manager"])
- Step 3: Finance Manager approval (required_roles: ["Finance Manager"])

### Expected Flow:
1. John submits timesheet
2. Workflow instance created
3. Step 1: Jane Manager (John's manager) notified
4. Jane approves → Step 2
5. Step 2: Bob HR (HR Manager role) notified
6. Bob approves → Step 3
7. Step 3: Alice Finance (Finance Manager role) notified
8. Alice approves → Timesheet approved

---

## Implementation Priority

1. **Phase 1:** Visual builder + step configuration UI
2. **Phase 2:** Enhanced approver resolution engine
3. **Phase 3:** Comprehensive step configuration
4. **Phase 4:** Testing framework with 4 users
5. **Phase 5:** Instance execution & monitoring
6. **Phase 6:** Advanced features
