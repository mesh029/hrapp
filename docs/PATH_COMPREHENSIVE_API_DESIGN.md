# PATH Company HR System - Comprehensive API Design & Workflow Specification

> **THE FOUNDATION STORY**
> 
> A company called PATH works in different locations namely Nairobi, Kisumu, Kakamega, Vihiga and Nyamira.
> 
> This company has different types of staff (Regular Staff, Temporary Staff and HRH staff)
> 
> Regular and Temporary staff work at the offices, where as the HRH staff work in facilities 
> 
> Now Regular and Temporary staff submit leave requests and their Timesheets for approval, 
> 
> The timesheets need to be approved for pay, the leaves need to be approved for them to be added to the timesheets so they are payed.
> 
> So this brings in sth new. I can be able to add leave types or remove leave types and assigne their parameters (say Sick Leave, Vacation etc) this too needs to by dynamic
> So when leave requests are approved (And this approval flow is why we need the work flow engine) they are automatically added to the timesheets with their respective labels and they contribute to the total number of hours worked in that month .
> Regular and Temp staff work 40 hrs a week excluding weekends (8.5 hrs Monday to Thursday and 6 Hours on Friday) and they have payed leave days 
> HRH staff work 40 hrs a week excluding weekends (8hrs from Monday to Friday)
> Now these working hours, I also need to be dynamic. Incase there is an organisaion that uses different working periods...You get?
> 
> Now these leave requests go through different approval levels, from the manager to other people in the hierachy who need to approve( for example, the manager, the Program officer incharge of that region, the Hr manager incharge of that region then its fully approved ) so these are the roles that need to be dynamic too to offer endless posibilities for at one point i may descide that the leave requests only need one approver 
> 
> Same applies to Timesheets approvals 
> 
> Note that in the event people cannot approve timesheets and they are part of the approval flow, they shall need to delegate or the system admin shall need to (so this system admin is also a role dynamic stuff) delgate that responsibility to a certain user in the system and if approved will be allowed to have the rights to now enter the work flow .
> 
> This processes are efficient as possible. 
> 
> at the end we need to have fully approved timesheets or pending timesheets that need approval or those that are rejected and are sent back(to whowever is chosen by the person who rejects within the workflow) with comments for reapproval   or rejection again .
> 
> Leave days are tracked and reports of leave utilization are taken...
> 
> timesheets can also be downloaded for specific months
> 
> Timesheets are clear and record all the days worked in the month and the holidays as filled by the users....
> 
> This is a story that is able to help really know the specifics of the back bone of this systema nd what it is expected to handle...the posibliities are to be endless from here on out and we need to desingn a system that will scale in this regard with clear endpoints and all.
> 
> with this data we can have regional dashboards and all. we can have a very smooth management system.  
> 
> Notifications are also a very vital point for this system as it will informethem within the system and even send email notifications of what needs to be approved or the stuff that has already been approved within the system>>

---

## DOCUMENT PURPOSE

This document serves as the **single source of truth** for the PATH Company HR System API design, workflow scenarios, and implementation specifications. It is built directly from the real-world requirements story above and ensures the system can scale to handle endless possibilities while maintaining efficiency and clarity.

**Key Principles:**
- **Fully Dynamic Configuration** - No hardcoded business logic
- **Scalable Architecture** - Designed to handle growth and complexity
- **Clear API Endpoints** - Well-defined, RESTful, and intuitive
- **Efficient Processing** - Optimized for performance at scale
- **Comprehensive Workflows** - Supports all approval scenarios

**⚠️ CRITICAL: Workflow Dynamic Configuration**
- **NO hardcoded workflow sequences** - All workflows are completely configurable
- **NO fixed starting points** - First step can be ANY role or permission (not hardcoded to "Manager")
- **NO required roles** - Workflows can use any roles you create, in any order
- **Complete flexibility** - Add/remove/reorder steps, change directions, modify at runtime
- **Default templates are examples only** - PATH defaults (e.g., "Manager → Program Officer → HR Manager") are just starting points that can be changed/deleted/replaced
- See `WORKFLOW_DYNAMICITY_EXPLANATION.md` for detailed explanation

---

## TABLE OF CONTENTS

### Part 1: System Architecture & Core Design
1. [System Overview](#system-overview)
2. [Core Entities & Relationships](#core-entities--relationships)
3. [Dynamic Configuration Framework](#dynamic-configuration-framework)
4. [API Architecture Principles](#api-architecture-principles)

### Part 2: Workflow Scenarios (Based on PATH Story)
5. [Leave Request Workflow Scenarios](#leave-request-workflow-scenarios)
6. [Timesheet Approval Workflow Scenarios](#timesheet-approval-workflow-scenarios)
7. [Delegation Scenarios](#delegation-scenarios)
8. [Integration: Leave → Timesheet Flow](#integration-leave--timesheet-flow)

### Part 3: API Endpoint Specifications
9. [Complete API Endpoint Catalog](#complete-api-endpoint-catalog)
10. [Request/Response Specifications](#requestresponse-specifications)
11. [Error Handling Standards](#error-handling-standards)

### Part 4: Implementation Details
12. [Database Schema Enhancements](#database-schema-enhancements)
13. [Notification System Design](#notification-system-design)
14. [Reporting & Dashboard APIs](#reporting--dashboard-apis)
15. [Performance Optimization Strategy](#performance-optimization-strategy)

---

## PART 1: SYSTEM ARCHITECTURE & CORE DESIGN

### System Overview

The PATH HR System is a **fully dynamic, multi-location, multi-staff-type** human resources management platform designed to handle:

- **Multiple Locations:** Nairobi, Kisumu, Kakamega, Vihiga, Nyamira (and extensible)
- **Multiple Staff Types:** Regular Staff, Temporary Staff, HRH Staff (and extensible)
- **Dynamic Leave Types:** Configurable leave types (Sick Leave, Vacation, etc.)
- **Dynamic Workflows:** Configurable approval chains (1 to N approvers)
- **Dynamic Roles:** Configurable roles (Manager, Program Officer, HR Manager, System Admin, etc.)
- **Dynamic Working Hours:** Configurable work schedules per staff type/location
- **Delegation System:** Temporary authority transfer for unavailable approvers
- **Notification System:** In-app and email notifications
- **Reporting & Dashboards:** Regional and organizational insights

### Core Entities & Relationships

```
PATH Organization
├── Locations (Hierarchical Tree)
│   ├── Nairobi Office
│   ├── Kisumu Office
│   ├── Kakamega Office
│   ├── Vihiga Office
│   └── Nyamira Office
│
├── Staff Types (Dynamic)
│   ├── Regular Staff
│   ├── Temporary Staff
│   └── HRH Staff
│
├── Users (Assigned to Locations & Staff Types)
│   ├── Regular Staff → Offices
│   ├── Temporary Staff → Offices
│   └── HRH Staff → Facilities
│
├── Leave Types (Fully Dynamic)
│   ├── Sick Leave
│   ├── Vacation
│   ├── Maternity Leave
│   └── ... (unlimited)
│
├── Workflow Templates (Location-Specific, Dynamic)
│   ├── Leave Request Workflows (per location)
│   └── Timesheet Approval Workflows (per location)
│
└── Roles (Fully Dynamic)
    ├── Manager
    ├── Program Officer
    ├── HR Manager
    ├── System Admin
    └── ... (unlimited)
```

### Dynamic Configuration Framework

**CRITICAL PRINCIPLE:** Everything must be configurable at runtime. No hardcoded business logic.

**⚠️ WORKFLOW DYNAMICITY - CRITICAL:**
- **Workflow templates are completely dynamic** - NO hardcoded sequences
- **First step can be ANY role/permission** - NOT hardcoded to "Manager" or any other role
- **Steps can be added/removed/reordered** - Complete flexibility
- **Default templates are examples only** - Can be changed, deleted, or replaced
- See `WORKFLOW_DYNAMICITY_EXPLANATION.md` for complete details

#### 1. Leave Types (Dynamic)
- **Create/Update/Delete** at runtime
- **Configurable Parameters:**
  - Name (e.g., "Sick Leave", "Vacation")
  - Description
  - Is Paid (boolean)
  - Max Days Per Year
  - Accrual Rules
  - Carry Forward Rules
  - Status (active/inactive)

#### 2. Working Hours (Dynamic)
- **Configurable per Staff Type and/or Location**
- **Parameters:**
  - Staff Type (Regular, Temporary, HRH)
  - Location (optional - can be global or location-specific)
  - Monday Hours (e.g., 8.5 for Regular/Temp, 8 for HRH)
  - Tuesday Hours
  - Wednesday Hours
  - Thursday Hours
  - Friday Hours (e.g., 6 for Regular/Temp, 8 for HRH)
  - Saturday Hours (default: 0)
  - Sunday Hours (default: 0)
  - Weekly Total (calculated)
  - Status (active/inactive)

**Example Configurations:**
- **Regular/Temporary Staff:** Mon-Thu: 8.5hrs, Fri: 6hrs, Sat-Sun: 0hrs = 40hrs/week
- **HRH Staff:** Mon-Fri: 8hrs, Sat-Sun: 0hrs = 40hrs/week
- **Custom Organization:** Can configure any pattern

#### 3. Roles (Dynamic)
- **Create/Update/Delete** at runtime
- **Examples:** Manager, Program Officer, HR Manager, System Admin, Supervisor, Regional Director, etc.
- **Permissions:** Assigned dynamically to roles
- **Users:** Can have multiple roles

#### 4. Workflow Templates (Fully Dynamic - No Hardcoded Sequences)
- **Location-Specific:** Each location can have different workflows
- **Employee-Type-Specific:** Each employee type can have different workflows
- **Configurable Steps:** 1 to N approval steps (unlimited)
- **No Fixed Starting Point:** First step can be ANY role or permission - NOT hardcoded
- **Step Configuration:**
  - Step Order (1, 2, 3, ...) - Can be reordered at any time
  - Required Permission (e.g., "leave.approve", "timesheet.approve", or any custom permission)
  - Required Role (optional - can be permission-based only, or any role you create)
  - Allow Decline (boolean)
  - Allow Adjust (boolean)
  - Routing Options (where to send back on adjust/decline - can be to any step or employee)
- **Version Isolation:** Template changes don't affect running instances
- **Complete Flexibility:** Add, remove, reorder steps at runtime - no restrictions

**Example Workflows (All Configurable, None Hardcoded):**
- **Simple:** Any single role/permission (e.g., "Supervisor", "Team Lead", "Department Head")
- **Complex:** Any combination of roles/permissions in any order (e.g., "Finance Officer → HR Manager → CEO")
- **Custom:** Completely flexible - start with any role, add any steps, in any order
- **Note:** Examples showing "Manager → Program Officer → HR Manager" are just PATH defaults - these can be changed/deleted/replaced

#### 5. Delegation System (Dynamic)
- **Temporary Authority Transfer:** When approvers are unavailable
- **Delegation Types:**
  - **Self-Delegation:** User delegates to another user
  - **Admin Delegation:** System Admin delegates on behalf of user
- **Delegation Parameters:**
  - Delegator (original approver)
  - Delegate (temporary approver)
  - Permission (e.g., "leave.approve", "timesheet.approve")
  - Location Scope
  - Valid From / Valid Until (time-bound)
  - Status (active/revoked/expired)

---

## ✅ COMPREHENSIVE DYNAMIC CONFIGURATION CONFIRMATION

**THIS SECTION EXPLICITLY CONFIRMS THE SUPER DYNAMIC NATURE OF ALL SYSTEM COMPONENTS**

### 1. ✅ APPROVAL ENGINE - SUPER DYNAMIC (NO HARDCODED WORKFLOWS)

**CRITICAL PRINCIPLE:** The approval engine is **completely dynamic** with **ZERO hardcoded workflow sequences**. There are NO assumptions about what roles or permissions must be in a workflow, NO fixed starting points, and NO required sequences.

**Capabilities:**
- ✅ **Add Unlimited Approval Steps:** You can add 1, 2, 3, 5, 10, or any number of approval steps
- ✅ **Remove Approval Steps:** Remove any step from a workflow template at runtime (including the first step)
- ✅ **Reorder Steps:** Change the order of approval steps dynamically - move any step to any position
- ✅ **Change First Step:** The first step can be ANY role or permission - NOT hardcoded to "Manager" or any other role
- ✅ **Step Configuration:** Each step can have different:
  - Required permissions (e.g., "leave.approve", "timesheet.approve", or any custom permission)
  - Required roles (optional - can be permission-based only, or any role you create)
  - Allow decline (yes/no)
  - Allow adjust (yes/no)
  - Routing options (where to send back on adjust/decline)
- ✅ **Location-Specific Workflows:** Different locations can have completely different approval chains
- ✅ **Employee-Type-Specific Workflows:** Different employee types can have different workflows
- ✅ **Version Isolation:** Template changes don't affect running instances
- ✅ **Multiple Workflows:** Same resource type can have multiple workflow templates per location
- ✅ **Complete Flexibility:** Create workflows that start with ANY role, permission, or combination

**NO HARDCODED ASSUMPTIONS:**
- ❌ **NOT** hardcoded to start with "Manager"
- ❌ **NOT** hardcoded to have specific roles in sequence
- ❌ **NOT** hardcoded to have any minimum/maximum steps
- ❌ **NOT** hardcoded to follow any organizational hierarchy
- ✅ **FULLY CONFIGURABLE:** Every aspect of the workflow is database-driven and changeable at runtime

**Example Scenarios (All Configurable, None Hardcoded):**
- **Simple:** 1 step (Any role/permission you configure - e.g., "Supervisor", "Team Lead", "Department Head")
- **Medium:** 3 steps (Any 3 roles/permissions in any order - e.g., "Finance Officer → HR Manager → CEO")
- **Complex:** 5 steps (Any 5 roles/permissions - e.g., "Coordinator → Supervisor → Manager → Director → Executive")
- **Extreme:** 10+ steps (Any combination for organizations with complex hierarchies)
- **Custom:** Start with any role - "Intern Coordinator", "Project Lead", "Regional Director", etc.

**Default Templates (Changeable):**
- The system may come with **default** workflow templates (e.g., starting with "Manager") for PATH organization
- These defaults are **ONLY examples** and can be:
  - Modified (change steps, order, roles)
  - Deleted
  - Replaced with completely custom workflows
- **No code changes required** - all done through API

**API Endpoints:**
- `POST /api/workflows/templates/:id/steps` - Add new approval step (at any position)
- `PATCH /api/workflows/templates/:id/steps/:stepId` - Update step configuration
- `DELETE /api/workflows/templates/:id/steps/:stepId` - Remove approval step (including first step)
- `PATCH /api/workflows/templates/:id/steps/reorder` - Reorder steps (move any step to any position)
- `POST /api/workflows/templates` - Create completely custom workflow from scratch

**No Hardcoded Limits:** The system supports unlimited approval steps. The only limit is database storage capacity. **Every workflow is completely configurable.**

---

### 2. ✅ LOCATIONS - SUPER DYNAMIC

**CONFIRMED:** Locations are **fully dynamic** - you can add, remove, and restructure the entire location hierarchy at runtime.

**Capabilities:**
- ✅ **Add New Locations:** Create unlimited new locations at any level
- ✅ **Remove Locations:** Delete locations (with proper handling of associated data)
- ✅ **Move Locations:** Restructure the location tree (change parent-child relationships)
- ✅ **Location Hierarchy:** Build complex multi-level hierarchies:
  ```
  Organization
  ├── Region 1
  │   ├── Country A
  │   │   ├── City 1
  │   │   └── City 2
  │   └── Country B
  └── Region 2
      └── Country C
  ```
- ✅ **Associated Data Handling:** When locations are removed or moved:
  - Users are reassigned or handled appropriately
  - Workflows continue to function (scope resolution is dynamic)
  - Historical data is preserved
  - Active workflows are not broken
- ✅ **Location-Specific Configuration:** Each location can have:
  - Different workflow templates
  - Different working hours
  - Different staff type assignments
  - Different role assignments

**API Endpoints:**
- `POST /api/locations` - Create new location
- `PATCH /api/locations/:id` - Update location
- `PATCH /api/locations/:id/move` - Move location in tree
- `DELETE /api/locations/:id` - Remove location (with cascade handling)
- `GET /api/locations/:id/ancestors` - Get all parent locations
- `GET /api/locations/:id/descendants` - Get all child locations

**Tree Integrity:** The system maintains location tree integrity at all times - no circular references, proper parent-child relationships.

---

### 3. ✅ ROLES - SUPER DYNAMIC

**CONFIRMED:** Roles are **completely dynamic** - create, modify, and remove roles at runtime with no restrictions.

**Capabilities:**
- ✅ **Create Unlimited Roles:** Create any number of roles (Manager, Program Officer, HR Manager, System Admin, Supervisor, Regional Director, Finance Manager, CEO, etc.)
- ✅ **Remove Roles:** Delete roles (with proper handling of user assignments)
- ✅ **Modify Roles:** Update role names, descriptions, and permissions at runtime
- ✅ **Role Permissions:** Assign/remove permissions to/from roles dynamically
- ✅ **User-Role Assignment:** Assign multiple roles to users, remove roles from users
- ✅ **Role Status:** Activate/deactivate roles without deleting them
- ✅ **No Hardcoded Roles:** Even "System Admin" is a dynamic role that can be renamed, modified, or removed

**Example Roles (All Dynamic):**
- Employee
- Supervisor
- Manager
- Program Officer
- HR Manager
- HR Assistant
- Finance Manager
- Regional Director
- System Admin
- CEO
- Department Head
- Team Lead
- ... (unlimited possibilities)

**API Endpoints:**
- `POST /api/roles` - Create new role
- `PATCH /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Remove role
- `POST /api/roles/:id/permissions` - Assign permission to role
- `DELETE /api/roles/:id/permissions/:permissionId` - Remove permission from role
- `POST /api/users/:id/roles` - Assign role to user
- `DELETE /api/users/:id/roles/:roleId` - Remove role from user

**Real-Time Effect:** Role changes take effect immediately - no deployment or restart required.

---

### 4. ✅ LEAVE TYPES & LEAVES - SUPER DYNAMIC

**CONFIRMED:** Leave types and leave management are **fully dynamic** - create unlimited leave types with configurable parameters.

**Capabilities:**
- ✅ **Create Unlimited Leave Types:** Create any number of leave types:
  - Sick Leave
  - Vacation
  - Maternity Leave
  - Paternity Leave
  - Emergency Leave
  - Study Leave
  - Sabbatical
  - Personal Leave
  - Compensatory Leave
  - ... (unlimited)
- ✅ **Remove Leave Types:** Delete leave types (with proper handling of existing requests)
- ✅ **Modify Leave Types:** Update leave type parameters at runtime
- ✅ **Configurable Parameters for Each Leave Type:**
  - Name (customizable)
  - Description
  - Is Paid (boolean - yes/no)
  - Max Days Per Year (number - can be unlimited)
  - Accrual Rules (how leave is earned)
  - Carry Forward Rules (can unused days carry to next year?)
  - Minimum Days (minimum request duration)
  - Maximum Days (maximum request duration)
  - Requires Documentation (boolean)
  - Requires Medical Certificate (boolean)
  - Status (active/inactive)
- ✅ **Leave Requests:** All leave requests use dynamic leave types
- ✅ **Leave Balances:** Tracked per leave type, per user, per year
- ✅ **Leave Reports:** Generate reports by leave type

**API Endpoints:**
- `POST /api/leave/types` - Create new leave type
- `PATCH /api/leave/types/:id` - Update leave type
- `DELETE /api/leave/types/:id` - Remove leave type
- `GET /api/leave/types` - List all leave types
- `GET /api/leave/types/:id` - Get leave type details

**Default PATH Leave Types (All Configurable):**
- The system comes with PATH's default leave types, but ALL can be modified or removed
- New leave types can be added for any organization's needs

---

### 5. ✅ WORK HOURS & WORK DAYS - SUPER DYNAMIC

**CONFIRMED:** Working hours and work days are **completely dynamic** - configure any work schedule pattern, including weekends.

**Capabilities:**
- ✅ **Default PATH Configuration:** System comes with PATH defaults:
  - **Regular/Temporary Staff:** Mon-Thu: 8.5hrs, Fri: 6hrs, Sat-Sun: 0hrs = 40hrs/week
  - **HRH Staff:** Mon-Fri: 8hrs, Sat-Sun: 0hrs = 40hrs/week
- ✅ **Fully Customizable:** You can override defaults and configure:
  - **Any Day of Week:** Monday through Sunday - all configurable
  - **Any Hours Per Day:** Set hours for each day (0 to 24)
  - **Weekend Work:** Configure Saturday and Sunday hours (e.g., 8hrs each)
  - **Different Patterns:** 
    - 4-day work week
    - 6-day work week
    - Shift work (different hours per day)
    - Rotating schedules
- ✅ **Staff Type Specific:** Different work hours per staff type
- ✅ **Location Specific:** Different work hours per location (optional)
- ✅ **Combination:** Staff type + Location specific hours
- ✅ **Multiple Configurations:** Can have multiple work hour configurations active simultaneously

**Example Custom Configurations:**
- **Weekend Workers:** Mon-Fri: 8hrs, Sat: 8hrs, Sun: 0hrs = 48hrs/week
- **4-Day Week:** Mon-Thu: 10hrs, Fri-Sun: 0hrs = 40hrs/week
- **Shift Workers:** Mon: 12hrs, Tue: 12hrs, Wed: 0hrs, Thu: 12hrs, Fri: 12hrs, Sat-Sun: 0hrs = 48hrs/week
- **Flexible:** Any combination you need

**API Endpoints:**
- `POST /api/config/work-hours` - Create work hours configuration
- `PATCH /api/config/work-hours/:id` - Update work hours
- `DELETE /api/config/work-hours/:id` - Remove configuration
- `GET /api/config/work-hours/by-staff-type/:staffType` - Get by staff type
- `GET /api/config/work-hours/by-location/:locationId` - Get by location

**Timesheet Integration:** When approved leaves are added to timesheets, hours are calculated based on the configured work hours for that day and staff type.

---

### 6. ✅ PERMISSIONS - SUPER DYNAMIC

**CONFIRMED:** Permissions are **fully dynamic** - create, modify, and assign permissions at runtime.

**Capabilities:**
- ✅ **Create Unlimited Permissions:** Create any permission you need
- ✅ **Permission Modules:** Organize permissions by module (leave, timesheet, user, role, etc.)
- ✅ **Assign to Roles:** Assign permissions to roles dynamically
- ✅ **Remove Permissions:** Delete permissions (with proper handling of role assignments)
- ✅ **No Hardcoded Permissions:** All permissions are database-driven

**Example Permissions (All Dynamic):**
- `leave.create`, `leave.read`, `leave.update`, `leave.approve`, `leave.delete`
- `timesheet.create`, `timesheet.read`, `timesheet.update`, `timesheet.approve`, `timesheet.delete`
- `users.create`, `users.read`, `users.update`, `users.delete`, `users.manage_roles`
- `roles.create`, `roles.read`, `roles.update`, `roles.delete`
- `workflows.templates.create`, `workflows.instances.approve`
- `delegations.create`, `delegations.revoke`
- ... (unlimited)

**API Endpoints:**
- `POST /api/permissions` - Create new permission
- `GET /api/permissions` - List all permissions
- `GET /api/permissions/:id` - Get permission details

---

### 7. ✅ EMPLOYEE TYPES - FULLY DYNAMIC

**CONFIRMED:** Employee types are **fully dynamic** - create, modify, and delete at runtime through a complete CRUD API.

**Default Employee Types (PATH):**
- Regular Staff
- Temporary Staff
- HRH Staff

**Capabilities:**
- ✅ **Create Employee Types:** Add new employee types at runtime via API
- ✅ **Update Employee Types:** Modify employee type details, metadata, and configurations
- ✅ **Delete/Deactivate Employee Types:** Soft delete (deactivate) employee types
- ✅ **Assign Users:** Assign users to employee types individually or in bulk
- ✅ **Employee Type Configuration:** Each employee type can have:
  - Different work hours (via work_hours_configurations)
  - Different leave entitlements
  - Different approval workflows (via workflow_templates)
  - Different location assignments
  - Custom metadata (JSONB field for organization-specific data)
- ✅ **Work Hours Per Type:** Configure work hours per employee type and location
- ✅ **Workflow Templates Per Type:** Create employee-type-specific workflow templates
- ✅ **User Assignment:** Assign users to employee types with effective dates

**Database Schema:**
```sql
CREATE TABLE employee_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_location_type VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**API Endpoints:**
- `GET /api/employee-types` - List all employee types
- `GET /api/employee-types/:id` - Get employee type details
- `POST /api/employee-types` - Create new employee type
- `PATCH /api/employee-types/:id` - Update employee type
- `DELETE /api/employee-types/:id` - Deactivate employee type
- `GET /api/employee-types/:id/users` - List users with this employee type
- `POST /api/users/:userId/employee-type` - Assign user to employee type
- `POST /api/users/bulk-assign-employee-type` - Bulk assign users

**Permissions Required:**
- `employee_types.create` - Create employee types
- `employee_types.read` - View employee types
- `employee_types.update` - Update employee types
- `employee_types.delete` - Delete employee types
- `users.assign_employee_type` - Assign users to employee types

---

### 8. ✅ DELEGATIONS - SUPER DYNAMIC

**CONFIRMED:** Delegations are **fully dynamic** - create, modify, and revoke delegations at runtime.

**Capabilities:**
- ✅ **Create Delegations:** Delegate any permission to any user
- ✅ **Time-Bound:** Set start and end dates for delegations
- ✅ **Location-Scoped:** Delegate for specific locations or all locations
- ✅ **Permission-Specific:** Delegate specific permissions
- ✅ **Revoke Delegations:** Revoke delegations immediately
- ✅ **Auto-Expire:** Delegations automatically expire at end date
- ✅ **Self or Admin:** Users can delegate themselves or System Admin can delegate on behalf

**API Endpoints:**
- `POST /api/delegations` - Create delegation
- `PATCH /api/delegations/:id/revoke` - Revoke delegation
- `DELETE /api/delegations/:id` - Delete delegation
- `GET /api/delegations` - List delegations

---

### 9. ✅ USER PERMISSION SCOPES - SUPER DYNAMIC

**CONFIRMED:** User permission scopes are **completely dynamic** - assign location scopes to users at runtime.

**Capabilities:**
- ✅ **Assign Scopes:** Assign location scopes to users for specific permissions
- ✅ **Multiple Scopes:** Users can have multiple scopes for different permissions
- ✅ **Time-Bound Scopes:** Set valid_from and valid_until dates
- ✅ **Descendant Inclusion:** Include all child locations or just direct location
- ✅ **Global Scopes:** Assign global scope (all locations)
- ✅ **Remove Scopes:** Remove scopes at runtime

**API Endpoints:**
- `POST /api/users/:id/scopes` - Create user scope
- `PATCH /api/users/:id/scopes/:scopeId` - Update scope
- `DELETE /api/users/:id/scopes/:scopeId` - Remove scope

---

### 10. ✅ TIMESHEET PERIODS - DYNAMIC

**CONFIRMED:** Timesheet periods are **dynamic** - can lock/unlock periods, configure period structures.

**Capabilities:**
- ✅ **Period Locking:** Lock periods to prevent new submissions
- ✅ **Period Unlocking:** Unlock periods when needed
- ✅ **Flexible Periods:** Support monthly, bi-weekly, or custom periods
- ✅ **Period Configuration:** Configure period start/end dates

**API Endpoints:**
- `POST /api/timesheets/periods/:id/lock` - Lock period
- `POST /api/timesheets/periods/:id/unlock` - Unlock period

---

## ADDITIONAL DYNAMIC COMPONENTS (RECOMMENDED)

### Things That Ought to Be Dynamic (Future Enhancements)

1. **Notification Templates** - Dynamic email/in-app notification templates
   - Create custom notification messages
   - Configure notification triggers
   - Customize notification content per organization

2. **Report Templates** - Dynamic report configurations
   - Create custom reports
   - Configure report fields
   - Schedule automated reports

3. **Holiday Calendar** - Dynamic holiday management
   - Add/remove holidays per location
   - Configure holiday types
   - Set holiday impact on timesheets

4. **Leave Accrual Rules** - Dynamic accrual calculations
   - Configure how leave is earned
   - Set accrual rates
   - Define accrual periods

5. **Timesheet Entry Types** - Dynamic entry categories
   - Regular Work
   - Overtime
   - Holiday Work
   - Training
   - Meeting
   - ... (unlimited types)

6. **Approval Routing Rules** - Dynamic routing logic
   - Route based on leave duration
   - Route based on employee level
   - Route based on department
   - Custom routing logic

7. **Document Templates** - Dynamic document generation
   - PDF templates for timesheets
   - Leave request forms
   - Approval letters
   - Custom documents

8. **Integration Endpoints** - Dynamic external integrations
   - Payroll system integration
   - Accounting system integration
   - HRIS integration
   - Custom webhooks

---

## SUMMARY: DYNAMIC CONFIGURATION GUARANTEE

**✅ CONFIRMED - ALL COMPONENTS ARE SUPER DYNAMIC:**

1. ✅ **Approval Engine** - Unlimited approval steps, fully configurable
2. ✅ **Locations** - Add/remove/move locations, unlimited hierarchy levels
3. ✅ **Roles** - Create unlimited roles, fully configurable
4. ✅ **Leave Types** - Create unlimited leave types with configurable parameters
5. ✅ **Work Hours** - Configure any work schedule, including weekends
6. ✅ **Permissions** - Create unlimited permissions, fully dynamic
7. ✅ **Delegations** - Fully dynamic delegation system
8. ✅ **User Scopes** - Dynamic location scope assignment
9. ✅ **Timesheet Periods** - Dynamic period management
10. ✅ **Staff Types** - Extendable staff type system

**PRINCIPLE:** No hardcoded business logic. Everything is configurable at runtime through API endpoints. The system is designed to handle endless possibilities and scale to any organizational structure.

---

### API Architecture Principles

1. **RESTful Design:** Standard HTTP methods, clear resource naming
2. **Consistent Response Format:** Standardized JSON responses
3. **Scope-Based Filtering:** All list endpoints respect user's location scope
4. **Permission-Based Authorization:** Every endpoint requires explicit permission
5. **Transaction Safety:** Critical operations use database transactions
6. **Audit Trail:** All state changes are logged
7. **Error Handling:** Consistent error response format
8. **Pagination:** All list endpoints support pagination
9. **Versioning:** API versioning strategy for future compatibility

---

## PART 2: WORKFLOW SCENARIOS (BASED ON PATH STORY)

**IMPORTANT NOTE:** The workflows shown below are **examples** based on PATH's default configuration. These are **NOT hardcoded** - they can be completely changed, reordered, or replaced with any workflow configuration you need. The first step can be ANY role or permission - it doesn't have to be "Manager".

### Leave Request Workflow Scenarios

#### Scenario 1: Example Multi-Level Approval (Nairobi Office) - **FULLY CONFIGURABLE**

**Setup (This is just an example - all configurable):**
- **Location:** Nairobi Office
- **Employee:** John (Regular Staff)
- **Workflow Template:** Manager → Program Officer (Nairobi Region) → HR Manager (Nairobi Region)
  - **Note:** This is PATH's default template - you can change it to start with ANY role, add/remove steps, or reorder them
- **Leave Type:** Vacation (5 days)

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ LEAVE REQUEST APPROVAL FLOW - NAIROBI OFFICE                │
└─────────────────────────────────────────────────────────────┘e
   ├─ Dates: 2025-02-10 to 2025-02-14 (5 days)
   ├─ Status: Draft
   └─ Workflow Instance: Created (not yet active)

2. John submits leave request
   ├─ Status: Submitted → Under Review
   ├─ Workflow Status: Under Review
   ├─ Current Step: 1 (Manager Approval)
   └─ Assigned Approver: Sarah (Manager, Nairobi Office)

3. Sarah (Manager) approves
   ├─ Authority Check: ✅ Has "leave.approve" permission
   ├─ Scope Check: ✅ Nairobi Office scope
   ├─ Step 1 Status: Approved
   ├─ Comment: "Approved - team coverage confirmed"
   ├─ Digital Signature: ✅ Automatically generated and appended
   │   ├─ Signature: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   │   ├─ Timestamp: "2025-01-27T14:30:15.123Z" (UTC)
   │   ├─ Signature Hash: "a1b2c3d4e5f6..."
   │   ├─ IP Address: "192.168.1.100"
   │   └─ User Agent: "Mozilla/5.0..."
   └─ Workflow moves to Step 2

4. Program Officer (Nairobi Region) approves
   ├─ Authority Check: ✅ Has "leave.approve" permission
   ├─ Scope Check: ✅ Nairobi Region scope (includes Nairobi Office)
   ├─ Step 2 Status: Approved
   ├─ Digital Signature: ✅ Automatically generated and appended
   │   ├─ Signature: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   │   ├─ Timestamp: "2025-01-27T15:45:22.456Z" (UTC)
   │   └─ Signature Hash: "b2c3d4e5f6a7..."
   └─ Workflow moves to Step 3

5. HR Manager (Nairobi Region) approves
   ├─ Authority Check: ✅ Has "leave.approve" permission
   ├─ Scope Check: ✅ Nairobi Region scope
   ├─ Step 3 Status: Approved
   ├─ Digital Signature: ✅ Automatically generated and appended
   │   ├─ Signature: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   │   ├─ Timestamp: "2025-01-27T16:20:10.789Z" (UTC)
   │   └─ Signature Hash: "c3d4e5f6a7b8..."
   └─ Workflow Complete

6. Final State
   ├─ Leave Request: Approved ✅
   ├─ Leave Balance: Updated (5 days deducted from Vacation balance)
   ├─ Digital Signatures: All 3 approval signatures appended
   │   ├─ Step 1: Manager signature + timestamp
   │   ├─ Step 2: Program Officer signature + timestamp
   │   └─ Step 3: HR Manager signature + timestamp
   ├─ Timesheet Integration: Automatically added to John's timesheet for February
   ├─ Timesheet Entry: 
   │   ├─ Date: 2025-02-10 to 2025-02-14
   │   ├─ Hours: 40 hours (5 days × 8 hours)
   │   ├─ Type: Vacation Leave
   │   └─ Label: "Vacation Leave - Approved Leave Request #12345"
   └─ Notifications: Sent to John (approved), approvers (completed)
```

**API Calls:**
- `POST /api/leave/requests` - Create request
- `POST /api/leave/requests/:id/submit` - Submit for approval
- `POST /api/workflows/instances/:id/approve` - Each approval step
- `GET /api/leave/requests/:id` - Check status

#### Scenario 2: Simple Single Approver (Kisumu Office - Simplified) - **FULLY CONFIGURABLE**

**Setup (This is just an example - all configurable):**
- **Location:** Kisumu Office
- **Employee:** Mary (Temporary Staff)
- **Workflow Template:** Manager only (1 step)
  - **Note:** This could be ANY role/permission - "Supervisor", "Team Lead", "Department Head", etc. - completely configurable
- **Leave Type:** Sick Leave (2 days)

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ LEAVE REQUEST APPROVAL FLOW - KISUMU OFFICE (SIMPLIFIED)    │
└─────────────────────────────────────────────────────────────┘

1. Mary creates leave request
   ├─ Leave Type: Sick Leave
   ├─ Dates: 2025-02-05 to 2025-02-06 (2 days)
   └─ Status: Draft

2. Mary submits leave request
   ├─ Status: Under Review
   └─ Step 1: Manager Approval (Bob)

3. Bob (Manager) approves
   ├─ Authority Check: ✅
   ├─ Step 1 Status: Approved
   └─ Workflow Complete

4. Final State
   ├─ Leave Request: Approved ✅
   ├─ Leave Balance: Updated (2 days deducted)
   ├─ Timesheet Integration: Added to Mary's February timesheet
   └─ Notifications: Sent
```

**Key Point:** Same system, different workflow configuration. The system supports both simple and complex approval chains. **All workflows are completely configurable - no hardcoded sequences.**

#### Scenario 3: Rejected Leave Request with Rejector-Chosen Routing - **FULLY CONFIGURABLE**

**Setup (This is just an example - all configurable):**
- **Location:** Kakamega Office
- **Employee:** Peter (Regular Staff)
- **Workflow:** Manager → Program Officer → HR Manager (3 steps)
  - **Note:** This is PATH's example default - you can change it to ANY roles in ANY order
- **Leave Type:** Vacation (10 days)
- **Current Step:** Step 2 (Program Officer)

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ REJECTED LEAVE REQUEST FLOW - REJECTOR CHOOSES ROUTING      │
└─────────────────────────────────────────────────────────────┘

1. Peter submits leave request (10 days)
   ├─ Status: Under Review
   ├─ Step 1: Manager (Approved ✅)
   ├─ Step 2: Program Officer (Current - Alice)
   └─ Step 3: HR Manager (Pending)

2. Program Officer (Alice) declines at Step 2
   ├─ Reason: "Insufficient team coverage during project deadline"
   ├─ Routing Choice: Alice chooses to send back to Employee (Peter)
   │   └─ Options available:
   │       ├─ Option 1: Send back to Employee (Peter) - Draft status
   │       ├─ Option 2: Send back to Step 1 (Manager) - Re-review
   │       └─ Option 3: Final rejection (terminate workflow)
   ├─ Step 2 Status: Declined
   ├─ Routed To: Employee (Peter)
   └─ Workflow Status: Adjusted

3. Leave Request returned to Peter
   ├─ Status: Draft (editable)
   ├─ Comment: "Program Officer rejected: Insufficient team coverage during project deadline"
   └─ Peter can modify and resubmit

4. Peter modifies request (reduces to 5 days)
   └─ Resubmits

5. Workflow restarts
   └─ Returns to Step 1 (Manager)

ALTERNATIVE: Program Officer routes back to Manager

2b. Program Officer (Alice) declines at Step 2
   ├─ Reason: "Please coordinate with Manager first"
   ├─ Routing Choice: Alice chooses to send back to Step 1 (Manager)
   ├─ Step 2 Status: Declined
   ├─ Routed To: Step 1 (Manager)
   └─ Workflow Status: Adjusted

3b. Leave Request routed to Step 1 (Manager)
   ├─ Status: Under Review (at Step 1)
   ├─ Comment: "Program Officer rejected: Please coordinate with Manager first"
   ├─ Previous Step 1 Approval: Marked as "needs re-review"
   └─ Manager can review again
```

**Key Points:**
- ✅ **Rejector Chooses Routing:** The person rejecting can choose where the leave request goes back to
- ✅ **Routing Options:** Can route to any previous step, to the employee, or final rejection
- ✅ **Comments Required:** Rejection must include comments explaining the reason
- ✅ **Flexible Workflow:** Supports complex routing scenarios

#### Scenario 4: Adjustment Request Flow

**Setup:**
- **Location:** Vihiga Office
- **Employee:** Alice (Regular Staff)
- **Workflow:** Manager → HR Manager
- **Leave Type:** Vacation (7 days requested)

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ ADJUSTMENT REQUEST FLOW                                      │
└─────────────────────────────────────────────────────────────┘

1. Alice submits leave request (7 days)
   └─ Status: Under Review (Step 1)

2. Manager requests adjustment
   ├─ Reason: "Reduce to 5 days, add emergency contact"
   ├─ Step 1 Status: Adjusted
   └─ Workflow Status: Adjusted

3. Request returned to Alice
   ├─ Leave Request: Draft (editable)
   ├─ Comment: "Please reduce to 5 days and add emergency contact"
   └─ Alice updates request:
       ├─ Dates: Reduced to 5 days
       ├─ Emergency Contact: Added
       └─ Resubmits

4. Alice resubmits
   ├─ Status: Under Review
   └─ Returns to Step 1 (Manager)

5. Manager approves (Step 1)
   └─ Moves to Step 2 (HR Manager)

6. HR Manager approves (Step 2)
   └─ Workflow Complete, Leave Approved ✅
```

**Key Point:** Adjustment returns request to employee for modification, then resumes workflow from the same step.

### Timesheet Approval Workflow Scenarios

#### Scenario 1: Standard Timesheet Approval with Leave Integration

**Setup:**
- **Location:** Nairobi Office
- **Employee:** John (Regular Staff)
- **Period:** February 2025
- **Workflow:** Supervisor → Manager → HR Manager
- **Includes:** Approved leave days (from Scenario 1)

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ TIMESHEET APPROVAL FLOW - FEBRUARY 2025                     │
└─────────────────────────────────────────────────────────────┘

1. John creates timesheet (February 2025)
   ├─ Period: 2025-02-01 to 2025-02-28
   ├─ Status: Draft
   ├─ Entries:
   │   ├─ Regular work days (filled by John)
   │   ├─ Approved leave days (auto-added from approved leave requests)
   │   └─ Holidays (filled by John)
   └─ Total Hours: Calculated automatically

2. Approved Leave Days Auto-Added
   ├─ Date: 2025-02-10 to 2025-02-14
   ├─ Hours: 40 hours (5 days × 8 hours)
   ├─ Type: Vacation Leave
   └─ Label: "Vacation Leave - Approved Leave Request #12345"

3. John completes timesheet
   ├─ Regular Work Days: 16 days × 8.5 hours = 136 hours (Mon-Thu)
   ├─ Regular Work Days: 3 days × 6 hours = 18 hours (Fri)
   ├─ Vacation Leave: 5 days × 8 hours = 40 hours (auto-added)
   ├─ Holidays: 2 days (filled by John)
   └─ Total: 194 hours

4. John submits timesheet
   ├─ Status: Submitted → Under Review
   ├─ Workflow Status: Under Review
   └─ Step 1: Supervisor Review

5. Supervisor approves (Step 1)
   ├─ Authority Check: ✅
   ├─ Verification: Hours match entries
   ├─ Digital Signature: ✅ Automatically generated and appended
   │   ├─ Signature: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   │   ├─ Timestamp: "2025-02-28T09:15:30.123Z" (UTC)
   │   └─ Signature Hash: "d4e5f6a7b8c9..."
   └─ Moves to Step 2

6. Manager approves (Step 2)
   ├─ Digital Signature: ✅ Automatically generated and appended
   │   ├─ Signature: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   │   ├─ Timestamp: "2025-02-28T10:30:45.456Z" (UTC)
   │   └─ Signature Hash: "e5f6a7b8c9d0..."
   └─ Moves to Step 3

7. HR Manager approves (Step 3)
   ├─ Digital Signature: ✅ Automatically generated and appended
   │   ├─ Signature: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   │   ├─ Timestamp: "2025-02-28T11:45:20.789Z" (UTC)
   │   └─ Signature Hash: "f6a7b8c9d0e1..."
   └─ Workflow Complete

8. Final State
   ├─ Timesheet: Approved ✅
   ├─ Timesheet: Locked (is_locked = true)
   ├─ Digital Signatures: All 3 approval signatures appended
   │   ├─ Step 1: Supervisor signature + timestamp
   │   ├─ Step 2: Manager signature + timestamp
   │   └─ Step 3: HR Manager signature + timestamp
   ├─ PDF Generation: Available for download (includes all signatures)
   ├─ Payroll: Ready for processing
   └─ Notifications: Sent to John and approvers
```

**API Calls:**
- `POST /api/timesheets` - Create timesheet
- `GET /api/timesheets/:id/entries` - View entries (including auto-added leaves)
- `POST /api/timesheets/:id/submit` - Submit for approval
- `POST /api/workflows/instances/:id/approve` - Each approval step (generates digital signature)
- `GET /api/timesheets/:id/pdf` - Download approved timesheet (includes all signatures)
- `GET /api/timesheets/:id/signatures` - Get all approval signatures for timesheet

#### Scenario 2: Rejected Timesheet with Rejector-Chosen Routing

**Setup:**
- **Location:** Kisumu Office
- **Employee:** Mary (Temporary Staff)
- **Period:** February 2025
- **Workflow:** Supervisor → Manager → HR Manager (3 steps)
- **Current Step:** Step 2 (Manager)

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ REJECTED TIMESHEET FLOW - REJECTOR CHOOSES ROUTING          │
└─────────────────────────────────────────────────────────────┘

1. Mary submits timesheet
   ├─ Status: Under Review
   ├─ Step 1: Supervisor (Approved ✅)
   ├─ Step 2: Manager (Current - Bob)
   └─ Step 3: HR Manager (Pending)

2. Manager (Bob) rejects at Step 2
   ├─ Reason: "Hours don't match approved leave days. Please verify."
   ├─ Routing Choice: Bob chooses to send back to Step 1 (Supervisor)
   │   └─ Options available:
   │       ├─ Option 1: Send back to Employee (Mary) - Draft status
   │       ├─ Option 2: Send back to Step 1 (Supervisor) - Re-review
   │       └─ Option 3: Send back to Step 0 (Original submitter)
   ├─ Step 2 Status: Declined
   ├─ Routed To: Step 1 (Supervisor)
   └─ Workflow Status: Adjusted (routed back)

3. Timesheet routed to Step 1 (Supervisor)
   ├─ Status: Under Review (at Step 1)
   ├─ Comment: "Manager rejected: Hours don't match approved leave days. Please verify."
   ├─ Previous Step 1 Approval: Marked as "needs re-review"
   └─ Supervisor can now review again

4. Supervisor reviews again (Step 1)
   ├─ Verifies the issue
   ├─ Can approve again (moves to Step 2)
   └─ Or can route back to Mary for correction

ALTERNATIVE SCENARIO: Manager routes directly to Employee

2b. Manager (Bob) rejects at Step 2
   ├─ Reason: "Hours don't match approved leave days. Please verify."
   ├─ Routing Choice: Bob chooses to send back to Employee (Mary)
   ├─ Step 2 Status: Declined
   ├─ Routed To: Employee (Draft status)
   └─ Workflow Status: Adjusted

3b. Timesheet returned to Mary
   ├─ Status: Draft (editable)
   ├─ Comment: "Manager rejected: Hours don't match approved leave days. Please verify."
   └─ Mary can correct and resubmit

4b. Mary resubmits
   └─ Returns to Step 1 (Supervisor) - workflow restarts
```

**Key Points:**
- ✅ **Rejector Chooses Routing:** The person rejecting can choose where the timesheet goes back to
- ✅ **Routing Options:** Can route to any previous step, to the employee, or to the original submitter
- ✅ **Flexible Workflow:** Supports complex routing scenarios based on rejection reason
- ✅ **Comments Required:** Rejection must include comments explaining the reason

**API Request for Rejection with Routing:**
```http
POST /api/workflows/instances/wf-inst-789/decline
Authorization: Bearer <token>
Content-Type: application/json

{
  "comment": "Hours don't match approved leave days. Please verify.",
  "route_to": "step_1",  // Options: "employee", "step_0", "step_1", "step_2", etc.
  "route_to_step_order": 1  // Specific step number to route to
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow_instance_id": "wf-inst-789",
    "step_declined": 2,
    "routed_to": "step_1",
    "routed_to_step_order": 1,
    "workflow_status": "Adjusted",
    "comment": "Hours don't match approved leave days. Please verify.",
    "message": "Timesheet declined and routed back to Step 1 for re-review."
  }
}
```

#### Scenario 3: Period Locking

**Setup:**
- **Location:** Nairobi Office
- **Period:** January 2025 (locked)
- **Employee:** John (Regular Staff)

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ PERIOD LOCKING SCENARIO                                      │
└─────────────────────────────────────────────────────────────┘

1. System Admin locks January 2025 period
   ├─ Period: 2025-01-01 to 2025-01-31
   ├─ Status: Locked
   ├─ Locked By: System Admin
   └─ Locked At: 2025-02-05 10:00

2. John attempts to submit timesheet for January
   ├─ Validation: Period check
   ├─ Result: ❌ Period is locked
   └─ Error: "Cannot submit timesheet for locked period"

3. System Behavior
   ├─ All timesheets for January: Read-only
   ├─ No new timesheets can be created for January
   └─ Existing approved timesheets: Can be downloaded
```

**API Calls:**
- `POST /api/timesheets/periods/:id/lock` - Lock period (System Admin only)
- `POST /api/timesheets/periods/:id/unlock` - Unlock period (System Admin only)

### Delegation Scenarios

#### Scenario 1: Manager Delegates During Vacation

**Setup:**
- **Delegator:** Sarah (Manager, Nairobi Office)
- **Delegate:** Tom (Supervisor, Nairobi Office)
- **Duration:** 2025-02-10 to 2025-02-20 (vacation period)
- **Permission:** leave.approve

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ DELEGATION DURING VACATION                                   │
└─────────────────────────────────────────────────────────────┘

1. Sarah creates delegation
   ├─ Delegate: Tom (Supervisor)
   ├─ Permission: leave.approve
   ├─ Location: Nairobi Office
   ├─ Valid From: 2025-02-10 00:00
   ├─ Valid Until: 2025-02-20 23:59
   └─ Status: Active

2. During delegation period (2025-02-15)
   ├─ Leave request submitted (John)
   ├─ Workflow Step 1: Manager Approval (Sarah)
   └─ Sarah is on vacation

3. Tom (Delegate) approves
   ├─ Authority Check:
   │   ├─ Direct Permission: ❌ leave.approve (not in Tom's roles)
   │   ├─ Delegation Check: ✅ leave.approve (delegated from Sarah)
   │   ├─ Scope Check: ✅ Nairobi Office (matches)
   │   ├─ Time Check: ✅ Within valid period
   │   └─ Result: ✅ AUTHORIZED
   ├─ Step 1 Status: Approved
   ├─ Audit Log: Records delegation context
   │   └─ Metadata: { delegated_from: Sarah, delegated_to: Tom }
   └─ Workflow continues

4. After delegation expires (2025-02-21)
   ├─ Tom attempts to approve
   ├─ Delegation Check: ❌ Expired
   └─ Result: ❌ NOT AUTHORIZED
```

**API Calls:**
- `POST /api/delegations` - Create delegation (self or admin)
- `GET /api/delegations` - List active delegations
- `POST /api/workflows/instances/:id/approve` - Approval (checks delegation)

#### Scenario 2: System Admin Delegates on Behalf of User

**Setup:**
- **Delegator:** Sarah (Manager, Nairobi Office) - unavailable
- **Admin:** System Admin
- **Delegate:** Tom (Supervisor, Nairobi Office)
- **Permission:** timesheet.approve

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN DELEGATION SCENARIO                                   │
└─────────────────────────────────────────────────────────────┘

1. System Admin creates delegation on behalf of Sarah
   ├─ Delegator: Sarah (Manager)
   ├─ Delegate: Tom (Supervisor)
   ├─ Permission: timesheet.approve
   ├─ Location: Nairobi Office
   ├─ Valid From: 2025-02-10 00:00
   ├─ Valid Until: 2025-02-20 23:59
   ├─ Created By: System Admin
   └─ Status: Active

2. Tom can now approve timesheets
   ├─ Authority: ✅ Through delegation
   └─ Can enter workflow as approver

3. Audit Trail
   └─ All approvals logged with delegation context
```

**API Calls:**
- `POST /api/delegations` - System Admin can create delegation for any user
- Requires: `delegations.create` permission + system admin role

### Integration: Leave → Timesheet Flow

#### Complete Integration Scenario

**Setup:**
- **Employee:** John (Regular Staff, Nairobi Office)
- **Leave Request:** Vacation, 5 days (2025-02-10 to 2025-02-14)
- **Timesheet:** February 2025

**Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ LEAVE → TIMESHEET INTEGRATION FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. Leave Request Approved (from Scenario 1)
   ├─ Leave Request: Approved ✅
   ├─ Leave Balance: Updated (5 days deducted)
   └─ Trigger: Integration event

2. System automatically adds to timesheet
   ├─ Check: Does timesheet exist for February 2025?
   │   ├─ If YES: Add entries to existing timesheet
   │   └─ If NO: Create timesheet and add entries
   │
   ├─ Timesheet Entry Created:
   │   ├─ Date: 2025-02-10
   │   ├─ Hours: 8.5 (Monday - Regular Staff schedule)
   │   ├─ Type: Vacation Leave
   │   ├─ Leave Request ID: #12345
   │   └─ Label: "Vacation Leave"
   │
   ├─ Date: 2025-02-11
   │   ├─ Hours: 8.5 (Tuesday)
   │   └─ Type: Vacation Leave
   │
   ├─ Date: 2025-02-12
   │   ├─ Hours: 8.5 (Wednesday)
   │   └─ Type: Vacation Leave
   │
   ├─ Date: 2025-02-13
   │   ├─ Hours: 8.5 (Thursday)
   │   └─ Type: Vacation Leave
   │
   └─ Date: 2025-02-14
       ├─ Hours: 6 (Friday - Regular Staff schedule)
       └─ Type: Vacation Leave

3. Timesheet Total Hours Updated
   ├─ Regular Work: 154 hours
   ├─ Vacation Leave: 40 hours (auto-added)
   └─ Total: 194 hours

4. Timesheet Status
   ├─ If Draft: Entries added, status remains Draft
   └─ If Submitted/Approved: Entries added, no status change

5. Notification
   └─ Sent to John: "Your approved leave has been added to your timesheet"
```

**Key Points:**
- **Automatic Integration:** No manual intervention required
- **Hours Calculation:** Based on working hours configuration for staff type
- **Labeling:** Leave type name used as label in timesheet
- **Contribution:** Leave hours contribute to total monthly hours
- **Audit Trail:** Integration event logged

---

## PART 3: API ENDPOINT SPECIFICATIONS

### Complete API Endpoint Catalog

#### Authentication Endpoints

**Base Path:** `/api/auth`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Login with email/password, returns JWT tokens | No |
| POST | `/api/auth/refresh` | Refresh access token using refresh token | No |
| POST | `/api/auth/logout` | Invalidate tokens | Yes |

#### User Management Endpoints

**Base Path:** `/api/users`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/users` | List users (scope-filtered) | `users.read` |
| GET | `/api/users/:id` | Get user details | `users.read` |
| POST | `/api/users` | Create new user | `users.create` |
| PATCH | `/api/users/:id` | Update user | `users.update` |
| DELETE | `/api/users/:id` | Soft delete user | `users.delete` |
| PATCH | `/api/users/:id/location` | Assign primary location | `users.update` |
| POST | `/api/users/:id/roles` | Assign role to user | `users.manage_roles` |
| DELETE | `/api/users/:id/roles/:roleId` | Remove role from user | `users.manage_roles` |
| GET | `/api/users/:id/scopes` | Get user permission scopes | `users.read` |
| POST | `/api/users/:id/scopes` | Create user scope | `users.manage_scopes` |
| PATCH | `/api/users/:id/scopes/:scopeId` | Update user scope | `users.manage_scopes` |
| DELETE | `/api/users/:id/scopes/:scopeId` | Remove user scope | `users.manage_scopes` |

#### Role Management Endpoints

**Base Path:** `/api/roles`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/roles` | List all roles | `roles.read` |
| GET | `/api/roles/:id` | Get role details | `roles.read` |
| POST | `/api/roles` | Create new role | `roles.create` |
| PATCH | `/api/roles/:id` | Update role | `roles.update` |
| DELETE | `/api/roles/:id` | Delete role | `roles.delete` |
| GET | `/api/roles/:id/permissions` | Get role permissions | `roles.read` |
| POST | `/api/roles/:id/permissions` | Assign permission to role | `roles.manage_permissions` |
| DELETE | `/api/roles/:id/permissions/:permissionId` | Remove permission from role | `roles.manage_permissions` |

#### Permission Management Endpoints

**Base Path:** `/api/permissions`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/permissions` | List all permissions | `permissions.read` |
| GET | `/api/permissions/:id` | Get permission details | `permissions.read` |
| POST | `/api/permissions` | Create new permission | `permissions.create` |

#### Employee Type Management Endpoints

**Base Path:** `/api/employee-types`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/employee-types` | List all employee types | `employee_types.read` |
| GET | `/api/employee-types/:id` | Get employee type details | `employee_types.read` |
| POST | `/api/employee-types` | Create new employee type | `employee_types.create` |
| PATCH | `/api/employee-types/:id` | Update employee type | `employee_types.update` |
| DELETE | `/api/employee-types/:id` | Deactivate employee type | `employee_types.delete` |
| GET | `/api/employee-types/:id/users` | List users with this employee type | `employee_types.read` |
| POST | `/api/users/:userId/employee-type` | Assign user to employee type | `users.assign_employee_type` |
| POST | `/api/users/bulk-assign-employee-type` | Bulk assign users to employee type | `users.assign_employee_type` |

#### Location Management Endpoints

**Base Path:** `/api/locations`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/locations` | List locations (tree structure) | `locations.read` |
| GET | `/api/locations/:id` | Get location details | `locations.read` |
| POST | `/api/locations` | Create new location | `locations.create` |
| PATCH | `/api/locations/:id` | Update location | `locations.update` |
| PATCH | `/api/locations/:id/move` | Move location in tree | `locations.update` |
| DELETE | `/api/locations/:id` | Disable location | `locations.delete` |
| GET | `/api/locations/:id/ancestors` | Get location ancestors | `locations.read` |
| GET | `/api/locations/:id/descendants` | Get location descendants | `locations.read` |

#### Working Hours Configuration Endpoints

**Base Path:** `/api/config/work-hours`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/config/work-hours` | List work hours configs | `config.read` |
| GET | `/api/config/work-hours/:id` | Get work hours config | `config.read` |
| POST | `/api/config/work-hours` | Create work hours config | `config.create` |
| PATCH | `/api/config/work-hours/:id` | Update work hours config | `config.update` |
| DELETE | `/api/config/work-hours/:id` | Delete work hours config | `config.delete` |
| GET | `/api/config/work-hours/by-staff-type/:staffType` | Get config by staff type | `config.read` |
| GET | `/api/config/work-hours/by-location/:locationId` | Get config by location | `config.read` |

#### Leave Type Management Endpoints

**Base Path:** `/api/leave/types`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/leave/types` | List leave types | `leave.types.read` |
| GET | `/api/leave/types/:id` | Get leave type details | `leave.types.read` |
| POST | `/api/leave/types` | Create leave type | `leave.types.create` |
| PATCH | `/api/leave/types/:id` | Update leave type | `leave.types.update` |
| DELETE | `/api/leave/types/:id` | Delete leave type | `leave.types.delete` |

#### Leave Balance Endpoints

**Base Path:** `/api/leave/balances`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/leave/balances` | List balances (scope-filtered) | `leave.balances.read` |
| GET | `/api/leave/balances/:id` | Get balance details | `leave.balances.read` |
| GET | `/api/leave/balances/user/:userId` | Get user's leave balances | `leave.balances.read` |
| PATCH | `/api/leave/balances/:id` | Update balance (admin only) | `leave.balances.update` |

#### Leave Request Endpoints

**Base Path:** `/api/leave/requests`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/leave/requests` | List requests (scope-filtered) | `leave.requests.read` |
| GET | `/api/leave/requests/:id` | Get request details | `leave.requests.read` |
| POST | `/api/leave/requests` | Create leave request | `leave.requests.create` |
| PATCH | `/api/leave/requests/:id` | Update request (Draft/Adjusted only) | `leave.requests.update` |
| DELETE | `/api/leave/requests/:id` | Cancel request | `leave.requests.delete` |
| POST | `/api/leave/requests/:id/submit` | Submit for approval | `leave.requests.submit` |
| GET | `/api/leave/requests/:id/workflow` | Get workflow status | `leave.requests.read` |

#### Timesheet Period Endpoints

**Base Path:** `/api/timesheets/periods`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/timesheets/periods` | List periods | `timesheets.periods.read` |
| GET | `/api/timesheets/periods/:id` | Get period details | `timesheets.periods.read` |
| POST | `/api/timesheets/periods/:id/lock` | Lock period | `timesheets.periods.lock` |
| POST | `/api/timesheets/periods/:id/unlock` | Unlock period | `timesheets.periods.lock` |

#### Timesheet Endpoints

**Base Path:** `/api/timesheets`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/timesheets` | List timesheets (scope-filtered) | `timesheets.read` |
| GET | `/api/timesheets/:id` | Get timesheet details | `timesheets.read` |
| POST | `/api/timesheets` | Create timesheet | `timesheets.create` |
| PATCH | `/api/timesheets/:id` | Update timesheet (Draft/Adjusted only) | `timesheets.update` |
| POST | `/api/timesheets/:id/submit` | Submit for approval | `timesheets.submit` |
| GET | `/api/timesheets/:id/workflow` | Get workflow status | `timesheets.read` |
| GET | `/api/timesheets/:id/pdf` | Download PDF (Approved only, includes signatures) | `timesheets.read` |
| GET | `/api/timesheets/:id/signatures` | Get all approval signatures for timesheet | `timesheets.read` |
| GET | `/api/leave/requests/:id/signatures` | Get all approval signatures for leave request | `leave.requests.read` |
| GET | `/api/workflows/instances/:id/signatures` | Get all signatures for workflow instance | `workflows.instances.read` |
| POST | `/api/workflows/instances/:id/verify-signature` | Verify digital signature integrity | `workflows.instances.read` |
| GET | `/api/timesheets/:id/entries` | List timesheet entries | `timesheets.read` |
| POST | `/api/timesheets/:id/entries` | Add entry | `timesheets.update` |
| PATCH | `/api/timesheets/:id/entries/:entryId` | Update entry | `timesheets.update` |
| DELETE | `/api/timesheets/:id/entries/:entryId` | Delete entry | `timesheets.update` |

#### Workflow Template Endpoints

**Base Path:** `/api/workflows/templates`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/workflows/templates` | List templates | `workflows.templates.read` |
| GET | `/api/workflows/templates/:id` | Get template details | `workflows.templates.read` |
| POST | `/api/workflows/templates` | Create template | `workflows.templates.create` |
| PATCH | `/api/workflows/templates/:id` | Update template | `workflows.templates.update` |
| POST | `/api/workflows/templates/:id/steps` | Add workflow step | `workflows.templates.update` |
| PATCH | `/api/workflows/templates/:id/steps/:stepId` | Update workflow step | `workflows.templates.update` |
| DELETE | `/api/workflows/templates/:id/steps/:stepId` | Remove workflow step | `workflows.templates.update` |

#### Workflow Instance Endpoints

**Base Path:** `/api/workflows/instances`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/workflows/instances` | List instances (scope-filtered) | `workflows.instances.read` |
| GET | `/api/workflows/instances/:id` | Get instance details | `workflows.instances.read` |
| POST | `/api/workflows/instances/:id/approve` | Approve step (LOCKED) | `workflows.instances.approve` |
| POST | `/api/workflows/instances/:id/decline` | Decline step with routing choice (LOCKED) | `workflows.instances.approve` |
| POST | `/api/workflows/instances/:id/adjust` | Request adjustment with routing choice (LOCKED) | `workflows.instances.approve` |
| GET | `/api/workflows/instances/:id/history` | Get approval history (includes signatures) | `workflows.instances.read` |

#### Delegation Endpoints

**Base Path:** `/api/delegations`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/delegations` | List delegations (filtered) | `delegations.read` |
| GET | `/api/delegations/:id` | Get delegation details | `delegations.read` |
| POST | `/api/delegations` | Create delegation | `delegations.create` |
| PATCH | `/api/delegations/:id/revoke` | Revoke delegation | `delegations.revoke` |
| DELETE | `/api/delegations/:id` | Delete delegation | `delegations.delete` |

#### Notification Endpoints

**Base Path:** `/api/notifications`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/notifications` | List user notifications | `notifications.read` |
| GET | `/api/notifications/:id` | Get notification details | `notifications.read` |
| POST | `/api/notifications/:id/read` | Mark as read | `notifications.update` |
| POST | `/api/notifications/:id/unread` | Mark as unread | `notifications.update` |
| POST | `/api/notifications/read-all` | Mark all as read | `notifications.update` |
| GET | `/api/notifications/preferences` | Get notification preferences | `notifications.read` |
| PATCH | `/api/notifications/preferences` | Update preferences | `notifications.update` |

#### Reporting Endpoints

**Base Path:** `/api/reports`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/reports/leave/utilization` | Leave utilization report | `reports.read` |
| GET | `/api/reports/leave/balances` | Leave balance report | `reports.read` |
| GET | `/api/reports/timesheets/summary` | Timesheet summary report | `reports.read` |
| GET | `/api/reports/timesheets/monthly` | Monthly timesheet report | `reports.read` |
| GET | `/api/reports/approvals/pending` | Pending approvals report | `reports.read` |
| GET | `/api/reports/dashboard/regional` | Regional dashboard data | `reports.read` |

#### Audit Log Endpoints

**Base Path:** `/api/audit`

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/audit/logs` | List audit logs (scope-filtered, paginated) | `audit.read` |
| GET | `/api/audit/logs/:id` | Get log entry | `audit.read` |
| GET | `/api/audit/resources/:type/:id` | Get resource audit history | `audit.read` |

---

## Request/Response Specifications

### Standard Request Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-01-27T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "additional context"
    }
  },
  "meta": {
    "timestamp": "2025-01-27T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

### Pagination Format

**Request Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20, max: 100)
- `cursor` (string, for cursor-based pagination)

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false,
    "next_cursor": "cursor_xyz"
  }
}
```

### Example API Requests/Responses

#### Create Leave Request

**Request:**
```http
POST /api/leave/requests
Authorization: Bearer <token>
Content-Type: application/json

{
  "leave_type_id": "uuid-123",
  "start_date": "2025-02-10",
  "end_date": "2025-02-14",
  "reason": "Family vacation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "req-456",
    "user_id": "user-789",
    "leave_type": {
      "id": "uuid-123",
      "name": "Vacation",
      "is_paid": true
    },
    "start_date": "2025-02-10",
    "end_date": "2025-02-14",
    "days_requested": 5,
    "reason": "Family vacation",
    "status": "Draft",
    "workflow_instance_id": null,
    "location_id": "loc-nairobi",
    "created_at": "2025-01-27T10:00:00Z"
  }
}
```

#### Submit Leave Request for Approval

**Request:**
```http
POST /api/leave/requests/req-456/submit
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "req-456",
    "status": "Under Review",
    "workflow_instance": {
      "id": "wf-inst-789",
      "current_step_order": 1,
      "status": "Under Review",
      "steps": [
        {
          "step_order": 1,
          "status": "pending",
          "required_permission": "leave.approve",
          "assigned_to": "user-manager-123"
        }
      ]
    }
  }
}
```

#### Approve Workflow Step (with Digital Signature)

**Request:**
```http
POST /api/workflows/instances/wf-inst-789/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "comment": "Approved - team coverage confirmed"
}
```

**Note:** Digital signature and timestamp are automatically generated and appended by the system when the approval is processed.

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow_instance_id": "wf-inst-789",
    "step_approved": 1,
    "next_step": 2,
    "workflow_status": "Under Review",
    "message": "Step 1 approved. Moving to step 2.",
    "signature": {
      "digital_signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "signature_timestamp": "2025-01-27T14:30:15.123Z",
      "signature_hash": "a1b2c3d4e5f6...",
      "signature_method": "system",
      "signed_by": {
        "user_id": "user-sarah-789",
        "name": "Sarah Manager",
        "email": "sarah@path.org",
        "role": "Manager"
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0..."
    }
  }
}
```

**Digital Signature Details:**
- **Automatic Generation:** Digital signature is automatically generated when approval is submitted
- **Content Signed:** Signature includes: workflow instance ID, step order, approver ID, timestamp, comment, and resource content hash
- **Timestamp:** Precise UTC timestamp recorded at the moment of approval
- **Immutable:** Once signed, the signature cannot be modified
- **Verifiable:** Signature can be verified to ensure approval integrity

#### Decline Workflow Step with Routing Choice

**Request:**
```http
POST /api/workflows/instances/wf-inst-789/decline
Authorization: Bearer <token>
Content-Type: application/json

{
  "comment": "Hours don't match approved leave days. Please verify.",
  "route_to": "step_1",
  "route_to_step_order": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow_instance_id": "wf-inst-789",
    "step_declined": 2,
    "routed_to": "step_1",
    "routed_to_step_order": 1,
    "workflow_status": "Adjusted",
    "comment": "Hours don't match approved leave days. Please verify.",
    "message": "Timesheet declined and routed back to Step 1 for re-review."
  }
}
```

**Routing Options:**
- `"route_to": "employee"` - Send back to original submitter (Draft status)
- `"route_to": "step_0"` - Send back to Step 0 (if exists)
- `"route_to": "step_1"` - Send back to Step 1
- `"route_to": "step_N"` - Send back to any previous step N
- `"route_to_step_order": 1` - Specific step number to route to

#### Create Timesheet

**Request:**
```http
POST /api/timesheets
Authorization: Bearer <token>
Content-Type: application/json

{
  "period_start": "2025-02-01",
  "period_end": "2025-02-28",
  "entries": [
    {
      "date": "2025-02-01",
      "hours": 8.5,
      "description": "Regular work"
    },
    {
      "date": "2025-02-02",
      "hours": 8.5,
      "description": "Regular work"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ts-123",
    "user_id": "user-789",
    "period_start": "2025-02-01",
    "period_end": "2025-02-28",
    "status": "Draft",
    "total_hours": 17,
    "entries": [
      {
        "id": "entry-1",
        "date": "2025-02-01",
        "hours": 8.5,
        "description": "Regular work",
        "is_leave": false,
        "is_holiday": false
      },
      {
        "id": "entry-2",
        "date": "2025-02-02",
        "hours": 8.5,
        "description": "Regular work",
        "is_leave": false,
        "is_holiday": false
      }
    ],
    "auto_added_leaves": []
  }
}
```

#### Create Workflow Template

**Request:**
```http
POST /api/workflows/templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Nairobi Leave Approval",
  "resource_type": "leave",
  "location_id": "loc-nairobi",
  "steps": [
    {
      "step_order": 1,
      "required_permission": "leave.approve",
      "allow_decline": true,
      "allow_adjust": true
    },
    {
      "step_order": 2,
      "required_permission": "leave.approve",
      "allow_decline": true,
      "allow_adjust": false
    },
    {
      "step_order": 3,
      "required_permission": "leave.approve",
      "allow_decline": true,
      "allow_adjust": false
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "template-123",
    "name": "Nairobi Leave Approval",
    "resource_type": "leave",
    "location_id": "loc-nairobi",
    "version": 1,
    "status": "active",
    "steps": [
      {
        "id": "step-1",
        "step_order": 1,
        "required_permission": "leave.approve",
        "allow_decline": true,
        "allow_adjust": true
      },
      {
        "id": "step-2",
        "step_order": 2,
        "required_permission": "leave.approve",
        "allow_decline": true,
        "allow_adjust": false
      },
      {
        "id": "step-3",
        "step_order": 3,
        "required_permission": "leave.approve",
        "allow_decline": true,
        "allow_adjust": false
      }
    ]
  }
}
```

#### Get Workflow Approval History (with Signatures)

**Request:**
```http
GET /api/workflows/instances/wf-inst-789/history
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow_instance_id": "wf-inst-789",
    "resource_type": "timesheet",
    "resource_id": "ts-123",
    "approval_history": [
      {
        "step_order": 1,
        "status": "approved",
        "approver": {
          "id": "user-kelly-123",
          "name": "Kelly Supervisor",
          "email": "kelly@path.org",
          "role": "Supervisor"
        },
        "digital_signature": {
          "signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "signature_timestamp": "2025-02-28T09:15:30.123Z",
          "signature_hash": "a1b2c3d4e5f6...",
          "signature_method": "system",
          "ip_address": "192.168.1.100",
          "user_agent": "Mozilla/5.0..."
        },
        "comment": "Verified - hours match entries",
        "acted_at": "2025-02-28T09:15:30.123Z",
        "delegated_from": null
      },
      {
        "step_order": 2,
        "status": "approved",
        "approver": {
          "id": "user-liam-456",
          "name": "Liam Manager",
          "email": "liam@path.org",
          "role": "Manager"
        },
        "digital_signature": {
          "signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "signature_timestamp": "2025-02-28T10:30:45.456Z",
          "signature_hash": "b2c3d4e5f6a7...",
          "signature_method": "system",
          "ip_address": "192.168.1.101",
          "user_agent": "Mozilla/5.0..."
        },
        "comment": "Approved for payroll",
        "acted_at": "2025-02-28T10:30:45.456Z",
        "delegated_from": null
      },
      {
        "step_order": 3,
        "status": "approved",
        "approver": {
          "id": "user-michael-789",
          "name": "Michael HR Manager",
          "email": "michael@path.org",
          "role": "HR Manager"
        },
        "digital_signature": {
          "signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          "signature_timestamp": "2025-02-28T11:45:20.789Z",
          "signature_hash": "c3d4e5f6a7b8...",
          "signature_method": "system",
          "ip_address": "192.168.1.102",
          "user_agent": "Mozilla/5.0..."
        },
        "comment": "Final approval - ready for processing",
        "acted_at": "2025-02-28T11:45:20.789Z",
        "delegated_from": null
      }
    ],
    "workflow_status": "Approved",
    "completed_at": "2025-02-28T11:45:20.789Z"
  }
}
```

#### Create Delegation

**Request:**
```http
POST /api/delegations
Authorization: Bearer <token>
Content-Type: application/json

{
  "delegate_user_id": "user-tom-123",
  "permission_id": "perm-leave-approve",
  "location_id": "loc-nairobi",
  "valid_from": "2025-02-10T00:00:00Z",
  "valid_until": "2025-02-20T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "del-456",
    "delegator_user_id": "user-sarah-789",
    "delegate_user_id": "user-tom-123",
    "permission": {
      "id": "perm-leave-approve",
      "name": "leave.approve"
    },
    "location": {
      "id": "loc-nairobi",
      "name": "Nairobi Office"
    },
    "valid_from": "2025-02-10T00:00:00Z",
    "valid_until": "2025-02-20T23:59:59Z",
    "status": "active",
    "created_at": "2025-01-27T10:00:00Z"
  }
}
```

---

## Error Handling Standards

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `AUTH_INVALID` | 401 | Invalid or expired token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `SCOPE_FORBIDDEN` | 403 | Location scope mismatch |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `WORKFLOW_LOCKED` | 409 | Workflow instance is being processed |
| `WORKFLOW_INVALID_STATE` | 400 | Invalid workflow state for operation |
| `PERIOD_LOCKED` | 409 | Timesheet period is locked |
| `LEAVE_BALANCE_INSUFFICIENT` | 400 | Insufficient leave balance |
| `DELEGATION_INVALID` | 400 | Invalid delegation parameters |
| `SERVER_ERROR` | 500 | Internal server error |

### Example Error Responses

**Authentication Required:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required. Please provide a valid access token.",
    "details": {}
  }
}
```

**Insufficient Permissions:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "details": {
      "required_permission": "leave.approve",
      "user_permissions": ["leave.read", "timesheet.read"]
    }
  }
}
```

**Workflow Locked:**
```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_LOCKED",
    "message": "Workflow instance is currently being processed by another user.",
    "details": {
      "workflow_instance_id": "wf-inst-789",
      "locked_by": "user-123",
      "retry_after": 30
    }
  }
}
```

**Validation Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "start_date": "Start date must be in the future",
        "end_date": "End date must be after start date"
      }
    }
  }
}
```

---

## PART 4: IMPLEMENTATION DETAILS

### Database Schema Enhancements

#### WorkHoursConfiguration Table

```sql
CREATE TABLE work_hours_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_type VARCHAR(50) NOT NULL, -- 'regular', 'temporary', 'hrh'
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    monday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    tuesday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    wednesday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    thursday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    friday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    saturday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    sunday_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    weekly_total DECIMAL(5,2) NOT NULL, -- Calculated: sum of all days
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive'
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_work_hours_staff_type (staff_type, status),
    INDEX idx_work_hours_location (location_id, status),
    INDEX idx_work_hours_status (status)
);

-- Example data:
-- Regular/Temporary Staff (Nairobi):
-- Mon-Thu: 8.5, Fri: 6, Sat-Sun: 0 = 40 hours/week
-- HRH Staff (Global):
-- Mon-Fri: 8, Sat-Sun: 0 = 40 hours/week
```

#### Notifications Table

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'approval_request', 'approval_complete', 'leave_status', 'timesheet_status', 'delegation'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    resource_type VARCHAR(50), -- 'leave_request', 'timesheet', 'workflow_instance', etc.
    resource_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_notifications_user (user_id, is_read, created_at),
    INDEX idx_notifications_resource (resource_type, resource_id),
    INDEX idx_notifications_type (type, created_at)
);
```

#### NotificationPreferences Table

```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,
    approval_requests BOOLEAN NOT NULL DEFAULT true,
    status_changes BOOLEAN NOT NULL DEFAULT true,
    delegations BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### TimesheetEntries Enhancement

```sql
-- Add columns to existing timesheet_entries table
ALTER TABLE timesheet_entries
ADD COLUMN leave_request_id UUID REFERENCES leave_requests(id) ON DELETE SET NULL,
ADD COLUMN leave_type_name VARCHAR(255),
ADD COLUMN is_holiday BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN is_leave BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX idx_timesheet_entries_leave_request ON timesheet_entries(leave_request_id);
CREATE INDEX idx_timesheet_entries_is_leave ON timesheet_entries(is_leave, date);
```

#### Digital Signatures Enhancement for WorkflowStepInstances

```sql
-- Add digital signature and timestamp columns to WorkflowStepInstances table
ALTER TABLE workflow_step_instances
ADD COLUMN digital_signature TEXT, -- Base64 encoded digital signature
ADD COLUMN signature_timestamp TIMESTAMP, -- Timestamp when signature was created
ADD COLUMN signature_hash VARCHAR(255), -- Hash of the signed content for verification
ADD COLUMN signature_method VARCHAR(50) DEFAULT 'system', -- 'system', 'external', 'certificate'
ADD COLUMN ip_address INET, -- IP address of the approver
ADD COLUMN user_agent TEXT; -- User agent/browser information

-- Indexes for signature verification
CREATE INDEX idx_workflow_step_signatures ON workflow_step_instances(workflow_instance_id, signature_timestamp);
CREATE INDEX idx_workflow_step_signed_by ON workflow_step_instances(acted_by, signature_timestamp);
```

**Digital Signature Fields:**
- `digital_signature`: Base64-encoded digital signature (cryptographic hash of approval content)
- `signature_timestamp`: Precise timestamp when the signature was created (UTC)
- `signature_hash`: Hash of the signed content (for verification and integrity checking)
- `signature_method`: Method used for signing ('system' = system-generated, 'external' = external certificate, 'certificate' = digital certificate)
- `ip_address`: IP address of the approver at time of signing
- `user_agent`: Browser/client information for audit trail

### Digital Signatures & Timestamps System

#### Overview

**REQUIREMENT:** Every approver and approval action must have a digital signature and timestamp appended to timesheets and leave requests.

**Purpose:**
- **Audit Trail:** Complete record of who approved what and when
- **Compliance:** Legal and regulatory compliance requirements
- **Integrity:** Verify that approvals have not been tampered with
- **Non-Repudiation:** Approvers cannot deny their approval actions
- **PDF Documentation:** Signatures appear on downloaded PDFs

#### Digital Signature Implementation

**Automatic Generation:**
- ✅ Digital signatures are **automatically generated** when an approval action is taken
- ✅ No manual signature input required from approvers
- ✅ Signature is created server-side using cryptographic hashing
- ✅ Timestamp is recorded at the exact moment of approval (UTC)

**Signature Content:**
The digital signature includes a hash of:
- Workflow instance ID
- Step order
- Approver user ID
- Approval timestamp
- Comment (if provided)
- Resource content hash (timesheet/leave request data)
- Previous step signatures (chain of trust)

**Signature Storage:**
- Stored in `WorkflowStepInstances` table
- Each approval step has its own signature
- Signatures are immutable (cannot be modified after creation)
- All signatures are preserved in audit logs

#### Signature Fields in Database

```sql
-- WorkflowStepInstances table includes:
digital_signature TEXT,           -- Base64 encoded signature
signature_timestamp TIMESTAMP,    -- UTC timestamp of approval
signature_hash VARCHAR(255),      -- Hash of signed content
signature_method VARCHAR(50),     -- 'system', 'external', 'certificate'
ip_address INET,                  -- Approver's IP address
user_agent TEXT                   -- Browser/client information
```

#### Signature Display in PDFs

**Timesheet PDF Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ TIMESHEET - FEBRUARY 2025                                    │
│ Employee: John Doe                                           │
│ Period: 2025-02-01 to 2025-02-28                            │
│ Total Hours: 194                                              │
├─────────────────────────────────────────────────────────────┤
│ [Timesheet Entries Table]                                    │
├─────────────────────────────────────────────────────────────┤
│ APPROVAL SIGNATURES                                          │
├─────────────────────────────────────────────────────────────┤
│ Step 1: Supervisor Approval                                  │
│ ├─ Approved By: Kelly Supervisor                             │
│ ├─ Signature: [Digital Signature Hash]                        │
│ ├─ Timestamp: 2025-02-28 09:15:30 UTC                        │
│ └─ Comment: "Verified - hours match entries"                 │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Manager Approval                                     │
│ ├─ Approved By: Liam Manager                                │
│ ├─ Signature: [Digital Signature Hash]                      │
│ ├─ Timestamp: 2025-02-28 10:30:45 UTC                        │
│ └─ Comment: "Approved for payroll"                           │
├─────────────────────────────────────────────────────────────┤
│ Step 3: HR Manager Approval                                  │
│ ├─ Approved By: Michael HR Manager                           │
│ ├─ Signature: [Digital Signature Hash]                       │
│ ├─ Timestamp: 2025-02-28 11:45:20 UTC                        │
│ └─ Comment: "Final approval - ready for processing"          │
└─────────────────────────────────────────────────────────────┘
```

**Leave Request PDF Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ LEAVE REQUEST                                                │
│ Employee: John Doe                                           │
│ Leave Type: Vacation                                         │
│ Dates: 2025-02-10 to 2025-02-14 (5 days)                    │
├─────────────────────────────────────────────────────────────┤
│ [Leave Request Details]                                      │
├─────────────────────────────────────────────────────────────┤
│ APPROVAL SIGNATURES                                          │
├─────────────────────────────────────────────────────────────┤
│ Step 1: Manager Approval                                    │
│ ├─ Approved By: Sarah Manager                               │
│ ├─ Signature: [Digital Signature Hash]                        │
│ ├─ Timestamp: 2025-01-27 14:30:15 UTC                        │
│ └─ Comment: "Approved - team coverage confirmed"            │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Program Officer Approval                            │
│ ├─ Approved By: Alice Program Officer                        │
│ ├─ Signature: [Digital Signature Hash]                       │
│ ├─ Timestamp: 2025-01-27 15:45:22 UTC                       │
│ └─ Comment: "Approved"                                       │
├─────────────────────────────────────────────────────────────┤
│ Step 3: HR Manager Approval                                  │
│ ├─ Approved By: Michael HR Manager                           │
│ ├─ Signature: [Digital Signature Hash]                       │
│ ├─ Timestamp: 2025-01-27 16:20:10 UTC                        │
│ └─ Comment: "Final approval"                                 │
└─────────────────────────────────────────────────────────────┘
```

#### API Endpoints for Signatures

**Get All Signatures for Timesheet:**
```http
GET /api/timesheets/ts-123/signatures
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timesheet_id": "ts-123",
    "signatures": [
      {
        "step_order": 1,
        "approver": {
          "id": "user-kelly-123",
          "name": "Kelly Supervisor",
          "email": "kelly@path.org",
          "role": "Supervisor"
        },
        "digital_signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "signature_timestamp": "2025-02-28T09:15:30.123Z",
        "signature_hash": "a1b2c3d4e5f6...",
        "signature_method": "system",
        "comment": "Verified - hours match entries",
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "delegated_from": null
      },
      {
        "step_order": 2,
        "approver": {
          "id": "user-liam-456",
          "name": "Liam Manager",
          "email": "liam@path.org",
          "role": "Manager"
        },
        "digital_signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "signature_timestamp": "2025-02-28T10:30:45.456Z",
        "signature_hash": "b2c3d4e5f6a7...",
        "signature_method": "system",
        "comment": "Approved for payroll",
        "ip_address": "192.168.1.101",
        "user_agent": "Mozilla/5.0...",
        "delegated_from": null
      },
      {
        "step_order": 3,
        "approver": {
          "id": "user-michael-789",
          "name": "Michael HR Manager",
          "email": "michael@path.org",
          "role": "HR Manager"
        },
        "digital_signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "signature_timestamp": "2025-02-28T11:45:20.789Z",
        "signature_hash": "c3d4e5f6a7b8...",
        "signature_method": "system",
        "comment": "Final approval - ready for processing",
        "ip_address": "192.168.1.102",
        "user_agent": "Mozilla/5.0...",
        "delegated_from": null
      }
    ]
  }
}
```

**Get All Signatures for Leave Request:**
```http
GET /api/leave/requests/req-456/signatures
Authorization: Bearer <token>
```

**Response:** Similar structure to timesheet signatures

**Verify Signature Integrity:**
```http
POST /api/workflows/instances/wf-inst-789/verify-signature
Authorization: Bearer <token>
Content-Type: application/json

{
  "step_order": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "workflow_instance_id": "wf-inst-789",
    "step_order": 1,
    "signature_valid": true,
    "verification_result": {
      "signature_integrity": "valid",
      "timestamp_verified": true,
      "content_hash_match": true,
      "chain_of_trust": "intact"
    },
    "signature_details": {
      "signed_by": "Sarah Manager",
      "signature_timestamp": "2025-01-27T14:30:15.123Z",
      "signature_hash": "a1b2c3d4e5f6..."
    }
  }
}
```

#### Signature Generation Process

**When Approval is Submitted:**
1. System captures approval action (approve/decline/adjust)
2. System generates signature content hash:
   - Workflow instance ID
   - Step order
   - Approver user ID
   - Current timestamp (UTC)
   - Comment
   - Resource content hash
   - Previous signatures (if any)
3. System creates digital signature using cryptographic hash (SHA-256)
4. System records:
   - Digital signature (Base64 encoded)
   - Signature timestamp (UTC)
   - Signature hash
   - IP address
   - User agent
5. Signature is stored in database (immutable)
6. Signature is appended to PDF when generated

#### Delegation Signatures

**When Approval is Made Through Delegation:**
- Signature includes delegation context
- `delegated_from` field indicates original approver
- Signature shows both delegate and delegator information
- Example:
  ```json
  {
    "step_order": 1,
    "approver": {
      "id": "user-tom-123",
      "name": "Tom Supervisor",
      "role": "Supervisor"
    },
    "delegated_from": {
      "id": "user-sarah-789",
      "name": "Sarah Manager",
      "role": "Manager"
    },
    "digital_signature": "...",
    "signature_timestamp": "2025-02-15T10:30:00.000Z",
    "comment": "Approved via delegation from Sarah Manager"
  }
  ```

#### Signature Verification

**Verification Process:**
1. Retrieve signature from database
2. Recalculate content hash using stored data
3. Compare calculated hash with stored signature hash
4. Verify timestamp is within valid range
5. Verify signature chain (if multiple steps)
6. Return verification result

**Verification Endpoints:**
- `POST /api/workflows/instances/:id/verify-signature` - Verify specific step signature
- `GET /api/workflows/instances/:id/verify-all` - Verify all signatures in workflow

#### PDF Generation with Signatures

**PDF Structure:**
- Main content (timesheet entries or leave request details)
- Approval signatures section at the bottom
- Each signature includes:
  - Approver name and role
  - Digital signature hash (truncated for display)
  - Full timestamp (date and time in UTC)
  - Comment (if provided)
  - IP address (for audit)
  - Delegation info (if applicable)

**PDF Security:**
- PDFs are digitally signed documents
- Signatures cannot be modified after generation
- PDF includes metadata with all signature hashes
- PDF can be verified for integrity

#### Signature Requirements Summary

**✅ CONFIRMED:**
- ✅ **Every Approval:** Digital signature and timestamp automatically appended
- ✅ **Every Approver:** Signature includes approver identity and role
- ✅ **Timesheets:** All approval signatures appear on PDF
- ✅ **Leave Requests:** All approval signatures appear on PDF
- ✅ **Immutable:** Signatures cannot be modified after creation
- ✅ **Verifiable:** Signatures can be verified for integrity
- ✅ **Audit Trail:** Complete record of all approvals with signatures
- ✅ **Delegation Support:** Delegated approvals include delegation context in signature

**API Endpoints:**
- `GET /api/timesheets/:id/signatures` - Get all signatures for timesheet
- `GET /api/leave/requests/:id/signatures` - Get all signatures for leave request
- `GET /api/workflows/instances/:id/signatures` - Get all signatures for workflow
- `POST /api/workflows/instances/:id/verify-signature` - Verify signature integrity

---

### Notification System Design

#### Notification Types

1. **Approval Request:** When a workflow step is assigned to a user
2. **Approval Complete:** When a workflow step is completed
3. **Leave Status:** When leave request status changes
4. **Timesheet Status:** When timesheet status changes
5. **Delegation:** When delegation is created/revoked/expired

#### Notification Triggers

**Leave Request Workflow:**
- On submit → Notify Step 1 approver
- On approval → Notify next step approver (if exists) or requester (if complete)
- On decline → Notify requester
- On adjustment → Notify requester

**Timesheet Workflow:**
- On submit → Notify Step 1 approver
- On approval → Notify next step approver (if exists) or requester (if complete)
- On decline → Notify requester

**Leave → Timesheet Integration:**
- On leave approved → Notify requester: "Your approved leave has been added to your timesheet"

**Delegation:**
- On create → Notify delegate: "You have been delegated approval authority"
- On revoke → Notify delegate: "Your delegation has been revoked"
- On expire → Notify delegate: "Your delegation has expired"

#### Notification Delivery

**In-App Notifications:**
- Stored in `notifications` table
- Real-time updates via WebSocket or polling
- Mark as read/unread functionality

**Email Notifications:**
- Sent based on user preferences
- Email templates for each notification type
- Configurable frequency (immediate, daily digest, weekly digest)

#### Notification Service Implementation

```typescript
// Pseudo-code for notification service
class NotificationService {
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    resourceType?: string,
    resourceId?: string
  ) {
    // 1. Create in-app notification
    const notification = await db.notification.create({
      data: {
        user_id: userId,
        type,
        title,
        message,
        resource_type: resourceType,
        resource_id: resourceId,
        is_read: false
      }
    });

    // 2. Check user preferences
    const preferences = await db.notificationPreferences.findUnique({
      where: { user_id: userId }
    });

    // 3. Send email if enabled
    if (preferences?.email_enabled && shouldSendEmail(type, preferences)) {
      await emailService.send({
        to: user.email,
        subject: title,
        template: getEmailTemplate(type),
        data: { message, resourceType, resourceId }
      });
    }

    // 4. Emit real-time event (WebSocket)
    await websocketService.emit('notification', {
      userId,
      notification
    });

    return notification;
  }
}
```

### Reporting & Dashboard APIs

#### Leave Utilization Report

**Endpoint:** `GET /api/reports/leave/utilization`

**Query Parameters:**
- `location_id` (optional) - Filter by location
- `staff_type` (optional) - Filter by staff type
- `year` (optional, default: current year)
- `leave_type_id` (optional) - Filter by leave type

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_allocated": 120,
      "total_used": 85,
      "total_pending": 10,
      "total_remaining": 25,
      "utilization_rate": 70.8
    },
    "by_leave_type": [
      {
        "leave_type": { "id": "uuid", "name": "Vacation" },
        "allocated": 20,
        "used": 15,
        "pending": 2,
        "remaining": 3
      }
    ],
    "by_location": [
      {
        "location": { "id": "loc-nairobi", "name": "Nairobi Office" },
        "allocated": 60,
        "used": 45,
        "pending": 5,
        "remaining": 10
      }
    ],
    "by_staff_type": [
      {
        "staff_type": "regular",
        "allocated": 80,
        "used": 60,
        "pending": 7,
        "remaining": 13
      }
    ]
  }
}
```

#### Regional Dashboard

**Endpoint:** `GET /api/reports/dashboard/regional`

**Query Parameters:**
- `region_id` (optional) - Filter by region
- `period` (optional) - Month/quarter/year

**Response:**
```json
{
  "success": true,
  "data": {
    "region": {
      "id": "region-nairobi",
      "name": "Nairobi Region"
    },
    "period": "2025-02",
    "metrics": {
      "pending_approvals": {
        "leave_requests": 15,
        "timesheets": 8
      },
      "approved_this_month": {
        "leave_requests": 45,
        "timesheets": 120
      },
      "leave_utilization": {
        "total_used": 85,
        "total_allocated": 120,
        "rate": 70.8
      },
      "timesheet_completion": {
        "submitted": 120,
        "approved": 115,
        "pending": 5,
        "completion_rate": 95.8
      }
    },
    "locations": [
      {
        "location": { "id": "loc-nairobi", "name": "Nairobi Office" },
        "pending_approvals": 8,
        "approved_this_month": 25
      }
    ]
  }
}
```

### Performance Optimization Strategy

#### Database Optimization

1. **Indexing Strategy:**
   - All foreign keys indexed
   - Composite indexes for common query patterns
   - Partial indexes for soft-delete filtering
   - GIN indexes for JSONB columns

2. **Query Optimization:**
   - Use eager loading (Prisma `include`) to prevent N+1 queries
   - Scope filtering at database level
   - Pagination for all list endpoints
   - Connection pooling configured

3. **Caching Strategy:**
   - Redis cache for permission/scope resolutions
   - Cache invalidation on mutations
   - Short TTLs for security-sensitive data

#### API Optimization

1. **Response Time Targets:**
   - Simple queries: < 100ms
   - Complex queries: < 500ms
   - Workflow operations: < 1s

2. **Concurrency Handling:**
   - Transaction-based locking for approvals
   - Redis distributed locks
   - Database row locks

3. **Scalability:**
   - Horizontal scaling support
   - Stateless API design
   - Efficient database queries

---

## ✅ LINE-BY-LINE DYNAMIC CONFIGURATION CONFIRMATION

This section provides **explicit, line-by-line confirmation** that every aspect of the system is fully dynamic and configurable at runtime, based on the PATH Company requirements story.

### Approval Engine - Line-by-Line Confirmation

**FROM STORY (Line 21-23):** *"Now these leave requests go through different approval levels, from the manager to other people in the hierachy who need to approve( for example, the manager, the Program officer incharge of that region, the Hr manager incharge of that region then its fully approved ) so these are the roles that need to be dynamic too to offer endless posibilities for at one point i may descide that the leave requests only need one approver"*

**✅ CONFIRMED:**
- ✅ **Line 181-195:** Workflow Templates are fully dynamic - can have 1 to N approval steps
- ✅ **Line 1252-1254:** API endpoints exist to add/update/remove workflow steps dynamically
- ✅ **Line 227-228:** Each step can be configured with different permissions, roles, allow_decline, allow_adjust
- ✅ **Line 193-195:** Examples show both simple (1 step) and complex (3+ steps) workflows
- ✅ **Line 578:** Summary confirms "Unlimited approval steps, fully configurable"
- ✅ **No hardcoded limits:** The system supports unlimited approval steps - only limited by database storage

**API Evidence:**
- `POST /api/workflows/templates/:id/steps` - Add approval step
- `PATCH /api/workflows/templates/:id/steps/:stepId` - Update step
- `DELETE /api/workflows/templates/:id/steps/:stepId` - Remove step

### Locations - Line-by-Line Confirmation

**FROM STORY (Line 5):** *"A company called PATH works in different locations namely Nairobi, Kisumu, Kakamega, Vihiga and Nyamira."*

**✅ CONFIRMED:**
- ✅ **Line 91:** System supports "Multiple Locations: Nairobi, Kisumu, Kakamega, Vihiga, Nyamira (and extensible)"
- ✅ **Line 1154-1160:** API endpoints exist to create, update, move, and delete locations
- ✅ **Line 579:** Summary confirms "Add/remove/move locations, unlimited hierarchy levels"
- ✅ **Line 303-310:** Location hierarchy is fully mutable - can restructure tree at runtime
- ✅ **Line 1157:** `PATCH /api/locations/:id/move` - Move location in tree dynamically
- ✅ **Line 1158:** `DELETE /api/locations/:id` - Remove location dynamically

**API Evidence:**
- `POST /api/locations` - Create new location
- `PATCH /api/locations/:id` - Update location
- `PATCH /api/locations/:id/move` - Move location in tree
- `DELETE /api/locations/:id` - Remove location

### Roles - Line-by-Line Confirmation

**FROM STORY (Line 21):** *"so these are the roles that need to be dynamic too to offer endless posibilities"*

**✅ CONFIRMED:**
- ✅ **Line 175-179:** Roles are fully dynamic - create/update/delete at runtime
- ✅ **Line 1128-1135:** API endpoints exist for full CRUD operations on roles
- ✅ **Line 580:** Summary confirms "Create unlimited roles, fully configurable"
- ✅ **Line 315-325:** Examples show unlimited roles (Manager, Program Officer, HR Manager, System Admin, etc.)
- ✅ **Line 325:** Even "System Admin" is a dynamic role - can be renamed, modified, or removed
- ✅ **Line 1134-1135:** Permissions can be assigned/removed from roles dynamically

**API Evidence:**
- `POST /api/roles` - Create new role
- `PATCH /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role
- `POST /api/roles/:id/permissions` - Assign permission to role
- `DELETE /api/roles/:id/permissions/:permissionId` - Remove permission from role

### Leave Types & Leaves - Line-by-Line Confirmation

**FROM STORY (Line 15):** *"So this brings in sth new. I can be able to add leave types or remove leave types and assigne their parameters (say Sick Leave, Vacation etc) this too needs to by dynamic"*

**✅ CONFIRMED:**
- ✅ **Line 144-153:** Leave Types are fully dynamic - create/update/delete at runtime
- ✅ **Line 1182-1186:** API endpoints exist for full CRUD operations on leave types
- ✅ **Line 581:** Summary confirms "Create unlimited leave types with configurable parameters"
- ✅ **Line 350-361:** Configurable parameters listed: Name, Description, Is Paid, Max Days, Accrual Rules, Carry Forward, etc.
- ✅ **Line 340-347:** Examples show unlimited leave types (Sick Leave, Vacation, Maternity, Paternity, Emergency, etc.)
- ✅ **Line 1184-1185:** Can update leave type parameters at runtime

**API Evidence:**
- `POST /api/leave/types` - Create leave type
- `PATCH /api/leave/types/:id` - Update leave type (all parameters)
- `DELETE /api/leave/types/:id` - Remove leave type
- `GET /api/leave/types` - List all leave types

### Work Hours & Work Days - Line-by-Line Confirmation

**FROM STORY (Line 17-19):** *"Regular and Temp staff work 40 hrs a week excluding weekends (8.5 hrs Monday to Thursday and 6 Hours on Friday) and they have payed leave days. HRH staff work 40 hrs a week excluding weekends (8hrs from Monday to Friday). Now these working hours, I also need to be dynamic. Incase there is an organisaion that uses different working periods...You get?"*

**✅ CONFIRMED:**
- ✅ **Line 155-173:** Working Hours are fully dynamic - configurable per staff type and/or location
- ✅ **Line 1168-1174:** API endpoints exist for full CRUD operations on work hours
- ✅ **Line 582:** Summary confirms "Configure any work schedule, including weekends"
- ✅ **Line 384-399:** Default PATH configuration provided, but fully customizable
- ✅ **Line 388-390:** **Weekend work explicitly supported** - "Weekend Work: Configure Saturday and Sunday hours"
- ✅ **Line 401-405:** Examples show weekend workers, 4-day weeks, shift work, etc.
- ✅ **Line 1750-1780:** Database schema supports all 7 days of the week with decimal hours

**API Evidence:**
- `POST /api/config/work-hours` - Create work hours configuration
- `PATCH /api/config/work-hours/:id` - Update work hours (including weekends)
- `DELETE /api/config/work-hours/:id` - Remove configuration
- `GET /api/config/work-hours/by-staff-type/:staffType` - Get by staff type
- `GET /api/config/work-hours/by-location/:locationId` - Get by location

**Weekend Work Confirmation:**
- ✅ **Line 390:** "Weekend Work: Configure Saturday and Sunday hours (e.g., 8hrs each)"
- ✅ **Line 402:** Example: "Weekend Workers: Mon-Fri: 8hrs, Sat: 8hrs, Sun: 0hrs = 48hrs/week"
- ✅ **Line 1758-1759:** Database schema includes `saturday_hours` and `sunday_hours` columns

### Rejection Routing - Line-by-Line Confirmation

**FROM STORY (Line 29):** *"at the end we need to have fully approved timesheets or pending timesheets that need approval or those that are rejected and are sent back(to whowever is chosen by the person who rejects within the workflow) with comments for reapproval or rejection again"*

**✅ CONFIRMED:**
- ✅ **Line 859-927:** Timesheet rejection flow shows rejector chooses routing
- ✅ **Line 713-742:** Leave request rejection flow shows rejector chooses routing
- ✅ **Line 1265:** API endpoint: `POST /api/workflows/instances/:id/decline` - with routing choice
- ✅ **Line 877-888:** Rejection includes `route_to` parameter - rejector chooses destination
- ✅ **Line 731-742:** Leave rejection shows routing options (employee, previous step, etc.)
- ✅ **Line 891:** Key point: "Rejector Chooses Routing: The person rejecting can choose where the timesheet goes back to"

**API Evidence:**
- `POST /api/workflows/instances/:id/decline` - Decline with routing choice parameter
- Request body includes: `route_to` and `route_to_step_order` fields
- Rejector can choose: employee, step_0, step_1, step_2, etc.

### Delegation - Line-by-Line Confirmation

**FROM STORY (Line 25):** *"Note that in the event people cannot approve timesheets and they are part of the approval flow, they shall need to delegate or the system admin shall need to (so this system admin is also a role dynamic stuff) delgate that responsibility to a certain user in the system and if approved will be allowed to have the rights to now enter the work flow"*

**✅ CONFIRMED:**
- ✅ **Line 197-208:** Delegation system is fully dynamic
- ✅ **Line 1277-1279:** API endpoints exist for delegation management
- ✅ **Line 584:** Summary confirms "Fully dynamic delegation system"
- ✅ **Line 930-1016:** Delegation scenarios show self-delegation and admin delegation
- ✅ **Line 996-1008:** System Admin can delegate on behalf of users
- ✅ **Line 958-968:** Delegated approvals work in workflow

**API Evidence:**
- `POST /api/delegations` - Create delegation (self or admin)
- `PATCH /api/delegations/:id/revoke` - Revoke delegation
- `DELETE /api/delegations/:id` - Delete delegation

### Permissions - Line-by-Line Confirmation

**✅ CONFIRMED:**
- ✅ **Line 1143-1145:** API endpoints exist for permission management
- ✅ **Line 583:** Summary confirms "Create unlimited permissions, fully dynamic"
- ✅ **Line 60-64:** Permissions can be created and managed at runtime
- ✅ **Line 1134-1135:** Permissions assigned to roles dynamically

**API Evidence:**
- `POST /api/permissions` - Create new permission
- `GET /api/permissions` - List all permissions
- Permissions are database-driven, not hardcoded

### User Scopes - Line-by-Line Confirmation

**✅ CONFIRMED:**
- ✅ **Line 1118-1120:** API endpoints exist for user scope management
- ✅ **Line 585:** Summary confirms "Dynamic location scope assignment"
- ✅ **Line 491-502:** User scopes are fully configurable - assign/remove at runtime
- ✅ **Line 494-496:** Time-bound scopes and descendant inclusion supported

**API Evidence:**
- `POST /api/users/:id/scopes` - Create user scope
- `PATCH /api/users/:id/scopes/:scopeId` - Update scope
- `DELETE /api/users/:id/scopes/:scopeId` - Remove scope

### Timesheet Periods - Line-by-Line Confirmation

**✅ CONFIRMED:**
- ✅ **Line 1221-1222:** API endpoints exist for period locking/unlocking
- ✅ **Line 586:** Summary confirms "Dynamic period management"
- ✅ **Line 510-514:** Periods can be locked/unlocked dynamically
- ✅ **Line 893-922:** Period locking scenario documented

**API Evidence:**
- `POST /api/timesheets/periods/:id/lock` - Lock period
- `POST /api/timesheets/periods/:id/unlock` - Unlock period

### Staff Types - Line-by-Line Confirmation

**FROM STORY (Line 7):** *"This company has different types of staff (Regular Staff, Temporary Staff and HRH staff)"*

**✅ CONFIRMED:**
- ✅ **Line 92:** System supports "Multiple Staff Types: Regular Staff, Temporary Staff, HRH Staff (and extensible)"
- ✅ **Line 587:** Summary confirms "Extendable staff type system"
- ✅ **Line 520-523:** Staff types are dynamic (currently enum, can be made fully dynamic with table)
- ✅ **Line 396-397:** Different work hours per staff type supported

### Additional Dynamic Components Confirmed

**✅ CONFIRMED:**
- ✅ **Line 522-570:** Additional dynamic components listed (Notification Templates, Report Templates, Holiday Calendar, etc.)
- ✅ **Line 589:** Principle: "No hardcoded business logic. Everything is configurable at runtime through API endpoints."

---

## FINAL CONFIRMATION CHECKLIST

Based on the PATH Company requirements story, every requirement is confirmed as dynamic:

| Requirement from Story | Line Reference | Confirmation Status |
|----------------------|----------------|-------------------|
| Add/remove leave types | Line 15, 1182-1186 | ✅ CONFIRMED |
| Assign leave type parameters | Line 350-361 | ✅ CONFIRMED |
| Add more approval steps | Line 21, 1252-1254 | ✅ CONFIRMED |
| Dynamic roles | Line 21, 1128-1135 | ✅ CONFIRMED |
| Dynamic locations | Line 5, 1154-1160 | ✅ CONFIRMED |
| Dynamic work hours | Line 17-19, 1168-1174 | ✅ CONFIRMED |
| Weekend work support | Line 388-390, 402 | ✅ CONFIRMED |
| Rejector chooses routing | Line 29, 859-927 | ✅ CONFIRMED |
| Delegation system | Line 25, 1277-1279 | ✅ CONFIRMED |
| System Admin as dynamic role | Line 25, 325 | ✅ CONFIRMED |
| Digital signatures & timestamps | User Request | ✅ CONFIRMED |

**ALL REQUIREMENTS FROM THE PATH STORY ARE CONFIRMED AS FULLY DYNAMIC AND CONFIGURABLE AT RUNTIME.**

**ADDITIONAL FEATURES:**
- ✅ **Digital Signatures:** Every approver and approval has digital signature and timestamp automatically appended
- ✅ **PDF Signatures:** All signatures appear on downloaded timesheet and leave request PDFs
- ✅ **Signature Verification:** Signatures can be verified for integrity and authenticity

---

## SUMMARY

This comprehensive API design document provides:

1. ✅ **Complete Workflow Scenarios** - Based on PATH Company real-world requirements
2. ✅ **Full API Endpoint Catalog** - All endpoints with permissions and descriptions
3. ✅ **Request/Response Specifications** - Standard formats and examples
4. ✅ **Error Handling Standards** - Consistent error responses
5. ✅ **Database Schema Enhancements** - New tables and modifications
6. ✅ **Digital Signatures & Timestamps** - Every approval has digital signature and timestamp
7. ✅ **Notification System Design** - In-app and email notifications
8. ✅ **Reporting & Dashboard APIs** - Regional insights and analytics
9. ✅ **Performance Optimization** - Strategies for efficiency at scale

**Key Features:**
- **Fully Dynamic Configuration** - No hardcoded business logic
- **Scalable Architecture** - Designed for endless possibilities
- **Clear API Endpoints** - Well-defined and intuitive
- **Efficient Processing** - Optimized for performance
- **Comprehensive Workflows** - Supports all approval scenarios
- **Digital Signatures & Timestamps** - Every approval has digital signature and timestamp appended

---

**Document Version:** 1.0  
**Created:** 2025-01-27  
**Based On:** PATH Company Real-World Requirements Story  
**Status:** Complete - All Phases Documented
