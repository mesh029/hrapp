# Workflow Template Integration Guide

## Overview

Workflow templates define the approval process for leave requests and timesheets. When an employee submits a leave request or timesheet, the system automatically:
1. Finds the appropriate workflow template
2. Creates a workflow instance from that template
3. Resolves who should approve each step
4. Sends notifications to approvers
5. Progresses through steps as approvals are received

---

## 1. What is a Workflow Template?

A **Workflow Template** is a reusable blueprint that defines:
- **Resource Type**: `leave` or `timesheet`
- **Location**: Which location(s) this template applies to
- **Filters** (optional):
  - Staff Type (e.g., HRH Staff, Regular Staff)
  - Leave Type (for leave templates only)
- **Steps**: A sequence of approval steps, each with:
  - Required permission (e.g., `leave.approve`, `timesheet.approve`)
  - Approver strategy (manager, role-based, or combined)
  - Required roles (if role-based)
  - Location scope (same location, parent, descendants, or all)
  - Whether manager approval is included

### Example Template Structure

```
Template: "Nairobi Leave Approval"
├── Location: Nairobi
├── Resource Type: leave
├── Area-Wide: false (location-specific)
├── Staff Type: HRH Staff (optional filter)
├── Leave Type: Annual Leave (optional filter)
└── Steps:
    ├── Step 1: Manager Approval
    │   ├── Permission: leave.approve
    │   ├── Strategy: manager
    │   ├── Include Manager: true
    │   └── Location Scope: same (Same Location Only)
    │
    ├── Step 2: HR Assistant Approval
    │   ├── Permission: leave.approve
    │   ├── Strategy: role
    │   ├── Required Roles: [HR Assistant]
    │   └── Location Scope: all (Any Location)
    │
    └── Step 3: Chief of Party Approval
        ├── Permission: leave.approve
        ├── Strategy: role
        ├── Required Roles: [Chief of Party]
        └── Location Scope: all (Any Location)
```

---

## 2. Template Matching (Finding the Right Template)

When a leave request or timesheet is submitted, the system finds the best matching template using this priority order:

### Priority 0: Explicit Assignments (Highest Priority)
- Admin has explicitly assigned a template to a location
- Checked first, overrides all automatic matching
- Example: "Kisumu" location has "Kisumu Leave Approval" explicitly assigned

### Priority 1-4: Location-Specific Templates (`is_area_wide = false`)
1. **Most Specific**: Location + Staff Type + Leave Type
2. **Location + Staff Type**: Location + Staff Type (any leave type)
3. **Location + Leave Type**: Location + Leave Type (any staff type) - leave only
4. **Location Only**: Just the location (no filters)

### Priority 5-8: Area-Wide Templates (`is_area_wide = true`)
5. **Staff Type + Leave Type**: Any location, specific staff/leave type
6. **Staff Type Only**: Any location, specific staff type
7. **Leave Type Only**: Any location, specific leave type - leave only
8. **No Filters**: Applies to all locations, all staff types, all leave types

### Example Matching Scenarios

**Scenario 1: Employee from Kisumu submits leave**
```
Employee: John Doe
Location: Kisumu
Staff Type: HRH Staff
Leave Type: Annual Leave

Matching Process:
1. Check explicit assignment → Found "Kisumu Leave Approval" ✅
   → Uses this template (stops here)
```

**Scenario 2: Employee from Nairobi submits leave (no explicit assignment)**
```
Employee: Jane Smith
Location: Nairobi
Staff Type: HRH Staff
Leave Type: Annual Leave

Matching Process:
1. Check explicit assignment → None
2. Check location-specific with all filters → Found "Nairobi Leave Approval" (HRH + Annual) ✅
   → Uses this template
```

**Scenario 3: Employee from Mombasa submits timesheet (no location-specific template)**
```
Employee: Bob Johnson
Location: Mombasa
Staff Type: Regular Staff

Matching Process:
1. Check explicit assignment → None
2. Check location-specific templates → None found
3. Check area-wide templates → Found "National Timesheet Approval" ✅
   → Uses this template
```

---

## 3. Complete Submission Flow

### 3.1 Leave Request Submission

**Endpoint**: `POST /api/leave/requests/[id]/submit`

**Step-by-Step Process**:

1. **User Action**: Employee clicks "Submit" on their leave request
2. **Validation**:
   - Check user is the creator
   - Check leave request is in `Draft` or `Adjusted` status
   - Validate leave request data
3. **Find Template**:
   ```typescript
   const templateId = await findWorkflowTemplate({
     resourceType: 'leave',
     locationId: leaveRequest.location_id,
     staffTypeId: leaveRequest.user.staff_type_id,
     leaveTypeId: leaveRequest.leave_type_id,
   });
   ```
4. **Create Workflow Instance**:
   - Creates a `WorkflowInstance` record
   - Creates `WorkflowStepInstance` records for each step in the template
   - Links the instance to the leave request
5. **Submit Workflow**:
   - Changes instance status from `Draft` to `Submitted`
   - Sets `current_step_order` to the first step
   - Resolves approvers for the first step
   - Sends notifications to approvers
6. **Update Leave Request**:
   - Changes status from `Draft` to `Submitted`
   - Links `workflow_instance_id` to the leave request
   - Adds pending days to leave balance

### 3.2 Timesheet Submission

**Endpoint**: `POST /api/timesheets/[id]/submit`

**Step-by-Step Process**:

1. **User Action**: Employee clicks "Submit" on their timesheet
2. **Validation**:
   - Check user has `timesheets.submit` permission
   - Check timesheet is in `Draft` status
   - Validate timesheet data (hours, dates, etc.)
   - Check submission period is enabled
3. **Find Template**:
   ```typescript
   const templateId = await findWorkflowTemplate({
     resourceType: 'timesheet',
     locationId: timesheet.location_id,
     staffTypeId: timesheetOwner.staff_type_id,
   });
   ```
4. **Create Workflow Instance**: Same as leave requests
5. **Submit Workflow**: Same as leave requests
6. **Update Timesheet**:
   - Changes status from `Draft` to `Submitted`
   - Links `workflow_instance_id` to the timesheet

---

## 4. Workflow Instance Creation

When `createWorkflowInstance()` is called:

```typescript
const instance = await createWorkflowInstance({
  templateId: "template-uuid",
  resourceId: "leave-request-uuid",
  resourceType: "leave",
  createdBy: "user-uuid",
  locationId: "location-uuid",
});
```

**What Happens**:

1. **Load Template**: Fetches template with all its steps
2. **Create Instance**:
   ```sql
   INSERT INTO workflow_instances (
     workflow_template_id,
     resource_id,
     resource_type,
     created_by,
     status,              -- 'Draft'
     current_step_order   -- 0 (not started)
   )
   ```
3. **Create Step Instances**: For each step in the template:
   ```sql
   INSERT INTO workflow_step_instances (
     workflow_instance_id,
     step_order,
     status  -- 'pending'
   )
   ```

**Result**: A workflow instance with all steps initialized as `pending`

---

## 5. Workflow Submission (Moving to First Step)

When `submitWorkflowInstance()` is called:

**What Happens**:

1. **Validate**: Instance must be in `Draft` status
2. **Get First Step**: Find step with `step_order = 1`
3. **Update Instance**:
   ```sql
   UPDATE workflow_instances
   SET status = 'Submitted',
       current_step_order = 1
   WHERE id = instanceId
   ```
4. **Resolve Approvers**: Calls `resolveApprovers()` for step 1
5. **Send Notifications**: Notifies all resolved approvers

**Result**: Workflow is now active, approvers are notified, waiting for first approval

---

## 6. Approver Resolution

The `resolveApprovers()` function determines who can approve a step based on the step configuration.

### Step Configuration Options

1. **Manager Strategy** (`approver_strategy: 'manager'`):
   - Finds the employee's direct manager
   - Checks manager has required permission
   - Checks location scope (if manager is in same/parent/descendant location)
   - Returns: `[manager.id]` or `[]`

2. **Role Strategy** (`approver_strategy: 'role'`):
   - Finds all users with the required roles
   - Checks users have required permission
   - Checks location scope
   - Excludes users who already approved previous steps
   - Returns: `[user1.id, user2.id, ...]`

3. **Combined Strategy** (`approver_strategy: 'combined'`):
   - Includes manager (if `include_manager = true`)
   - Includes users with required roles
   - Applies same checks as above
   - Returns: `[manager.id, user1.id, user2.id, ...]`

### Location Scope Logic

The system uses the **template's location** as the reference point for location scope checks:

- **Same Location Only**: Approver must be in the same location as the template
- **Parent Location**: Approver must be in a parent location of the template
- **Descendant Locations**: Approver must be in a descendant location of the template
- **Any Location**: Approver can be from any location

**Important**: If template is `is_area_wide = true`, all location scope checks are treated as "Any Location"

### Example: Resolving Approvers for Step 1

```
Step Configuration:
- Strategy: manager
- Permission: leave.approve
- Location Scope: same

Employee: John Doe (Kisumu)
Manager: Jane Smith (Kisumu)

Resolution Process:
1. Find employee's manager → Jane Smith ✅
2. Check manager has permission → Has leave.approve ✅
3. Check location scope:
   - Template location: Kisumu
   - Manager location: Kisumu
   - Scope: same
   - Match? Yes ✅
4. Result: [Jane Smith's ID]
```

### Example: Resolving Approvers for Step 2

```
Step Configuration:
- Strategy: role
- Required Roles: [HR Assistant]
- Permission: leave.approve
- Location Scope: all

Resolution Process:
1. Find all users with "HR Assistant" role → [Alice, Bob, Charlie]
2. Check each has leave.approve permission:
   - Alice: ✅
   - Bob: ✅
   - Charlie: ❌ (no permission)
3. Check location scope: all → All locations allowed ✅
4. Exclude previous approvers: None (this is step 2) ✅
5. Result: [Alice's ID, Bob's ID]
```

---

## 7. Workflow Progression

### 7.1 When an Approver Approves

**Endpoint**: `POST /api/workflows/instances/[id]/approve`

**Step-by-Step Process**:

1. **Validate Authority**:
   - Check user has required permission
   - Check user is in resolved approvers list
   - Check user has authority for this step

2. **Update Step Instance**:
   ```sql
   UPDATE workflow_step_instances
   SET status = 'approved',
       acted_by = userId,
       acted_at = NOW(),
       comment = '...',
       digital_signature = '...'
   WHERE workflow_instance_id = ? AND step_order = ?
   ```

3. **Check if Last Step**:
   - If yes: Mark workflow as `Approved`, update resource status
   - If no: Move to next step

4. **Move to Next Step** (if not last):
   ```sql
   UPDATE workflow_instances
   SET status = 'UnderReview',
       current_step_order = nextStep.step_order
   WHERE id = instanceId
   ```

5. **Resolve Next Step Approvers**: Calls `resolveApprovers()` for next step

6. **Send Notifications**: Notifies all approvers for the next step

### 7.2 Workflow States

- **Draft**: Workflow instance created but not submitted
- **Submitted**: Submitted, waiting for first step approval
- **UnderReview**: In progress, waiting for current step approval
- **Approved**: All steps approved, workflow complete
- **Declined**: A step was declined, workflow stopped

### 7.3 Example: Complete Workflow Progression

```
Day 1, 9:00 AM: Employee submits leave request
├── Workflow Instance Created (status: Draft)
├── Workflow Submitted (status: Submitted, step: 1)
├── Approvers Resolved: [Manager: Jane Smith]
└── Notification Sent: Jane Smith receives email

Day 1, 2:00 PM: Jane Smith approves Step 1
├── Step 1 marked as approved
├── Workflow moves to Step 2 (status: UnderReview, step: 2)
├── Approvers Resolved: [HR Assistant: Alice, Bob]
└── Notifications Sent: Alice and Bob receive emails

Day 2, 10:00 AM: Alice approves Step 2
├── Step 2 marked as approved
├── Workflow moves to Step 3 (status: UnderReview, step: 3)
├── Approvers Resolved: [Chief of Party: Charlie]
└── Notification Sent: Charlie receives email

Day 2, 4:00 PM: Charlie approves Step 3
├── Step 3 marked as approved
├── Workflow complete (status: Approved)
├── Leave Request status updated to "Approved"
└── Employee receives notification of approval
```

---

## 8. Integration Points

### 8.1 Leave Request Integration

**When Leave is Created**:
- Status: `Draft`
- No workflow instance created yet
- Employee can edit/delete

**When Leave is Submitted**:
- Workflow instance created
- Workflow submitted (moves to first step)
- Status: `Submitted`
- Pending days added to leave balance

**When Workflow is Approved**:
- Leave request status: `Approved`
- Pending days converted to approved days
- Employee can view approved leave

**When Workflow is Declined**:
- Leave request status: `Declined`
- Pending days removed
- Employee can adjust and resubmit

### 8.2 Timesheet Integration

**When Timesheet is Created**:
- Status: `Draft`
- No workflow instance created yet
- Employee can edit/delete

**When Timesheet is Submitted**:
- Workflow instance created
- Workflow submitted (moves to first step)
- Status: `Submitted`
- Timesheet locked for editing

**When Workflow is Approved**:
- Timesheet status: `Approved`
- Timesheet finalized
- Can be used for payroll processing

**When Workflow is Declined**:
- Timesheet status: `Declined`
- Employee can adjust and resubmit

---

## 9. Key Features

### 9.1 Automatic Template Matching
- No manual assignment needed (unless admin wants explicit control)
- System finds best matching template automatically
- Supports location-specific and area-wide templates

### 9.2 Flexible Approver Resolution
- Manager-based: Uses employee's direct manager
- Role-based: Uses users with specific roles
- Combined: Manager + roles
- Location-aware: Respects location hierarchy

### 9.3 Dynamic Approver Resolution
- Approvers resolved at each step
- Considers who already approved (prevents duplicate approvals)
- Respects location scope and permissions

### 9.4 Notifications
- Approvers receive notifications when assigned to a step
- Employee receives notification when workflow is approved/declined
- Email and in-app notifications

### 9.5 Audit Trail
- All workflow actions are logged
- Digital signatures for approvals
- IP address and user agent tracking
- Complete history of workflow progression

---

## 10. Admin Controls

### 10.1 Template Management
- Create/edit/delete templates
- Configure steps with roles and permissions
- Set location scope for each step
- Enable/disable area-wide templates

### 10.2 Explicit Assignments
- Assign specific templates to locations
- Override automatic template matching
- View all assignments in one place
- Easy to change assignments

### 10.3 Visibility
- See which template each location uses
- Track template usage (active instances)
- Monitor workflow progress

---

## Summary

The workflow template system provides:

1. **Automatic Routing**: Templates are automatically matched based on location, staff type, and leave type
2. **Flexible Configuration**: Each step can have different approvers (manager, roles, or both)
3. **Location Awareness**: Approvers are filtered by location scope
4. **Dynamic Resolution**: Approvers are resolved at each step, ensuring the right people approve
5. **Complete Integration**: Seamlessly integrated with leave requests and timesheets
6. **Admin Control**: Admins can explicitly assign templates or let the system auto-match

The system ensures that every leave request and timesheet follows the correct approval process based on organizational rules and location-specific requirements.
