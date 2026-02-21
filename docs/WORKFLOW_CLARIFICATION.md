# Workflow System Clarification

## Key Concepts

### 1. Workflow Templates (Created by Admins/HR Managers)

**Who Creates:** System Administrators, HR Managers, or users with `workflows.templates.create` permission

**What They Are:** Pre-defined approval sequences that can be reused

**Examples:**
- "Nairobi Leave Request - 3 Step Approval"
- "Kisumu Timesheet Approval - 2 Step"
- "HRH Staff Leave Request - Manager Only"

**Structure:**
- Location-specific (each location can have different workflows)
- Resource-type specific (leave vs timesheet)
- Contains ordered steps with required permissions

**API:** `POST /api/workflows/templates`

---

### 2. Workflow Instances (Created by Employees)

**Who Creates:** Employees (Regular Staff, Temporary Staff, HRH Staff, or any dynamic employee type) when they submit:
- Leave requests
- Timesheets

**What They Are:** Actual approval workflows tied to a specific resource (leave request or timesheet)

**Key Field:** `created_by` = **The Employee's ID** (not admin, not template creator)

**Flow:**
1. Employee creates leave request or timesheet (status: Draft)
2. Employee submits for approval
3. System creates WorkflowInstance with:
   - `created_by` = employee.id
   - `resource_id` = leave_request.id or timesheet.id
   - `resource_type` = 'leave' or 'timesheet'
   - `workflow_template_id` = template matching location + resource type
4. Workflow moves through approval steps

---

### 3. Manager Assignment (For Employees)

**Who Has Managers:** Employees (Regular, Temp, HRH, or any dynamic type)

**Purpose:** 
- Organizational hierarchy
- Approval workflows can optionally include employee's manager as approver
- Some employees need managers, others don't (fully optional)

**Example:**
- Regular Staff employee → has Manager assigned
- When employee submits leave request → Manager can be first approver
- HRH Staff employee → may or may not have manager (depends on org structure)

---

### 4. Approver Resolution

When a workflow step needs approvers, the system:

1. **Finds all users with required permission** for the location
2. **Optionally includes employee's manager** (if `includeEmployeeManager: true`)
   - Gets the employee from `workflow_instance.created_by`
   - Checks if employee has a `manager_id`
   - If manager has the required permission + location scope → adds to approvers
3. **Filters by authority** (permission + location scope + delegation)

**Important:** The manager being considered is the **EMPLOYEE's manager** (the one who submitted the request), NOT the template creator's manager.

---

## Example Flow

### Scenario: Regular Staff Employee Submits Leave Request

1. **Employee:** John Doe (Regular Staff, Nairobi Office, has Manager: Jane Smith)
2. **Employee creates leave request** → Status: Draft
3. **Employee submits** → System creates WorkflowInstance:
   ```
   created_by: john_doe.id
   resource_id: leave_request_123.id
   resource_type: 'leave'
   workflow_template_id: nairobi_leave_template.id
   ```
4. **Workflow template steps:**
   - Step 1: `leave.approve` permission (can include manager)
   - Step 2: `leave.approve` permission
   - Step 3: `leave.approve` permission
5. **System resolves Step 1 approvers:**
   - Finds all users with `leave.approve` in Nairobi
   - Optionally includes John's manager (Jane Smith) if she has permission
   - Returns list of approvers
6. **Jane Smith (Manager) approves** → Moves to Step 2
7. **Step 2 approver approves** → Moves to Step 3
8. **Step 3 approver approves** → Leave request approved

---

## API Endpoints Summary

### Workflow Templates (Admin/HR)
- `GET /api/workflows/templates` - List templates
- `POST /api/workflows/templates` - Create template (admin/HR only)
- `PATCH /api/workflows/templates/:id` - Update template
- `POST /api/workflows/templates/:id/steps` - Add step
- `DELETE /api/workflows/templates/:id/steps/:stepId` - Remove step

### Workflow Instances (Employee Actions)
- `POST /api/leave/requests/:id/submit` - Employee submits leave (creates instance)
- `POST /api/timesheets/:id/submit` - Employee submits timesheet (creates instance)
- `GET /api/workflows/instances/:id` - View workflow status
- `POST /api/workflows/instances/:id/approve` - Approver approves
- `POST /api/workflows/instances/:id/decline` - Approver declines
- `POST /api/workflows/instances/:id/adjust` - Approver adjusts

---

## Key Points

1. **Templates = Admin/HR create** → Define approval sequences
2. **Instances = Employees create** → Actual approval workflows for their requests
3. **Manager = Employee's manager** → Used in approver resolution for employee's requests
4. **Dynamic** → Everything is configurable, no hardcoded sequences
5. **Optional** → Managers are optional, workflows work with or without them
