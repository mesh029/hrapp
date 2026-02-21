# Workflow Template Dynamic Configuration - Critical Principles

## Core Principle: ZERO Hardcoded Workflows

**CRITICAL:** The workflow system is **completely dynamic** with **NO hardcoded sequences, NO fixed starting points, and NO required roles**.

---

## What This Means

### ✅ What IS Dynamic

1. **Workflow Steps:**
   - Add unlimited steps (1, 2, 3, 10, 20+)
   - Remove any step (including the first step)
   - Reorder steps (move any step to any position)
   - Change step configuration at any time

2. **First Step:**
   - Can be ANY role you create (e.g., "Supervisor", "Team Lead", "Department Head", "Finance Officer", "CEO")
   - Can be ANY permission (e.g., "leave.approve", "timesheet.approve", or custom permissions)
   - Can be permission-based only (no specific role required)
   - **NOT hardcoded to "Manager" or any other role**

3. **Step Configuration:**
   - Each step can require different permissions
   - Each step can require different roles (or no specific role)
   - Each step can allow/deny decline
   - Each step can allow/deny adjust
   - Each step can specify routing options (where to send back)

4. **Workflow Templates:**
   - Create unlimited templates per location
   - Create unlimited templates per employee type
   - Create templates for different resource types (leave_request, timesheet)
   - Delete or modify any template at runtime

5. **Complete Flexibility:**
   - No minimum or maximum number of steps
   - No required roles in any position
   - No fixed organizational hierarchy
   - No assumptions about approval chains

### ❌ What is NOT Hardcoded

- ❌ **NOT** hardcoded to start with "Manager"
- ❌ **NOT** hardcoded to have specific roles in sequence
- ❌ **NOT** hardcoded to follow any organizational structure
- ❌ **NOT** hardcoded to have minimum/maximum steps
- ❌ **NOT** hardcoded to require specific permissions in order
- ❌ **NOT** hardcoded to any business logic

---

## Default Templates vs. Hardcoded

### Default Templates (Changeable Examples)

The system may come with **default workflow templates** for PATH organization, such as:
- "Manager → Program Officer → HR Manager" (3-step)
- "Manager only" (1-step)

**These are ONLY examples/defaults:**
- ✅ Can be modified (change steps, roles, order)
- ✅ Can be deleted
- ✅ Can be replaced with completely custom workflows
- ✅ Are NOT required - you can delete them and create your own
- ✅ Are NOT enforced - you can create different workflows

### Hardcoded (What We DON'T Have)

- ❌ No code that assumes workflows start with "Manager"
- ❌ No code that requires specific roles in workflows
- ❌ No code that enforces minimum/maximum steps
- ❌ No business logic that depends on specific workflow sequences

---

## How Workflow Resolution Works

### Dynamic Workflow Selection

When a leave request or timesheet is submitted, the system:

1. **Identifies the employee:**
   - Employee type
   - Location
   - Resource type (leave_request or timesheet)

2. **Finds matching workflow template:**
   - Looks for template matching: `location_id` + `employee_type_id` + `resource_type`
   - Falls back to: `location_id` + `resource_type` (if no employee_type match)
   - Falls back to: `resource_type` only (if no location match)
   - **No assumptions about what roles must be in the template**

3. **Resolves approvers for each step:**
   - For each step, finds users with:
     - Required permission (e.g., "leave.approve")
     - Required role (if specified - can be ANY role)
     - Location scope (must be in same/parent location)
   - **No hardcoded role names or sequences**

4. **Executes workflow:**
   - Moves through steps in order (as configured)
   - Each step can approve, decline, or adjust
   - Adjust can route back to any step or to employee
   - **Complete flexibility in flow direction**

---

## API Examples: Creating Completely Custom Workflows

### Example 1: Start with "Supervisor" Instead of "Manager"

```http
POST /api/workflows/templates
{
  "name": "Leave Request - Supervisor First",
  "resource_type": "leave_request",
  "location_id": "nairobi-id",
  "steps": [
    {
      "step_order": 1,
      "required_permission": "leave.approve",
      "required_role_id": "supervisor-role-id",  // NOT Manager!
      "allow_decline": true,
      "allow_adjust": true
    },
    {
      "step_order": 2,
      "required_permission": "leave.approve",
      "required_role_id": "hr-manager-role-id",
      "allow_decline": true,
      "allow_adjust": true
    }
  ]
}
```

### Example 2: Permission-Based Only (No Specific Roles)

```http
POST /api/workflows/templates
{
  "name": "Leave Request - Permission Based",
  "resource_type": "leave_request",
  "location_id": "nairobi-id",
  "steps": [
    {
      "step_order": 1,
      "required_permission": "leave.approve",
      // No required_role_id - any user with permission can approve
      "allow_decline": true,
      "allow_adjust": true
    }
  ]
}
```

### Example 3: Start with "Finance Officer"

```http
POST /api/workflows/templates
{
  "name": "Timesheet Approval - Finance First",
  "resource_type": "timesheet",
  "location_id": "nairobi-id",
  "steps": [
    {
      "step_order": 1,
      "required_permission": "timesheet.approve",
      "required_role_id": "finance-officer-role-id",  // Starts with Finance!
      "allow_decline": true,
      "allow_adjust": true
    },
    {
      "step_order": 2,
      "required_permission": "timesheet.approve",
      "required_role_id": "ceo-role-id",  // Then CEO
      "allow_decline": true,
      "allow_adjust": false
    }
  ]
}
```

### Example 4: Reorder Existing Workflow

```http
// Original: Manager → Program Officer → HR Manager
// Change to: HR Manager → Program Officer → Manager

PATCH /api/workflows/templates/:id/steps/reorder
{
  "step_orders": [
    { "step_id": "step-3-id", "new_order": 1 },  // HR Manager becomes first
    { "step_id": "step-2-id", "new_order": 2 },  // Program Officer stays second
    { "step_id": "step-1-id", "new_order": 3 }   // Manager becomes last
  ]
}
```

### Example 5: Remove First Step

```http
// Remove the first step (e.g., "Manager") from workflow
DELETE /api/workflows/templates/:id/steps/:stepId

// Now workflow starts with what was previously Step 2
```

---

## Database Schema (No Hardcoded Constraints)

```sql
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    location_id UUID REFERENCES locations(id),
    employee_type_id UUID REFERENCES employee_types(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- NO constraints on what roles must be in steps
    -- NO constraints on minimum/maximum steps
    -- NO constraints on step order
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_template_steps (
    id UUID PRIMARY KEY,
    template_id UUID REFERENCES workflow_templates(id),
    step_order INTEGER NOT NULL,
    required_permission VARCHAR(100),  -- Can be ANY permission
    required_role_id UUID REFERENCES roles(id),  -- Can be ANY role, or NULL
    allow_decline BOOLEAN NOT NULL DEFAULT true,
    allow_adjust BOOLEAN NOT NULL DEFAULT false,
    -- NO constraints on what role must be first
    -- NO constraints on what permissions must be used
    -- NO constraints on step order
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Key Points:**
- No foreign key constraints that enforce specific roles
- No check constraints that require "Manager" in first step
- No triggers that assume specific workflow sequences
- Complete flexibility in database design

---

## Implementation Logic (No Hardcoded Business Rules)

### Workflow Execution Logic

```typescript
// Pseudo-code - NO hardcoded role names
function executeWorkflowStep(workflowInstance, step) {
  // Get step configuration from database
  const stepConfig = getStepConfig(step.id);
  
  // Find approvers based on step configuration
  const approvers = findApprovers({
    permission: stepConfig.required_permission,  // From database
    role_id: stepConfig.required_role_id,        // From database (can be NULL)
    location_scope: workflowInstance.location_id
  });
  
  // NO hardcoded checks like:
  // ❌ if (step.order === 1 && role !== 'Manager') throw error;
  // ❌ if (!hasRole('Manager')) throw error;
  
  // Just execute based on database configuration
  return approvers;
}
```

### Workflow Template Creation Logic

```typescript
// Pseudo-code - NO validation of specific roles
function createWorkflowTemplate(templateData) {
  // Validate structure only
  validateTemplateStructure(templateData);
  
  // NO hardcoded validations like:
  // ❌ if (firstStep.role !== 'Manager') throw error;
  // ❌ if (steps.length < 2) throw error;
  // ❌ if (!hasRole('Manager', steps)) throw error;
  
  // Just save to database
  return saveTemplate(templateData);
}
```

---

## Summary

### ✅ The System Provides

1. **Complete Flexibility:**
   - Create workflows with ANY roles in ANY order
   - Start with ANY role/permission
   - Add/remove/reorder steps freely
   - No restrictions on workflow structure

2. **Default Templates (Optional):**
   - PATH defaults (e.g., "Manager → Program Officer → HR Manager")
   - These are just examples
   - Can be modified, deleted, or replaced
   - NOT enforced or required

3. **Dynamic Configuration:**
   - All workflow logic is database-driven
   - No hardcoded business rules
   - Runtime changes take effect immediately
   - Version isolation for running instances

### ❌ The System Does NOT Have

1. **Hardcoded Sequences:**
   - No code that assumes "Manager" must be first
   - No code that requires specific roles
   - No code that enforces organizational hierarchy

2. **Fixed Business Logic:**
   - No minimum/maximum step requirements
   - No required role sequences
   - No assumptions about approval chains

3. **Rigid Structures:**
   - No enforced workflow patterns
   - No mandatory roles
   - No fixed starting points

---

## Conclusion

**The workflow system is designed to be completely dynamic from the ground up.** Every aspect of workflow configuration is database-driven and changeable at runtime. There are NO hardcoded assumptions about what roles must be in workflows, what order they must be in, or what the first step must be.

The examples showing "Manager → Program Officer → HR Manager" are just PATH's default templates - they can be completely changed, deleted, or replaced with any workflow configuration you need.

**The system is built for flexibility first, with defaults as optional starting points.**
