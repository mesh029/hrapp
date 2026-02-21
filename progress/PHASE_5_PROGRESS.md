# Phase 5: Leave Management - Progress Tracker

**Status:** ✅ Completed  
**Started:** 2025-01-27  
**Completed:** 2025-01-27  
**Goal:** Implement leave request system integrated with workflow engine

---

## Phase 5 Overview

**Flow:**
1. ✅ Review existing leave schema (leave_requests, leave_balances, leave_types)
2. ✅ Build leave balance service (calculation, accrual logic, balance updates)
3. ✅ Build leave request endpoints (CRUD, submit for approval)
4. ✅ Build leave balance endpoints (view, manual adjustments)
5. ✅ Integrate with workflow engine (create instance on submit, update balance on approval)
6. ✅ Implement balance calculation logic (accrual rates, max limits, used vs. available)

**Integration Points:**
- Submit creates workflow instance using location-specific template ✅
- Each approval step validates balance availability ✅
- Final approval updates leave balance and marks request approved ✅
- Approved requests ready for timesheet integration (Phase 6)

**Balance Logic:**
- Calculate based on leave type accrual rate ✅
- Enforce max balance limits per leave type ✅
- Track allocated, used, and pending days ✅
- Support manual adjustments (admin only) ✅

---

## Task Checklist

### ✅ Completed
- [x] Review existing leave schema
- [x] Build leave balance service
- [x] Build leave request endpoints (CRUD)
- [x] Build leave request submit endpoint (workflow integration)
- [x] Build leave balance endpoints
- [x] Integrate workflow engine (create instance, update on approval)
- [x] Implement balance calculation logic
- [x] Validate Phase 5 completion

---

## Implementation Log

### 2025-01-27 - Phase 5 Implementation

**Leave Balance Service (`app/lib/services/leave-balance.ts`):**
- `getOrCreateLeaveBalance()` - Get or create balance for user/leave type/year
- `getAvailableBalance()` - Calculate available (allocated - used - pending)
- `allocateLeaveDays()` - Allocate days (annual allocation, accrual)
- `addPendingDays()` - Add pending when request submitted
- `removePendingDays()` - Remove pending when declined/cancelled
- `approveLeaveDays()` - Move pending to used on approval
- `calculateAndAllocateAccrual()` - Calculate and allocate based on accrual rules
- `getUserLeaveBalances()` - Get all balances for a user in a year
- `calculateDaysBetween()` - Calculate days between dates (with weekend exclusion option)

**Leave Request Endpoints:**
- `GET /api/leave/requests` - List leave requests (with filtering)
- `POST /api/leave/requests` - Create leave request (Draft status)
- `GET /api/leave/requests/:id` - Get leave request details
- `PATCH /api/leave/requests/:id` - Update leave request (Draft/Adjusted only)
- `DELETE /api/leave/requests/:id` - Delete leave request (Draft only)
- `POST /api/leave/requests/:id/submit` - Submit for approval (creates workflow instance)

**Leave Balance Endpoints:**
- `GET /api/leave/balances` - Get leave balances (with user_id and year filters)
- `GET /api/leave/balances/user/:userId` - Get all balances for a specific user
- `POST /api/leave/balances/allocate` - Manually allocate leave days (admin only)

**Workflow Integration (`app/lib/services/leave-workflow.ts`):**
- `handleLeaveRequestApproval()` - Updates request status and moves pending to used
- `handleLeaveRequestDecline()` - Updates request status and removes pending
- `handleLeaveRequestAdjust()` - Updates request status to Adjusted (employee can edit)
- `handleLeaveRequestCancel()` - Updates request status and removes pending

**Validation:**
- Leave request validation (balance availability, max limits, overlapping requests)
- Date validation (start <= end)
- Leave type validation (active, exists)
- Balance allocation validation

**Integration Points:**
- Submit creates workflow instance with employee as creator
- Workflow approval automatically updates leave balance
- Workflow decline removes pending days
- Workflow adjust allows employee to edit and resubmit
- Workflow cancel removes pending days

---

## Notes & Decisions

- **Leave Requests:** Created by employees, go through workflow approval
- **Leave Balances:** Tracked per user, per leave type, per year
- **Workflow Integration:** Submit creates instance, approval updates balance automatically
- **Balance Calculation:** Based on accrual rules, max limits, used vs. available
- **Manager Integration:** Employee's manager can be included in approvers (optional)
- **Status Flow:** Draft → Submitted → UnderReview → Approved/Declined/Adjusted/Cancelled
- **Pending Days:** Added on submit, moved to used on approval, removed on decline/cancel

---

## Validation Checklist

- [x] Can create/modify/delete leave requests
- [x] Submit creates workflow instance correctly
- [x] Balance calculations accurate (allocated, used, pending, available)
- [x] Balance updates on approval (pending → used)
- [x] Balance updates on decline (pending removed)
- [x] Integration with workflow engine works
- [x] Leave validation service works correctly
- [x] Manual balance allocation works (admin only)

---

## Next Steps After Phase 5

Phase 6: Timesheet Management
- Build timesheet period management
- Build timesheet endpoints
- Integrate approved leaves into timesheets
- PDF generation
