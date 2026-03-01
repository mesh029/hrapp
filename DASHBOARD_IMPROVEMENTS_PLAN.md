# Dashboard Improvements - Implementation Plan

## Overview
Enhance dashboard analytics to be more dynamic, realistic, and comprehensive with proper population-level metrics, improved leave/timesheet analytics, and admin-controlled access.

---

## Phase 1: Data Setup & Seeding
**Goal:** Set up realistic test data for dashboard analytics

### 1.1 Contract Assignment
- Assign contract dates to existing users:
  - **Some employees (30-40%):** 3-month contracts expiring end of March (from Jan)
  - **Rest (60-70%):** Regular/permanent employment (no end date or far future)
- Only employees who appear in analytics (have leave/timesheet activity)

### 1.2 Leave Balance Assignment
- Assign leave balances based on accrual:
  - **Formula:** 1.75 * months_worked (for users who have exhausted 2 months)
  - Make accrual rate (1.75) configurable from admin panel
  - Track: allocated, used, pending, available
  - Update balances dynamically as leaves are approved

### 1.3 Admin Configuration
- Create admin panel setting for leave accrual rate
- Store in database/config table
- Default: 1.75 days per month

---

## Phase 2: Enhanced Leave Analytics
**Goal:** Show dynamic, month-based leave metrics

### 2.1 Current Month Metrics
- **Leaves Submitted This Month:** Count and days
- **Leaves Pending Approval:** Count and days (UnderReview + Draft)
- **Leaves Approved This Month:** Count and days
- **Leaves Declined This Month:** Count and days
- **Percentage Calculations:** 
  - Approval rate: (Approved / Submitted) * 100
  - Pending rate: (Pending / Submitted) * 100
  - Decline rate: (Declined / Submitted) * 100

### 2.2 Dynamic Updates
- Real-time updates as leaves are approved/declined
- Filter by location (if location filter is active)
- Show trends (comparison with previous month)

### 2.3 Visual Improvements
- Progress bars with percentages
- Color coding (green=approved, amber=pending, red=declined)
- Month selector (current month default)

---

## Phase 3: Enhanced Timesheet Analytics
**Goal:** Show dynamic, month-based timesheet metrics

### 3.1 Current Month Metrics
- **Timesheets Submitted This Month:** Count
- **Timesheets Pending Approval:** Count (UnderReview + Draft)
- **Timesheets Approved This Month:** Count
- **Timesheets Declined This Month:** Count
- **Percentage Calculations:**
  - Approval rate: (Approved / Submitted) * 100
  - Pending rate: (Pending / Submitted) * 100
  - Decline rate: (Declined / Submitted) * 100

### 3.2 Dynamic Updates
- Real-time updates as timesheets are approved/declined
- Filter by location (if location filter is active)
- Show trends (comparison with previous month)

### 3.3 Visual Improvements
- Progress bars with percentages
- Color coding (green=approved, amber=pending, red=declined)
- Month selector (current month default)

---

## Phase 4: Contract & Balance Health (Population-Level)
**Goal:** Show realistic, dynamic population metrics

### 4.1 Contract Health
- **Total Employees with Contracts:** Count
- **Contracts Expiring in 30 Days:** Count (with list)
- **Expired Contracts:** Count (with list)
- **Active Contracts:** Count
- **Percentage Breakdown:**
  - % Expiring soon
  - % Expired
  - % Active

### 4.2 Balance Health (Population-Level)
- **Total Allocated Leave Days:** Sum across all employees
- **Total Used Leave Days:** Sum across all employees
- **Total Pending Leave Days:** Sum across all employees
- **Total Available Leave Days:** Sum across all employees
- **Utilization Rate:** (Used / Allocated) * 100
- **Average Leave Days per Employee:** (Allocated / Employee Count)
- **Employees with Low Balance:** Count (< 5 days available)

### 4.3 Dynamic Updates
- Update as contracts expire
- Update as leave balances change
- Filter by location (if location filter is active)

---

## Phase 5: Location Filter Testing & Fixes
**Goal:** Ensure location filter works correctly across all dashboard components

### 5.1 Testing
- Test location filter on:
  - Leave Analytics
  - Timesheet Analytics
  - Contract Health
  - Balance Health
  - All stat cards

### 5.2 Fixes
- Ensure all API calls respect location filter
- Update backend services to filter by location
- Test with different user permissions

---

## Phase 6: Admin Access Control
**Goal:** Allow admin to control dashboard access and component visibility

### 6.1 Dashboard Access Control
- Admin can authorize which users can see dashboard:
  - HR Managers
  - HR Assistants
  - Other roles (configurable)
- Store in component visibility settings

### 6.2 Component-Level Access Control
- Admin can control visibility of:
  - Leave Analytics card
  - Timesheet Analytics card
  - Contract & Balance Health card
  - Individual stat cards
- Use existing component visibility system

### 6.3 User Management Permissions
- Admin can control who can:
  - Add employees
  - Manage employees
  - Delete users
  - Update users
- Integrate with existing permission system

---

## Phase 7: Accurate Reports
**Goal:** Ensure all reports are accurate and reflect current data

### 7.1 Data Accuracy
- Verify all calculations are correct
- Ensure real-time updates work
- Test edge cases (no data, single user, etc.)

### 7.2 Report Generation
- Ensure location filter applies to reports
- Test report export functionality
- Verify data consistency

---

## Implementation Order

1. **Phase 1:** Data Setup & Seeding (Foundation)
2. **Phase 2:** Enhanced Leave Analytics (High Priority)
3. **Phase 3:** Enhanced Timesheet Analytics (High Priority)
4. **Phase 4:** Contract & Balance Health (High Priority)
5. **Phase 5:** Location Filter Testing & Fixes (Critical)
6. **Phase 6:** Admin Access Control (Important)
7. **Phase 7:** Accurate Reports (Verification)

---

## Files to Modify

### Backend Services
- `app/lib/services/reporting.ts` - Enhanced analytics functions
- `app/lib/services/leave-balance.ts` - Balance calculations
- `app/api/reports/dashboard/route.ts` - Dashboard API endpoint

### Frontend Components
- `app/dashboard/page.tsx` - Main dashboard page
- `ui/src/services/dashboard.ts` - Dashboard service

### Admin Panel
- `app/administration/component-visibility/page.tsx` - Access control
- New: Admin settings for accrual rate configuration

### Database
- Migration for accrual rate configuration
- Script to seed contract dates and leave balances

---

## Success Criteria

1. ✅ Leave analytics show current month metrics with percentages
2. ✅ Timesheet analytics show current month metrics with percentages
3. ✅ Contract & Balance Health show population-level metrics
4. ✅ Location filter works on all dashboard components
5. ✅ Admin can control dashboard access and component visibility
6. ✅ All metrics update dynamically as data changes
7. ✅ Reports are accurate and respect location filters
