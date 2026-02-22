# Phase 2: Core Screens Development Roadmap

**Date:** February 22, 2025  
**Status:** In Progress

---

## Overview

This document outlines the phased approach to building all core screens for the HR Management System.

---

## Phase 2.1: Complete User Management ✅ (COMPLETE)

### Goals
- Create User Form
- Edit User Form  
- User Detail View
- Bulk Upload Modal
- User Roles & Permissions Assignment
- Role-Based UI System

### Status
- ✅ Users List Page
- ✅ Create User Form
- ✅ Edit User Form
- ✅ User Detail View
- ✅ Bulk Upload Modal
- ✅ Role-Based UI System (useUserRole hook, filtered navigation, role-based dashboard)
- ⏳ Roles & Permissions UI (can be added later)

---

## Phase 2.2: Leave Management

### Goals
- Leave Requests List
- Create Leave Request Form
- Leave Request Detail/Approval View
- Leave Balances View
- Leave Types Management

### Estimated Screens
1. `/leave/requests` - List all leave requests
2. `/leave/requests/new` - Create new leave request
3. `/leave/requests/[id]` - View/edit leave request
4. `/leave/balances` - View leave balances
5. `/leave/types` - Manage leave types

---

## Phase 2.3: Timesheet Management

### Goals
- Timesheets List
- Create/Edit Timesheet
- Timesheet Entry Management
- Timesheet Submission
- Overtime & Weekend Extra Requests

### Estimated Screens
1. `/timesheets` - List all timesheets
2. `/timesheets/new` - Create new timesheet
3. `/timesheets/[id]` - View/edit timesheet
4. `/timesheets/[id]/entries` - Manage entries
5. `/timesheets/[id]/submit` - Submit timesheet

---

## Phase 2.4: Workflow Management

### Goals
- Workflow Templates List
- Create/Edit Workflow Template
- Pending Approvals Dashboard
- Workflow Instance View
- Approval Actions UI

### Estimated Screens
1. `/workflows/templates` - List workflow templates
2. `/workflows/templates/new` - Create template
3. `/workflows/templates/[id]` - Edit template
4. `/workflows/approvals` - Pending approvals
5. `/workflows/instances/[id]` - View workflow instance

---

## Phase 2.5: Reports & Analytics

### Goals
- Dashboard Reports
- Leave Reports
- Timesheet Reports
- Approval Reports
- Export Functionality

### Estimated Screens
1. `/reports/dashboard` - Main reports dashboard
2. `/reports/leave` - Leave utilization reports
3. `/reports/timesheets` - Timesheet summary reports
4. `/reports/approvals` - Approval status reports

---

## Phase 2.6: Configuration

### Goals
- Locations Management
- Staff Types Management
- Work Hours Configuration
- Holidays Management

### Estimated Screens
1. `/configuration/locations` - Manage locations
2. `/configuration/staff-types` - Manage staff types
3. `/configuration/work-hours` - Configure work hours
4. `/configuration/holidays` - Manage holidays

---

## Phase 2.7: Administration

### Goals
- Roles Management
- Permissions Management
- Delegations Management
- Audit Logs View

### Estimated Screens
1. `/administration/roles` - Manage roles
2. `/administration/permissions` - Manage permissions
3. `/administration/delegations` - Manage delegations
4. `/administration/audit-logs` - View audit logs

---

## Implementation Strategy

### For Each Phase:
1. **Service Layer First** - Create/update service files
2. **List View** - Build the main listing page
3. **Create Form** - Build create functionality
4. **Detail View** - Build view/edit page
5. **Modals/Dialogs** - Build supporting UI components
6. **Testing** - Test all CRUD operations

### Common Patterns:
- Use shadcn/ui components consistently
- Follow Tangerine theme
- Mobile-first responsive design
- Auto-minimizing sidebar
- Form validation with Zod
- Error handling and loading states
- **Role-based UI rendering** - Use `useUserRole` hook to show/hide features based on user role
- **Admin vs Employee UI** - Admins see management features, employees see personal features

---

## Progress Tracking

- [x] Phase 2.1: User Management (COMPLETE)
- [ ] Phase 2.2: Leave Management (Next)
- [ ] Phase 2.3: Timesheet Management
- [ ] Phase 2.4: Workflow Management
- [ ] Phase 2.5: Reports & Analytics
- [ ] Phase 2.6: Configuration
- [ ] Phase 2.7: Administration

---

**Last Updated:** February 22, 2025
