# PATH Company - Real-World System Requirements

## COMPANY STORY & CONTEXT

**Company:** PATH  
**Industry:** Healthcare/Development Organization  
**Operational Model:** Multi-location with different staff types and work patterns

### Company Structure

**Locations:**
- Nairobi Office
- Kisumu Office
- Kakamega Office
- Vihiga Office
- Nyamira Office

**Staff Types:**
1. **Regular Staff** - Work at offices
2. **Temporary Staff** - Work at offices
3. **HRH Staff (Human Resources for Health)** - Work at facilities

### Work Patterns (Dynamic Configuration Required)

**Regular & Temporary Staff:**
- Work Location: Offices
- Weekly Hours: 40 hours
- Schedule:
  - Monday - Thursday: 8.5 hours/day
  - Friday: 6 hours/day
  - Weekends: Off
- Leave Type: Paid leave days

**HRH Staff:**
- Work Location: Facilities
- Weekly Hours: 40 hours
- Schedule:
  - Monday - Friday: 8 hours/day
  - Weekends: Off
- Leave Type: Paid leave days

**Critical Requirement:** Working hours and schedules must be **fully dynamic** to accommodate different organizations with varying work periods.

---

## CORE BUSINESS PROCESSES

### 1. Leave Request Management

#### Leave Types (Fully Dynamic)
- Leave types can be created, modified, or removed at runtime
- Examples: Sick Leave, Vacation, Maternity Leave, Paternity Leave, Emergency Leave, etc.
- Each leave type has configurable parameters:
  - Name
  - Description
  - Is Paid (boolean)
  - Max Days Per Year
  - Accrual Rules
  - Carry Forward Rules
  - Status (active/inactive)

#### Leave Request Lifecycle
1. **Employee creates leave request**
   - Selects leave type
   - Specifies dates
   - Provides reason
   - Status: Draft

2. **Employee submits leave request**
   - Triggers workflow instance
   - Status: Submitted → Under Review

3. **Multi-level approval workflow** (Dynamic)
   - Example flow: Manager → Program Officer (Region) → HR Manager (Region)
   - Can be configured for 1 approver or multiple approvers
   - Each approval level requires specific permission + location scope

4. **Approval outcomes:**
   - **Approved:** Leave is approved, balance updated, added to timesheet
   - **Declined:** Leave is rejected, balance unchanged, workflow terminated
   - **Adjusted:** Returned to employee with comments for modification

5. **Automatic timesheet integration**
   - Approved leaves are automatically added to timesheets
   - Labeled with leave type name
   - Contribute to total hours worked for the month

#### Leave Balance Tracking
- Leave balances tracked per employee, per leave type, per year
- Balances updated on approval
- Reports available for leave utilization
- Balance recalculation on adjustments

### 2. Timesheet Management

#### Timesheet Structure
- Records all days worked in the month
- Includes holidays (as filled by users)
- Includes approved leave days (automatically added)
- Each entry shows:
  - Date
  - Hours worked
  - Leave type (if applicable)
  - Description/Notes

#### Timesheet Approval Workflow (Dynamic)
- Similar to leave approval workflow
- Can be configured for 1 approver or multiple approvers
- Example flow: Supervisor → Manager → HR Manager
- Approval required for payroll processing

#### Timesheet States
- **Draft:** Employee is filling timesheet
- **Submitted:** Awaiting approval
- **Under Review:** In approval workflow
- **Approved:** Fully approved, locked, ready for payroll
- **Rejected:** Sent back with comments for resubmission
- **Adjusted:** Returned to employee for modifications

#### Timesheet Features
- **Period Locking:** Periods can be locked to prevent further submissions
- **PDF Generation:** Approved timesheets can be downloaded
- **Monthly Reports:** Timesheets downloadable for specific months
- **Clear Records:** All days worked and holidays clearly recorded

### 3. Approval Workflow System

#### Dynamic Workflow Configuration
- Workflows are location-specific
- Can have different workflows for different locations
- Workflow steps are configurable:
  - Number of steps (1 to N)
  - Required permission per step
  - Allow decline (boolean)
  - Allow adjust (boolean)
  - Step order

#### Example Approval Flows

**Leave Request - Nairobi Office:**
1. Direct Manager (leave.approve, Nairobi scope)
2. Program Officer - Nairobi Region (leave.approve, Nairobi Region scope)
3. HR Manager - Nairobi Region (leave.approve, Nairobi Region scope)

**Leave Request - Kisumu Office:**
1. Direct Manager (leave.approve, Kisumu scope)
2. Program Officer - Kisumu Region (leave.approve, Kisumu Region scope)
3. HR Manager - Kisumu Region (leave.approve, Kisumu Region scope)

**Simplified Flow (if configured):**
1. Manager only (leave.approve, location scope)

#### Delegation System
- When approvers are unavailable, they can delegate authority
- System admin can also delegate on behalf of users
- Delegations are:
  - Time-bound (valid_from, valid_until)
  - Location-scoped
  - Permission-specific
  - Can include descendants
- Delegated approvals are logged with delegation context

### 4. Role Management (Fully Dynamic)

#### Dynamic Roles
- Roles can be created, modified, or removed at runtime
- Examples:
  - Employee
  - Supervisor
  - Manager
  - Program Officer
  - HR Manager
  - System Admin
  - Regional Director
  - Finance Manager
  - CEO

#### Role Permissions
- Each role has assigned permissions
- Permissions are atomic (e.g., leave.approve, timesheet.approve, user.read)
- Users can have multiple roles
- Effective permissions = union of all role permissions

#### System Admin Role
- Special role with elevated privileges
- Can delegate on behalf of users
- Can manage workflows, roles, permissions
- Can override certain restrictions (with audit trail)

### 5. Location Hierarchy

#### Location Structure
```
PATH Organization
├─ Nairobi Region
│  └─ Nairobi Office
├─ Western Region
│  ├─ Kisumu Office
│  ├─ Kakamega Office
│  ├─ Vihiga Office
│  └─ Nyamira Office
```

#### Location-Based Scoping
- Permissions are scoped to locations
- Scopes can include descendants
- Regional roles can approve for all locations in their region
- Global roles can approve for all locations

### 6. Integration: Leave → Timesheet

#### Automatic Integration Flow
1. Leave request approved
2. System automatically:
   - Updates leave balance
   - Creates timesheet entry (if timesheet exists for that period)
   - Or adds to existing timesheet entry
   - Labels entry with leave type name
   - Calculates hours based on approved leave days
3. Timesheet total hours updated
4. Leave days contribute to monthly hours worked

#### Timesheet Entry Structure
```
Date: 2025-01-15
Hours: 8.5
Type: Vacation Leave
Description: Approved leave request #12345
```

### 7. Reporting & Analytics

#### Leave Reports
- Leave utilization by employee
- Leave utilization by location
- Leave utilization by leave type
- Leave balance reports
- Pending leave requests
- Approved/declined leave statistics

#### Timesheet Reports
- Monthly timesheet summaries
- Hours worked by employee
- Hours worked by location
- Approved timesheets
- Pending timesheets
- Rejected timesheets with reasons

#### Regional Dashboards
- Regional overview of approvals
- Pending approvals by region
- Leave utilization by region
- Timesheet status by region
- Staff attendance by region

### 8. Notification System

#### In-System Notifications
- Real-time notifications for:
  - Pending approvals assigned to user
  - Leave request status changes
  - Timesheet status changes
  - Delegation requests
  - Workflow step completions

#### Email Notifications
- Email alerts for:
  - New approval requests
  - Approval completed
  - Leave request approved/declined
  - Timesheet approved/rejected
  - Delegation assigned
  - Important system events

#### Notification Preferences
- Users can configure notification preferences
- Email frequency settings
- Notification types (in-app, email, both)

---

## SYSTEM REQUIREMENTS SUMMARY

### Dynamic Configuration Requirements
1. ✅ **Leave Types:** Create, modify, remove at runtime
2. ✅ **Workflows:** Configure approval steps dynamically
3. ✅ **Roles:** Create, modify, remove at runtime
4. ✅ **Permissions:** Assign to roles dynamically
5. ✅ **Working Hours:** Configure per staff type/location
6. ✅ **Location Hierarchy:** Mutable structure
7. ✅ **Scopes:** Assign location scopes dynamically
8. ✅ **Delegations:** Create/revoke at runtime

### Business Logic Requirements
1. ✅ **Leave → Timesheet Integration:** Automatic addition of approved leaves
2. ✅ **Balance Tracking:** Real-time leave balance updates
3. ✅ **Period Locking:** Prevent timesheet submissions for locked periods
4. ✅ **Multi-level Approval:** Configurable approval chains
5. ✅ **Delegation:** Temporary authority transfer
6. ✅ **Audit Trail:** Complete history of all actions

### Performance Requirements
1. ✅ **Efficient Approval Processing:** Transaction-based locking
2. ✅ **Fast Authority Resolution:** Cached permission checks
3. ✅ **Scalable Queries:** Optimized database indexes
4. ✅ **Real-time Updates:** Immediate effect of configuration changes

### User Experience Requirements
1. ✅ **Clear Status Visibility:** Draft, Submitted, Under Review, Approved, Rejected
2. ✅ **Comments & Feedback:** Rejection/adjustment comments
3. ✅ **Notifications:** Real-time and email alerts
4. ✅ **Reports:** Comprehensive reporting capabilities
5. ✅ **PDF Export:** Downloadable timesheets

---

## API DESIGN IMPLICATIONS

### Key Endpoints Required

#### Leave Management
- `POST /api/leave/types` - Create leave type (dynamic)
- `GET /api/leave/types` - List leave types
- `PATCH /api/leave/types/:id` - Update leave type
- `DELETE /api/leave/types/:id` - Remove leave type
- `POST /api/leave/requests` - Create leave request
- `GET /api/leave/requests` - List leave requests (scope-filtered)
- `POST /api/leave/requests/:id/submit` - Submit for approval
- `GET /api/leave/balances` - Get leave balances
- `GET /api/reports/leave/utilization` - Leave utilization report

#### Timesheet Management
- `POST /api/timesheets` - Create timesheet
- `GET /api/timesheets` - List timesheets (scope-filtered)
- `POST /api/timesheets/:id/submit` - Submit for approval
- `GET /api/timesheets/:id/pdf` - Download PDF (approved only)
- `GET /api/timesheets/periods` - List timesheet periods
- `POST /api/timesheets/periods/:id/lock` - Lock period
- `GET /api/reports/timesheets/monthly` - Monthly timesheet report

#### Workflow Configuration
- `POST /api/workflows/templates` - Create workflow template
- `GET /api/workflows/templates` - List templates
- `PATCH /api/workflows/templates/:id` - Update template
- `POST /api/workflows/templates/:id/steps` - Add workflow step
- `PATCH /api/workflows/templates/:id/steps/:stepId` - Update step
- `DELETE /api/workflows/templates/:id/steps/:stepId` - Remove step

#### Working Hours Configuration
- `POST /api/config/work-hours` - Create work hours configuration
- `GET /api/config/work-hours` - Get work hours (by staff type/location)
- `PATCH /api/config/work-hours/:id` - Update work hours
- `DELETE /api/config/work-hours/:id` - Remove configuration

#### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/:id/read` - Mark as read
- `GET /api/notifications/preferences` - Get notification preferences
- `PATCH /api/notifications/preferences` - Update preferences

---

## DATA MODEL ADDITIONS

### WorkHoursConfiguration Table
```sql
- id (UUID, PK)
- staff_type (ENUM: regular/temporary/hrh)
- location_id (UUID, FK → Locations.id, NULLABLE)
- monday_hours (DECIMAL)
- tuesday_hours (DECIMAL)
- wednesday_hours (DECIMAL)
- thursday_hours (DECIMAL)
- friday_hours (DECIMAL)
- saturday_hours (DECIMAL, DEFAULT 0)
- sunday_hours (DECIMAL, DEFAULT 0)
- weekly_total (DECIMAL)
- status (ENUM: active/inactive)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Notifications Table
```sql
- id (UUID, PK)
- user_id (UUID, FK → Users.id)
- type (ENUM: approval_request, approval_complete, leave_status, timesheet_status, delegation)
- title (VARCHAR)
- message (TEXT)
- resource_type (VARCHAR)
- resource_id (UUID)
- is_read (BOOLEAN, DEFAULT false)
- read_at (TIMESTAMP, NULLABLE)
- created_at (TIMESTAMP)
```

### NotificationPreferences Table
```sql
- id (UUID, PK)
- user_id (UUID, FK → Users.id, UNIQUE)
- email_enabled (BOOLEAN, DEFAULT true)
- in_app_enabled (BOOLEAN, DEFAULT true)
- approval_requests (BOOLEAN, DEFAULT true)
- status_changes (BOOLEAN, DEFAULT true)
- delegations (BOOLEAN, DEFAULT true)
- updated_at (TIMESTAMP)
```

### TimesheetEntries Enhancement
```sql
- leave_request_id (UUID, FK → LeaveRequests.id, NULLABLE)
- leave_type_name (VARCHAR, NULLABLE) -- For labeling
- is_holiday (BOOLEAN, DEFAULT false)
- is_leave (BOOLEAN, DEFAULT false)
```

---

## SCALABILITY CONSIDERATIONS

### Endless Possibilities
The system must support:
- Unlimited locations (with hierarchy)
- Unlimited staff types
- Unlimited leave types
- Unlimited workflow configurations
- Unlimited roles and permissions
- Unlimited approval levels
- Multiple organizations (future multi-tenancy)

### Design Principles
1. **No Hardcoded Logic:** Everything configurable
2. **Location-Aware:** All operations respect location hierarchy
3. **Permission-Based:** All actions require explicit permissions
4. **Audit Everything:** Complete trail of all changes
5. **Real-Time Updates:** Configuration changes take effect immediately
6. **Efficient Queries:** Optimized for performance at scale

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-27  
**Based On:** PATH Company Real-World Requirements
