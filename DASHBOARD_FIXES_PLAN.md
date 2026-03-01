# Dashboard & User Management Fixes - Implementation Plan

## Issues to Fix (Priority Order)

### Step 1: Role Filtering in Users Management
- Add role filter dropdown in users list page
- Filter users by selected role(s)
- Show user roles in the users table

### Step 2: Location-Based Role Access Control
- Admin can assign which locations a role can access
- Store location-role assignments (many-to-many)
- Enforce location restrictions based on role assignments
- Example: HR Assistant role can be assigned to specific locations only

### Step 3: Leave Request Creation - Better Error Handling
- Show available leave days before submission
- Display clear validation errors when creation fails
- Show specific reasons (e.g., "Insufficient balance: 5 days available, 10 days requested")
- Fix 400 Bad Request errors with proper error messages

### Step 4: Timesheet Submission - Better Error Handling
- Display clear validation errors when submission fails
- Show specific reasons for rejection
- Fix 400 Bad Request errors with proper error messages

---

## Implementation Steps

### Step 1: Role Filtering in Users Management
1. Add role filter to users list API
2. Update users list page UI to show role filter
3. Display user roles in the table
4. Test filtering functionality

### Step 2: Location-Based Role Access Control
1. Create role_location_access table (many-to-many)
2. Add admin UI to assign locations to roles
3. Update permission checks to respect location-role assignments
4. Test location-based access control

### Step 3: Leave Request Creation Fixes
1. Update leave request API to return detailed validation errors
2. Show available leave balance in create leave form
3. Display validation errors clearly in UI
4. Test leave request creation with various scenarios

### Step 4: Timesheet Submission Fixes
1. Update timesheet submission API to return detailed validation errors
2. Display validation errors clearly in UI
3. Test timesheet submission with various scenarios
