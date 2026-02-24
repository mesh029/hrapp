# Workflow Template Implementation Guide

## How Templates Are Automatically Selected

When an employee submits a leave request or timesheet, the system **automatically finds and uses** the appropriate workflow template based on:

1. **Resource Type** (leave or timesheet)
2. **Location** (employee's location)
3. **Staff Type** (optional - employee's staff type)
4. **Leave Type** (optional - only for leave requests)

### Template Selection Priority

The system uses a priority-based matching system:

1. **Priority 1 (Most Specific)**: Matches all filters
   - Location + Staff Type + Leave Type (for leave)
   - Example: "Kisumu" + "HRH Staff" + "Annual Leave"

2. **Priority 2**: Matches Location + Staff Type
   - Leave Type can be null
   - Example: "Kisumu" + "HRH Staff"

3. **Priority 3**: Matches Location + Leave Type (leave only)
   - Staff Type can be null
   - Example: "Kisumu" + "Annual Leave"

4. **Priority 4 (Least Specific)**: Matches Location only
   - No Staff Type or Leave Type filters
   - Example: "Kisumu" only

### How It Works

**For Leave Requests:**
```typescript
// When employee submits leave request
const templateId = await findWorkflowTemplate({
  resourceType: 'leave',
  locationId: leaveRequest.location_id,        // Employee's location
  staffTypeId: employee.staff_type_id,        // Employee's staff type
  leaveTypeId: leaveRequest.leave_type_id,   // Leave type
});
```

**For Timesheets:**
```typescript
// When employee submits timesheet
const templateId = await findWorkflowTemplate({
  resourceType: 'timesheet',
  locationId: timesheet.location_id,          // Employee's location
  staffTypeId: employee.staff_type_id,        // Employee's staff type
});
```

## Setting Up a Kisumu Workflow Template

To create a workflow template that applies to **all staff from Kisumu**:

### Step 1: Create the Template

1. Go to **Workflows > Templates > New Template**
2. Fill in:
   - **Template Name**: "Kisumu Leave Approval" (or "Kisumu Timesheet Approval")
   - **Resource Type**: `leave` or `timesheet`
   - **Location**: Select **Kisumu** from the dropdown
   - **Employee Type**: Leave empty (to apply to all staff types)
   - **Leave Type**: Leave empty (to apply to all leave types)
   - **Status**: `Active`

### Step 2: Configure Steps

Add workflow steps with:
- **Required Permission**: `leave.approve` or `timesheet.approve`
- **Include Manager**: Enable if manager should approve first
- **Required Roles**: Select roles (e.g., "HR Assistant", "HR Manager")
- **Location Scope**: Choose where approvers should be located
  - "Any Location" = approvers from anywhere
  - "Same Location Only" = approvers must be at Kisumu (template location)

### Step 3: Save and Activate

- Save the template
- Ensure status is `Active`
- The template will now be automatically used for all Kisumu employees

## How It Works in Practice

### Example: Kisumu Leave Request

1. **Employee creates leave request**:
   - Employee: John (Location: Kisumu, Staff Type: HRH Staff)
   - Leave Type: Annual Leave

2. **Employee submits leave request**:
   - System calls `findWorkflowTemplate()` with:
     - `locationId`: Kisumu's location ID
     - `staffTypeId`: HRH Staff ID
     - `leaveTypeId`: Annual Leave ID

3. **Template matching**:
   - System looks for template matching Kisumu + HRH Staff + Annual Leave
   - If not found, tries Kisumu + HRH Staff
   - If not found, tries Kisumu + Annual Leave
   - If not found, tries Kisumu only
   - If still not found, returns error

4. **Workflow created**:
   - System creates workflow instance from matched template
   - Resolves approvers for Step 1 based on template configuration
   - Sends notifications to approvers

5. **Notifications sent**:
   - Each approver receives a notification
   - Email notification sent (if SMTP configured)
   - Approvers can see pending approvals in their dashboard

## Notifications

### ✅ Notifications Are Implemented

The system sends notifications when:

1. **Workflow Submitted**:
   - Notifies all approvers for Step 1
   - Notification type: `approval_request`
   - Email sent: Yes (if SMTP configured)

2. **Step Approved**:
   - Notifies next step's approvers (if exists)
   - Notifies requester when workflow completes
   - Notification type: `approval_complete`

3. **Step Declined**:
   - Notifies requester
   - Notification type: `approval_complete`

### Notification Details

- **In-App Notifications**: Stored in database, visible in UI
- **Email Notifications**: Sent if SMTP is configured
- **Notification Types**:
  - `approval_request`: New approval needed
  - `approval_complete`: Approval workflow finished

### Email Configuration

Email notifications require SMTP configuration. Check your environment variables:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

## Template Matching Examples

### Example 1: Kisumu Template for All Staff

**Template Configuration:**
- Name: "Kisumu Leave Approval"
- Location: Kisumu
- Staff Type: (empty - applies to all)
- Leave Type: (empty - applies to all)

**Result:**
- ✅ Matches all Kisumu employees
- ✅ Works for any staff type
- ✅ Works for any leave type

### Example 2: Kisumu Template for HRH Staff Only

**Template Configuration:**
- Name: "Kisumu HRH Leave Approval"
- Location: Kisumu
- Staff Type: HRH Staff
- Leave Type: (empty)

**Result:**
- ✅ Matches Kisumu employees with HRH Staff type
- ❌ Does NOT match Kisumu employees with other staff types
- ✅ Works for any leave type

### Example 3: Kisumu Template for Specific Leave Type

**Template Configuration:**
- Name: "Kisumu Annual Leave Approval"
- Location: Kisumu
- Staff Type: (empty)
- Leave Type: Annual Leave

**Result:**
- ✅ Matches Kisumu employees requesting Annual Leave
- ❌ Does NOT match other leave types
- ✅ Works for any staff type

## Best Practices

1. **Start Broad, Then Narrow**:
   - Create a general template (location only)
   - Add specific templates for special cases (staff type, leave type)

2. **Location is Required**:
   - Every template must have a location
   - This ensures templates are location-specific

3. **Use Descriptive Names**:
   - "Kisumu Leave Approval" (general)
   - "Kisumu HRH Leave Approval" (specific)
   - "Kisumu Annual Leave Approval" (very specific)

4. **Test Template Selection**:
   - Create test leave/timesheet requests
   - Verify correct template is selected
   - Check that approvers are resolved correctly

## Troubleshooting

### "No workflow template found"

**Causes:**
- No template exists for the employee's location
- Template exists but status is not `Active`
- Template location doesn't match employee's location

**Solution:**
- Create a template for the employee's location
- Ensure template status is `Active`
- Verify employee's location matches template location

### Wrong Template Selected

**Causes:**
- Multiple templates match, wrong priority
- Template filters too specific

**Solution:**
- Check template priority (most specific wins)
- Review template filters (location, staff type, leave type)
- Ensure only one template matches for each scenario

### Notifications Not Sent

**Causes:**
- SMTP not configured
- Approvers not resolved
- Notification service error

**Solution:**
- Check SMTP configuration
- Verify approvers are found for each step
- Check server logs for notification errors

## Summary

✅ **Template Selection**: Fully automated based on location, staff type, and leave type  
✅ **Notifications**: Implemented and sent when workflows are submitted/approved  
✅ **Location-Based**: Templates are automatically matched to employee locations  
✅ **Flexible**: Supports multiple templates per location with different filters  

The system is ready to use! Just create templates for each location, and they'll be automatically applied when employees submit requests.
