# API Capabilities Assessment

**Date:** February 22, 2025  
**Purpose:** Comprehensive assessment of all API capabilities to inform UI design

## Executive Summary

The HR App API is a **robust, enterprise-grade system** with **83+ endpoints** covering:
- Authentication & Authorization
- User Management (with bulk operations)
- Leave Management (requests, balances, accrual)
- Timesheet Management (with weekend/overtime)
- Workflow Engine (dynamic, multi-step approvals)
- Location & Staff Type Management
- Role & Permission Management
- Reporting & Analytics
- Audit Logging
- Notifications
- Delegations

---

## 1. Authentication & Authorization

### Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token

### Capabilities
- ✅ JWT-based authentication
- ✅ Refresh token mechanism
- ✅ Token expiration handling
- ✅ Redis-based token storage

### UI Requirements
- Login screen
- Token refresh handling
- Session management
- Logout functionality

---

## 2. User Management

### Endpoints
- `GET /api/users` - List users (with filters, pagination)
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user details
- `PATCH /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user (soft delete)
- `POST /api/users/bulk-upload` - Bulk user upload (Excel)
- `GET /api/users/bulk-upload/template` - Download Excel template
- `GET /api/users/[id]/direct-reports` - Get direct reports
- `PATCH /api/users/[id]/manager` - Update manager
- `PATCH /api/users/[id]/location` - Update location
- `GET /api/users/[id]/roles` - Get user roles
- `POST /api/users/[id]/roles` - Assign role
- `DELETE /api/users/[id]/roles/[roleId]` - Remove role
- `GET /api/users/[id]/scopes` - Get location scopes
- `POST /api/users/[id]/scopes` - Add location scope
- `DELETE /api/users/[id]/scopes/[scopeId]` - Remove scope
- `GET /api/users/[id]/contract` - Get contract details

### Capabilities
- ✅ Full CRUD operations
- ✅ Bulk user creation via Excel
- ✅ Manager hierarchy management
- ✅ Location assignment
- ✅ Role assignment (multiple roles per user)
- ✅ Location scope management (multi-location access)
- ✅ Direct reports tracking
- ✅ Contract management
- ✅ Soft delete (deleted_at)
- ✅ User status management (active, suspended, deactivated)
- ✅ Staff number and charge code tracking

### UI Requirements
- User list view (with filters, search, pagination)
- User detail view
- User create/edit form
- Bulk user upload interface
- Excel template download
- Manager assignment interface
- Role assignment interface
- Location scope management
- Direct reports view
- Contract management

---

## 3. Leave Management

### Endpoints

#### Leave Requests
- `GET /api/leave/requests` - List leave requests (with filters)
- `POST /api/leave/requests` - Create leave request
- `GET /api/leave/requests/[id]` - Get leave request details
- `PATCH /api/leave/requests/[id]` - Update leave request
- `DELETE /api/leave/requests/[id]` - Delete leave request
- `POST /api/leave/requests/[id]/submit` - Submit for approval

#### Leave Types
- `GET /api/leave/types` - List leave types
- `POST /api/leave/types` - Create leave type
- `GET /api/leave/types/[id]` - Get leave type
- `PATCH /api/leave/types/[id]` - Update leave type
- `DELETE /api/leave/types/[id]` - Delete leave type

#### Leave Balances
- `GET /api/leave/balances` - List leave balances (with filters)
- `GET /api/leave/balances/user/[userId]` - Get user's leave balances
- `POST /api/leave/balances/allocate` - Allocate leave days
- `POST /api/leave/balances/adjust` - Adjust leave balance
- `POST /api/leave/balances/reset` - Reset leave balance

#### Leave Accrual
- `GET /api/leave/accrual/configs` - List accrual configurations
- `POST /api/leave/accrual/configs` - Create accrual config
- `GET /api/leave/accrual/configs/[id]` - Get accrual config
- `PATCH /api/leave/accrual/configs/[id]` - Update accrual config
- `DELETE /api/leave/accrual/configs/[id]` - Delete accrual config

### Capabilities
- ✅ Leave request lifecycle (Draft → Submitted → UnderReview → Approved/Declined)
- ✅ Leave balance tracking (allocated, used, pending)
- ✅ Leave type management (paid/unpaid, max days, accrual rules)
- ✅ Leave accrual configuration
- ✅ Balance allocation and adjustment
- ✅ Balance reset functionality
- ✅ Overlapping request detection
- ✅ Balance validation before submission

### UI Requirements
- Leave request list (with status filters)
- Leave request create/edit form
- Leave request detail view (with workflow status)
- Leave balance dashboard
- Leave balance allocation interface
- Leave balance adjustment interface
- Leave type management
- Leave accrual configuration
- Leave calendar view (overlapping detection)
- Leave balance summary per user

---

## 4. Timesheet Management

### Endpoints

#### Timesheets
- `GET /api/timesheets` - List timesheets (with filters)
- `POST /api/timesheets` - Create timesheet (auto-creates entries)
- `GET /api/timesheets/[id]` - Get timesheet details
- `PATCH /api/timesheets/[id]` - Update timesheet
- `DELETE /api/timesheets/[id]` - Delete timesheet
- `POST /api/timesheets/[id]/submit` - Submit for approval
- `POST /api/timesheets/[id]/validate` - Validate timesheet

#### Timesheet Entries
- `GET /api/timesheets/[id]/entries` - Get timesheet entries
- `PATCH /api/timesheets/[id]/entries` - Update entries (bulk)

#### Weekend Extra & Overtime
- `POST /api/timesheets/[id]/weekend-extra` - Request weekend extra hours
- `GET /api/timesheets/weekend-extra/[requestId]` - Get weekend extra request
- `POST /api/timesheets/weekend-extra/[requestId]/approve` - Approve weekend extra
- `POST /api/timesheets/weekend-extra/[requestId]/decline` - Decline weekend extra
- `POST /api/timesheets/overtime` - Request overtime
- `GET /api/timesheets/overtime/[requestId]` - Get overtime request
- `POST /api/timesheets/overtime/[requestId]/approve` - Approve overtime
- `POST /api/timesheets/overtime/[requestId]/decline` - Decline overtime

#### Timesheet Periods
- `POST /api/timesheets/periods/enable` - Enable timesheet period

### Capabilities
- ✅ Timesheet creation with auto-entry generation
- ✅ Period-based timesheets (weekly, bi-weekly, monthly)
- ✅ Entry-level hour tracking (work, leave, holiday, weekend extra, overtime)
- ✅ Timesheet validation (work hours, leave balance, etc.)
- ✅ Weekend extra hour requests
- ✅ Overtime requests
- ✅ Approval workflow integration
- ✅ Status tracking (Draft, Submitted, UnderReview, Approved, Declined, Locked)
- ✅ Charge code integration
- ✅ Staff type-based work hour configuration

### UI Requirements
- Timesheet list view (with period filters)
- Timesheet create form (period selection)
- Timesheet detail view (with entries grid)
- Timesheet entry editor (bulk edit)
- Timesheet validation display
- Weekend extra request form
- Overtime request form
- Weekend extra/overtime approval interface
- Timesheet period management
- Timesheet calendar view

---

## 5. Workflow Engine

### Endpoints

#### Workflow Templates
- `GET /api/workflows/templates` - List workflow templates
- `POST /api/workflows/templates` - Create workflow template
- `GET /api/workflows/templates/[id]` - Get template details
- `PATCH /api/workflows/templates/[id]` - Update template
- `DELETE /api/workflows/templates/[id]` - Delete template
- `GET /api/workflows/templates/[id]/steps` - Get template steps
- `POST /api/workflows/templates/[id]/steps` - Add step
- `PATCH /api/workflows/templates/[id]/steps/[stepId]` - Update step
- `DELETE /api/workflows/templates/[id]/steps/[stepId]` - Delete step

#### Workflow Instances
- `GET /api/workflows/instances` - List workflow instances (with filters)
- `GET /api/workflows/instances/[id]` - Get instance details
- `POST /api/workflows/instances/[id]/submit` - Submit workflow
- `POST /api/workflows/instances/[id]/approve` - Approve step
- `POST /api/workflows/instances/[id]/decline` - Decline step
- `POST /api/workflows/instances/[id]/adjust` - Adjust (route back)
- `POST /api/workflows/instances/[id]/cancel` - Cancel workflow

### Capabilities
- ✅ **Dynamic workflow templates** (no hardcoded sequences)
- ✅ **Multi-step workflows** (3, 4, 5, 7+ steps tested)
- ✅ **Step-level permissions** (different permission per step)
- ✅ **Step-level controls** (allow_decline, allow_adjust)
- ✅ **Dynamic approver resolution** (based on permissions, roles, location)
- ✅ **Workflow routing** (route back to any step or to employee)
- ✅ **Workflow states** (Draft, Submitted, UnderReview, Approved, Declined, Adjusted, Cancelled)
- ✅ **Digital signatures** (JWT-based with timestamps, IP, user agent)
- ✅ **Resource types** (leave, timesheet)
- ✅ **Location-specific workflows**
- ✅ **Version isolation** (template changes don't affect running instances)
- ✅ **Approver cycling** (when steps > approvers)

### UI Requirements
- Workflow template list
- Workflow template builder (drag-and-drop steps)
- Workflow template editor
- Step configuration interface
- Workflow instance list (pending approvals)
- Workflow approval interface (with comments)
- Workflow decline interface (with reasons)
- Workflow adjust interface (with routing options)
- Workflow status visualization (progress indicator)
- Workflow history/audit trail
- Digital signature display
- Pending approvals dashboard

---

## 6. Location Management

### Endpoints
- `GET /api/locations` - List locations (tree or flat)
- `POST /api/locations` - Create location
- `GET /api/locations/[id]` - Get location details
- `PATCH /api/locations/[id]` - Update location
- `DELETE /api/locations/[id]` - Delete location
- `GET /api/locations/[id]/ancestors` - Get ancestor locations
- `GET /api/locations/[id]/descendants` - Get descendant locations
- `POST /api/locations/[id]/move` - Move location in hierarchy

### Capabilities
- ✅ Hierarchical location structure (parent-child)
- ✅ Tree view support
- ✅ Path-based organization
- ✅ Level tracking
- ✅ Ancestor/descendant queries
- ✅ Location movement in hierarchy
- ✅ Status management (active/inactive)
- ✅ User count tracking

### UI Requirements
- Location tree view
- Location list view
- Location create/edit form
- Location hierarchy visualization
- Location move interface
- Location detail view

---

## 7. Staff Type Management

### Endpoints
- `GET /api/staff-types` - List staff types
- `POST /api/staff-types` - Create staff type
- `GET /api/staff-types/[id]` - Get staff type
- `PATCH /api/staff-types/[id]` - Update staff type
- `DELETE /api/staff-types/[id]` - Delete staff type

### Capabilities
- ✅ Staff type CRUD
- ✅ Work hours configuration per staff type
- ✅ Status management
- ✅ Metadata support

### UI Requirements
- Staff type list
- Staff type create/edit form
- Staff type detail view

---

## 8. Work Hours Configuration

### Endpoints
- `GET /api/config/work-hours` - List work hour configs
- `POST /api/config/work-hours` - Create work hour config
- `GET /api/config/work-hours/[id]` - Get config
- `PATCH /api/config/work-hours/[id]` - Update config
- `DELETE /api/config/work-hours/[id]` - Delete config
- `GET /api/config/work-hours/by-location/[locationId]` - Get by location
- `GET /api/config/work-hours/by-staff-type/[staffTypeId]` - Get by staff type

### Capabilities
- ✅ Day-of-week configuration (Monday-Sunday)
- ✅ Location-specific work hours
- ✅ Staff type-specific work hours
- ✅ Expected hours per day
- ✅ Weekend work configuration

### UI Requirements
- Work hours configuration list
- Work hours configuration form (weekly grid)
- Location-based work hours view
- Staff type-based work hours view

---

## 9. Holiday Management

### Endpoints
- `GET /api/holidays` - List holidays (with filters)
- `POST /api/holidays` - Create holiday
- `GET /api/holidays/[id]` - Get holiday
- `PATCH /api/holidays/[id]` - Update holiday
- `DELETE /api/holidays/[id]` - Delete holiday

### Capabilities
- ✅ Holiday CRUD
- ✅ Date-based filtering
- ✅ Location-specific holidays
- ✅ Recurring holiday support

### UI Requirements
- Holiday list (calendar view)
- Holiday create/edit form
- Holiday calendar integration

---

## 10. Role & Permission Management

### Endpoints

#### Roles
- `GET /api/roles` - List roles
- `POST /api/roles` - Create role
- `GET /api/roles/[id]` - Get role
- `PATCH /api/roles/[id]` - Update role
- `DELETE /api/roles/[id]` - Delete role
- `GET /api/roles/[id]/permissions` - Get role permissions
- `POST /api/roles/[id]/permissions` - Assign permission
- `DELETE /api/roles/[id]/permissions/[permissionId]` - Remove permission

#### Permissions
- `GET /api/permissions` - List permissions (read-only)
- `GET /api/permissions/[id]` - Get permission

### Capabilities
- ✅ Role CRUD
- ✅ Permission assignment to roles
- ✅ Permission module organization
- ✅ Status management (active/inactive)
- ✅ System admin bypass

### UI Requirements
- Role list
- Role create/edit form
- Role permission assignment interface
- Permission list (read-only)
- Permission module organization

---

## 11. Delegation Management

### Endpoints
- `GET /api/delegations` - List delegations (with filters)
- `POST /api/delegations` - Create delegation
- `GET /api/delegations/[id]` - Get delegation
- `PATCH /api/delegations/[id]` - Update delegation
- `DELETE /api/delegations/[id]` - Delete delegation
- `POST /api/delegations/[id]/revoke` - Revoke delegation

### Capabilities
- ✅ Permission delegation
- ✅ Location-based delegation
- ✅ Descendant location inclusion
- ✅ Date range delegation
- ✅ Status management (active, revoked, expired)
- ✅ Automatic expiration

### UI Requirements
- Delegation list
- Delegation create/edit form
- Delegation detail view
- Active delegations dashboard

---

## 12. Reporting & Analytics

### Endpoints
- `GET /api/reports/dashboard` - Dashboard data
- `GET /api/reports/approvals/pending` - Pending approvals
- `GET /api/reports/leave/balances` - Leave balance summary
- `GET /api/reports/leave/utilization` - Leave utilization
- `GET /api/reports/timesheets/summary` - Timesheet summary
- `GET /api/reports/export/[type]` - Export reports (Excel, PDF)

### Capabilities
- ✅ Dashboard metrics
- ✅ Pending approvals summary
- ✅ Leave balance aggregation
- ✅ Leave utilization analysis
- ✅ Timesheet summary statistics
- ✅ Report export (Excel, PDF)
- ✅ Date range filtering
- ✅ Location filtering
- ✅ User filtering

### UI Requirements
- Dashboard (metrics, charts)
- Pending approvals widget
- Leave balance report
- Leave utilization report
- Timesheet summary report
- Report export interface
- Date range picker
- Filter interface

---

## 13. Notifications

### Endpoints
- `GET /api/notifications` - List notifications (with filters)
- `GET /api/notifications/[id]` - Get notification
- `PATCH /api/notifications/[id]` - Mark as read

### Capabilities
- ✅ Notification types (approval_request, approval_complete, leave_status, timesheet_status)
- ✅ Read/unread status
- ✅ User-specific notifications
- ✅ Notification filtering

### UI Requirements
- Notification center
- Notification list
- Notification badge (unread count)
- Real-time notification updates

---

## 14. Audit Logging

### Endpoints
- `GET /api/audit-logs` - List audit logs (with filters)
- `GET /api/audit-logs/[id]` - Get audit log details

### Capabilities
- ✅ Comprehensive audit trail
- ✅ Action tracking (create, update, delete, approve, decline)
- ✅ User tracking
- ✅ Resource tracking
- ✅ Timestamp tracking
- ✅ IP address tracking
- ✅ Filtering and search

### UI Requirements
- Audit log list (with filters)
- Audit log detail view
- Audit log search
- Audit log export

---

## 15. System Health

### Endpoints
- `GET /api/health` - Health check

### Capabilities
- ✅ System status
- ✅ Database connectivity
- ✅ Timestamp

### UI Requirements
- Health status indicator
- System status page

---

## Key System Features

### 1. Permission System
- **Location-based permissions** - Permissions scoped to locations
- **Role-based access control** - Users have roles, roles have permissions
- **System admin bypass** - System admins have all permissions
- **Delegation support** - Temporary permission delegation

### 2. Workflow System
- **Fully dynamic** - No hardcoded workflows
- **Multi-step support** - Tested up to 7 steps
- **Flexible routing** - Route back to any step
- **Digital signatures** - JWT-based with metadata
- **Resource-agnostic** - Works for leave and timesheets

### 3. Data Management
- **Soft deletes** - All deletes are soft (deleted_at)
- **Audit trails** - Comprehensive logging
- **Bulk operations** - Excel upload for users
- **Hierarchical data** - Locations, manager relationships

### 4. Business Logic
- **Leave balance validation** - Prevents over-allocation
- **Timesheet validation** - Work hours, leave balance checks
- **Overlapping detection** - Leave request conflicts
- **Accrual rules** - Configurable leave accrual

---

## API Response Format

All endpoints follow a consistent response format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": { ... }
}
```

### Pagination
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

---

## Authentication

All endpoints (except `/api/auth/*` and `/api/health`) require:
- **Authorization header**: `Bearer <access_token>`
- **Token refresh**: Automatic via `/api/auth/refresh`

---

## Summary Statistics

- **Total Endpoints**: 83+
- **Main Modules**: 15
- **Complexity Level**: Enterprise-grade
- **Workflow Steps Supported**: Unlimited (tested up to 7)
- **Concurrent Users**: Designed for high load
- **Data Integrity**: Comprehensive validation and constraints

---

**Last Updated:** February 22, 2025  
**API Version:** 1.0.0  
**Status:** Production Ready ✅
