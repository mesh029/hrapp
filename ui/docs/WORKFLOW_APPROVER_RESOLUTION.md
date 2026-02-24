# Workflow Approver Resolution Logic

## Understanding How Approvers Are Determined

When you create a workflow template, you configure each step to specify **WHO** should approve at that step. The system then automatically determines the specific approver(s) based on:

1. **The workflow step configuration** (from the template)
2. **The employee** who submitted the request
3. **The employee's manager** (if manager strategy is used)
4. **Required roles** (if role-based strategy is used)
5. **Required permissions** (if permission-based strategy is used)

## Workflow Step Configuration

Each workflow step has:
- **Approver Strategy**: `manager`, `role`, `permission`, or `combined`
- **Required Permission**: The permission needed to approve (e.g., `leave.approve`, `timesheet.approve`)
- **Required Roles** (if role-based): Specific roles that can approve (e.g., `HR Manager`, `Program Officer`)
- **Include Manager** (if combined): Whether to include the employee's manager
- **Location Scope**: Where approvers can be located (`same`, `parent`, `descendants`, `all`)

## Approver Resolution Rules

### Strategy: `manager`
- **ONLY** the employee's direct manager (`employee.manager_id`)
- Manager must have the required permission
- Manager must match location scope
- **Result**: ONE approver (the manager)

### Strategy: `role`
- **ONLY** users who have one of the `required_roles` specified in the step
- Users must have the required permission
- Users must match location scope
- **Result**: All users with the specified role(s) who meet criteria

### Strategy: `permission`
- **ONLY** users who have the required permission
- Users must match location scope
- **Result**: All users with the permission who meet criteria

### Strategy: `combined`
- Includes manager (if `include_manager` is true)
- Includes users with required roles (if `required_roles` is specified)
- Includes users with required permission (always)
- **Result**: Combination of above (deduplicated)

## Important Rules

1. **System Administrators are NOT automatically included** unless:
   - They are the employee's manager (manager strategy)
   - They have one of the required roles (role strategy)
   - They have the required permission AND permission strategy is used

2. **The approvers shown are ONLY those who match the exact step configuration**

3. **Each step can have different approvers** based on its configuration:
   - Step 1: Manager (employee's manager)
   - Step 2: HR Manager role (all users with HR Manager role)
   - Step 3: Permission-based (all users with `leave.approve` permission)

## Example Workflow

**Template**: "Nairobi Leave Approval"
- **Step 1**: Manager approval
  - Strategy: `manager`
  - Permission: `leave.approve`
  - **Result**: Only the employee's manager
  
- **Step 2**: HR Assistant approval
  - Strategy: `role`
  - Required Roles: `HR Assistant`
  - Permission: `leave.approve`
  - **Result**: Only users with HR Assistant role
  
- **Step 3**: HR Manager approval
  - Strategy: `role`
  - Required Roles: `HR Manager`
  - Permission: `leave.approve`
  - **Result**: Only users with HR Manager role

## In Simulation

When simulating a workflow:
- The system resolves approvers based on the step configuration
- **ONLY** the approvers who match the step configuration are shown
- The admin can approve "as" one of those specific approvers
- The approval is recorded with that approver's ID, not the admin's ID

## Key Point

**The workflow template defines WHO approves at each step. The system automatically finds those specific people based on the employee and the step configuration. System Administrators are NOT included unless they specifically match the criteria (e.g., they're the manager or have the required role).**
