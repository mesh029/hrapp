# Workflow Engine Test Scenario

**Date:** February 24, 2025  
**Purpose:** Comprehensive test scenario to validate workflow engine capabilities and UI accuracy

---

## Scenario Overview

**Organization:** PATH Kenya  
**Location:** Nairobi  
**Test Period:** Current Date Range

### Test Users Setup

1. **Employee (Requester):**
   - Name: John Mutua
   - Email: john.mutua@test.com
   - Role: Employee (no role assigned)
   - Staff Type: Regular
   - Location: Nairobi
   - Manager: Peter Kamau (Program Officer)

2. **First Approver (Manager):**
   - Name: Peter Kamau
   - Email: peter.kamau@test.com
   - Role: Program Officer
   - Staff Type: Regular
   - Location: Nairobi
   - Manager: Dr. Sarah Mwangi (Chief of Party)
   - Permissions: `leave.approve`, `leave.decline`, `timesheet.approve`, `timesheet.decline`

3. **Second Approver (HR Manager):**
   - Name: James Ochieng
   - Email: james.ochieng@test.com
   - Role: HR Manager
   - Staff Type: Regular
   - Location: Nairobi
   - Manager: Dr. Sarah Mwangi
   - Permissions: `leave.approve`, `leave.decline`, `timesheet.approve`, `timesheet.decline`, `users.read`, `users.update`

4. **Final Approver (Chief of Party):**
   - Name: Dr. Sarah Mwangi
   - Email: sarah.mwangi@test.com
   - Role: Chief of Party
   - Staff Type: Regular
   - Location: Nairobi
   - Manager: None (Top level)
   - Permissions: `leave.approve`, `leave.decline`, `timesheet.approve`, `timesheet.decline`, `workflows.read`, `audit.read`

---

## Test Case 1: Leave Request Approval Flow

### Scenario
John Mutua (Employee) requests 5 days of Annual Leave, which must be approved by:
1. His direct manager (Peter Kamau - Program Officer)
2. HR Manager (James Ochieng)
3. Chief of Party (Dr. Sarah Mwangi)

### Expected Workflow Template Configuration

**Template Name:** "Nairobi Regular Employee Leave Requests"  
**Resource Type:** `leave`  
**Location:** Nairobi  
**Staff Type:** Regular (optional filter)  
**Leave Type:** Annual Leave (optional filter)

**Steps:**
1. **Step 1:** Manager Approval
   - Required Permission: `leave.approve`
   - Approver Strategy: `manager` (or `combined` with `include_manager: true`)
   - Location Scope: `same`
   - Allow Decline: `true`
   - Allow Adjust: `false`

2. **Step 2:** HR Manager Approval
   - Required Permission: `leave.approve`
   - Approver Strategy: `role`
   - Required Roles: [HR Manager role ID]
   - Location Scope: `same`
   - Allow Decline: `true`
   - Allow Adjust: `true`

3. **Step 3:** Chief of Party Approval
   - Required Permission: `leave.approve`
   - Approver Strategy: `role`
   - Required Roles: [Chief of Party role ID]
   - Location Scope: `same`
   - Allow Decline: `true`
   - Allow Adjust: `false`

### Test Flow

1. **Create Template:**
   - Navigate to Workflows → Templates → New Template
   - Select Resource Type: `leave`
   - Select Location: Nairobi
   - Select Staff Type: Regular (optional)
   - Select Leave Type: Annual Leave (optional)
   - Add 3 steps as configured above
   - Save template

2. **Submit Leave Request:**
   - Login as John Mutua
   - Navigate to Leave → New Leave Request
   - Select Leave Type: Annual Leave
   - Select Dates: 5 days
   - Submit for approval

3. **Approval Flow:**
   - **Step 1:** Login as Peter Kamau → Approve
   - **Step 2:** Login as James Ochieng → Approve
   - **Step 3:** Login as Dr. Sarah Mwangi → Approve
   - **Expected:** Leave request status = "Approved"

4. **Rejection Flow (Alternative):**
   - **Step 1:** Login as Peter Kamau → Decline
   - **Expected:** Leave request status = "Declined", workflow stops

---

## Test Case 2: Timesheet Approval Flow

### Scenario
John Mutua submits a timesheet for the previous 2 weeks, which must be approved by:
1. His direct manager (Peter Kamau)
2. HR Manager (James Ochieng)

### Expected Workflow Template Configuration

**Template Name:** "Nairobi Regular Employee Timesheets"  
**Resource Type:** `timesheet`  
**Location:** Nairobi  
**Staff Type:** Regular (optional filter)

**Steps:**
1. **Step 1:** Manager Approval
   - Required Permission: `timesheet.approve`
   - Approver Strategy: `manager`
   - Location Scope: `same`
   - Allow Decline: `true`
   - Allow Adjust: `true`

2. **Step 2:** HR Manager Approval
   - Required Permission: `timesheet.approve`
   - Approver Strategy: `role`
   - Required Roles: [HR Manager role ID]
   - Location Scope: `same`
   - Allow Decline: `true`
   - Allow Adjust: `false`

### Test Flow

1. **Create Template:**
   - Navigate to Workflows → Templates → New Template
   - Select Resource Type: `timesheet`
   - Select Location: Nairobi
   - Select Staff Type: Regular (optional)
   - Add 2 steps as configured above
   - Save template

2. **Submit Timesheet:**
   - Login as John Mutua
   - Navigate to Timesheets → New Timesheet
   - Select Period: Previous 2 weeks
   - Add entries for each day
   - Submit for approval

3. **Approval Flow:**
   - **Step 1:** Login as Peter Kamau → Approve
   - **Step 2:** Login as James Ochieng → Approve
   - **Expected:** Timesheet status = "Approved"

4. **Rejection Flow (Alternative):**
   - **Step 1:** Login as Peter Kamau → Decline
   - **Expected:** Timesheet status = "Declined", workflow stops

---

## Test Case 3: Workflow Simulation

### Scenario
Test the workflow simulator to verify:
1. Template selection works
2. Employee selection works
3. Real leave/timesheet creation works
4. Step-by-step approval works
5. Timeline is saved correctly
6. Rejection flow works

### Test Flow

1. **Start Simulation:**
   - Navigate to Workflows → Testing & Simulation → Workflow Simulator
   - Select Template: "Nairobi Regular Employee Leave Requests"
   - Select Employee: John Mutua
   - Click "Create Request & Start Simulation"

2. **Verify Creation:**
   - Check that a real leave request was created
   - Check that workflow instance was created
   - Check that step instances were created
   - Verify link to view the leave request

3. **Test Approval:**
   - Click "Approve" on Step 1 (should show Peter Kamau as approver)
   - Verify workflow moves to Step 2
   - Click "Approve" on Step 2 (should show James Ochieng)
   - Verify workflow moves to Step 3
   - Click "Approve" on Step 3 (should show Dr. Sarah Mwangi)
   - Verify workflow completes (status = "Approved")

4. **Test Rejection:**
   - Start new simulation
   - Click "Decline" on Step 1
   - Verify workflow stops (status = "Declined")
   - Verify timeline shows rejection

---

## Workflow Engine Capabilities (From API Analysis)

### Core Capabilities

1. **Template Matching:**
   - Priority-based template selection
   - Filters: location, staff_type, leave_type
   - Most specific match wins

2. **Approver Resolution Strategies:**
   - `permission`: Users with required permission
   - `manager`: Employee's direct manager
   - `role`: Users with specific roles
   - `combined`: Combination of above

3. **Location Scoping:**
   - `same`: Same location only
   - `parent`: Parent location
   - `descendants`: Child locations
   - `all`: All locations

4. **Workflow Actions:**
   - Approve: Move to next step or complete
   - Decline: Stop workflow, mark as declined
   - Adjust: Send back for revision (if allowed)
   - Route: Route to specific step (conditional routing)

5. **Step Configuration:**
   - Required permission
   - Approver strategy
   - Include manager flag
   - Required roles (array)
   - Location scope
   - Allow decline flag
   - Allow adjust flag
   - Conditional rules (JSON)

6. **Notifications:**
   - Automatic notification on step assignment
   - Notification on completion
   - Notification on rejection

7. **Audit Trail:**
   - All actions logged
   - Digital signatures
   - IP address tracking
   - User agent tracking

---

## UI Validation Checklist

### Template Creation Page (`/workflows/templates/new`)

- [ ] Resource type dropdown shows: `leave`, `timesheet`
- [ ] Location dropdown shows all active locations
- [ ] Staff type dropdown shows all staff types (with "All Employee Types" option)
- [ ] Leave type dropdown shows all leave types (only for leave workflows, with "All Leave Types" option)
- [ ] "Add Step" button opens StepConfigurationDialog
- [ ] StepConfigurationDialog shows:
  - [ ] Required permission dropdown (filtered by resource type)
  - [ ] Approver strategy dropdown: `permission`, `manager`, `role`, `combined`
  - [ ] Include manager toggle
  - [ ] Required roles multi-select (shows all roles)
  - [ ] Location scope dropdown: `same`, `parent`, `descendants`, `all`
  - [ ] Allow decline toggle
  - [ ] Allow adjust toggle
  - [ ] Conditional rules builder
- [ ] Drag-and-drop reordering works
- [ ] Step preview shows correct approvers
- [ ] Template can be saved successfully

### Template Edit Page (`/workflows/templates/[id]`)

- [ ] All fields from creation page are editable
- [ ] "Add Step" button works (opens dialog)
- [ ] "Edit" button on existing steps works
- [ ] Step removal works (with confirmation)
- [ ] Changes can be saved

### Workflow Simulator (`/workflows/test/simulator`)

- [ ] Template dropdown shows all active templates
- [ ] Employee dropdown shows all active users
- [ ] "Create Request & Start Simulation" creates real data
- [ ] Simulation shows all steps with correct approvers
- [ ] Approve button works for each step
- [ ] Decline button works for each step
- [ ] Timeline updates correctly after each action
- [ ] Link to created leave/timesheet works
- [ ] Auto-run works correctly

### Pending Approvals Page (`/approvals/pending`)

- [ ] Shows only items requiring current user's approval
- [ ] Displays correct step information
- [ ] Links to leave/timesheet details work
- [ ] Approve/decline actions work

---

## Expected Behaviors

### Approver Resolution

1. **Manager Strategy:**
   - Resolves to employee's `manager_id`
   - Checks manager has required permission
   - Checks location scope
   - Checks authority

2. **Role Strategy:**
   - Resolves to all users with required roles
   - Filters by required permission
   - Filters by location scope
   - Checks authority for each

3. **Permission Strategy:**
   - Resolves to all users with required permission
   - Filters by location scope
   - Checks authority for each

4. **Combined Strategy:**
   - Includes manager (if configured)
   - Includes role-based approvers
   - Includes permission-based approvers
   - Deduplicates

### Workflow Progression

1. **On Submit:**
   - Creates workflow instance
   - Creates step instances for all steps
   - Moves to first step
   - Resolves approvers for first step
   - Notifies approvers

2. **On Approve:**
   - Marks step as approved
   - If last step: Marks workflow as "Approved"
   - If not last: Moves to next step, resolves approvers, notifies
   - Updates resource status (leave/timesheet)

3. **On Decline:**
   - Marks step as declined
   - Marks workflow as "Declined"
   - Stops workflow progression
   - Updates resource status

4. **On Adjust:**
   - Marks step as adjusted
   - Routes back to specified step (or step 1)
   - Resolves approvers for target step
   - Notifies approvers

---

## Test Execution Plan

1. **Phase 1: Template Creation**
   - Create leave workflow template
   - Create timesheet workflow template
   - Verify all dropdowns are accurate
   - Verify all configurations save correctly

2. **Phase 2: Simulation Testing**
   - Test leave workflow simulation
   - Test timesheet workflow simulation
   - Test approval flow
   - Test rejection flow
   - Verify timeline accuracy

3. **Phase 3: Real User Testing**
   - Login as employee, submit leave
   - Login as approvers, approve/decline
   - Verify notifications
   - Verify timeline on detail pages

4. **Phase 4: Edge Cases**
   - Test with different staff types
   - Test with different leave types
   - Test location scoping
   - Test conditional routing

---

## Success Criteria

✅ All dropdowns show correct data  
✅ Template creation works without errors  
✅ Template editing works without errors  
✅ Simulation creates real data  
✅ Approver resolution is accurate  
✅ Approval flow works end-to-end  
✅ Rejection flow works correctly  
✅ Timeline is saved and displayed correctly  
✅ Notifications are sent  
✅ All UI elements are functional  
