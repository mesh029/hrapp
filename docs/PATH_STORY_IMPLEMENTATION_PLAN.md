# Path Story Comprehensive Test - Implementation Plan

## Overview
This document provides a detailed, phased implementation plan for the PATH story comprehensive test scenarios.

---

## PHASE 1: Schema Extensions

### 1.1 Add User Fields
**File:** `prisma/schema.prisma`

**Changes:**
```prisma
model User {
  // ... existing fields ...
  staff_number  String?  @unique // Unique identifier for tracking employees
  charge_code   String?  // Where salary is charged to (editable)
  // ... rest of model ...
  
  @@index([staff_number])
  @@index([charge_code])
}
```

**Migration:** Create migration for new fields

### 1.2 Create New Staff Types
**File:** `prisma/seed.ts` or new migration

**Staff Types to Create:**
1. **Casual** - For casual employees
2. **Laundry Worker** - For laundry workers (4-day work week)

**Work Hours Configuration:**
- **Casual:** Standard 5-day week (can work weekends)
- **Laundry Worker:** 4-day work week (Mon-Thu or Tue-Fri)

### 1.3 Update Display Fields
**Files:** 
- `app/lib/services/timesheet.ts` - Include charge_code and staff_number in timesheet data
- `app/lib/services/leave.ts` - Include charge_code and staff_number in leave request data
- API responses - Include charge_code and staff_number

**Deliverables:**
- ✅ Migration file
- ✅ Updated Prisma schema
- ✅ Seed data for new staff types
- ✅ Updated service files

---

## PHASE 2: Scenario 1 - Path Story (As Is)

### 2.1 Setup
- Use existing PATH story configuration
- No changes needed

### 2.2 Test Cases
1. Create PATH employee (if not exists)
2. Submit leave request
3. Verify workflow progression
4. Submit timesheet
5. Verify timesheet workflow

### 2.3 Expected Results
- ✅ All workflows complete
- ✅ Status updates correctly
- ✅ Notifications sent
- ✅ Audit logs created

**Deliverables:**
- ✅ Test script section
- ✅ Test results

---

## PHASE 3: Scenario 2 - 5-Step Leave Approval

### 3.1 Create 5-Step Workflow
**Workflow Configuration:**
- **Name:** "5-Step Leave Approval"
- **Resource Type:** leave
- **Steps:**
  1. Step 1: Supervisor Approval (allow_decline: true, allow_adjust: true)
  2. Step 2: Department Manager Approval (allow_decline: true, allow_adjust: false)
  3. Step 3: HR Manager Approval (allow_decline: true, allow_adjust: false)
  4. Step 4: Finance Manager Approval (allow_decline: true, allow_adjust: false)
  5. Step 5: Director Approval (allow_decline: false, allow_adjust: false)

### 3.2 Create Approvers
- Supervisor
- Department Manager
- HR Manager
- Finance Manager
- Director

### 3.3 Test Cases
1. Create 5-step workflow template
2. Create 5 approvers with appropriate permissions
3. Create employee
4. Submit leave request
5. Approve step 1 → verify step 2 assignment
6. Approve step 2 → verify step 3 assignment
7. Approve step 3 → verify step 4 assignment
8. Approve step 4 → verify step 5 assignment
9. Approve step 5 → verify final approval
10. Verify leave request status updated

### 3.4 Expected Results
- ✅ All 5 steps progress correctly
- ✅ Each approver receives notification
- ✅ Final approval updates leave request
- ✅ Complete audit trail

**Deliverables:**
- ✅ 5-step workflow template
- ✅ Test script section
- ✅ Test results

---

## PHASE 4: Scenario 3 - Casual Employee

### 4.1 Create Casual Staff Type
**Configuration:**
- **Code:** `casual`
- **Name:** `Casual Employee`
- **Work Hours:** Standard 5-day week (Mon-Fri, 8 hours/day)
- **Weekend Work:** Allowed (weekend extra hours)

### 4.2 Create Maureen (HR Assistant)
**Configuration:**
- **Name:** Maureen
- **Role:** HR Assistant
- **Permissions:** `leave.approve`, `timesheet.approve`
- **Location:** Nairobi (or appropriate location)

### 4.3 Create Casual Employee
**Configuration:**
- **Staff Type:** Casual
- **Manager:** Maureen
- **Charge Code:** `HR-CASUAL-001` (or similar)
- **Staff Number:** `CAS-001` (or similar)
- **Location:** Same as Maureen

### 4.4 Test Cases
1. Create Casual staff type
2. Create Maureen with leave.approve permission
3. Create casual employee:
   - Staff type: Casual
   - Manager: Maureen
   - Charge code: HR-CASUAL-001
   - Staff number: CAS-001
4. Create leave request → verify Maureen is approver
5. Submit leave request → verify workflow
6. Create timesheet for period (e.g., March 2025)
7. Add random weekend work entries:
   - Select 2-3 random weekends
   - Add weekend extra hours (4-8 hours per weekend)
8. Submit timesheet → verify workflow
9. Verify charge code appears on timesheet
10. Verify staff number appears on timesheet
11. Approve timesheet through workflow

### 4.5 Expected Results
- ✅ Casual employee can create leave requests
- ✅ Maureen receives approval notifications
- ✅ Weekend work hours tracked correctly
- ✅ Charge code visible on timesheet
- ✅ Staff number visible on timesheet
- ✅ All workflows complete successfully

**Deliverables:**
- ✅ Casual staff type
- ✅ Maureen user
- ✅ Casual employee
- ✅ Test script section
- ✅ Test results

---

## PHASE 5: Scenario 4 - Laundry Worker (4-Day Week)

### 5.1 Create Laundry Worker Staff Type
**Configuration:**
- **Code:** `laundry_worker`
- **Name:** `Laundry Worker`
- **Work Hours:** 4-day work week
  - Option 1: Mon-Thu (4 days × 8 hours = 32 hours/week)
  - Option 2: Tue-Fri (4 days × 8 hours = 32 hours/week)

### 5.2 Create 4-Step Timesheet Approval Workflow
**Workflow Configuration:**
- **Name:** "4-Step Timesheet Approval"
- **Resource Type:** timesheet
- **Steps:**
  1. Step 1: Supervisor Approval (allow_decline: true, allow_adjust: true)
  2. Step 2: Department Manager Approval (allow_decline: true, allow_adjust: false)
  3. Step 3: Finance Manager Approval (allow_decline: true, allow_adjust: true) - **Can reject for wrong charge code**
  4. Step 4: HR Manager Final Approval (allow_decline: false, allow_adjust: false)

### 5.3 Create Approvers
- Supervisor
- Department Manager
- Finance Manager (with charge code validation logic)
- HR Manager

### 5.4 Create Laundry Worker Employee
**Configuration:**
- **Staff Type:** Laundry Worker
- **Charge Code:** `FAC-LAUNDRY-001` (or similar)
- **Staff Number:** `LW-001` (or similar)
- **Work Schedule:** 4 days/week (Mon-Thu)

### 5.5 Test Cases
1. Create Laundry Worker staff type (4-day work week)
2. Create 4-step timesheet approval workflow
3. Create approvers (Supervisor, Dept Manager, Finance Manager, HR Manager)
4. Create laundry worker employee:
   - Staff type: Laundry Worker
   - Charge code: FAC-LAUNDRY-001
   - Staff number: LW-001
   - Work schedule: 4 days/week
5. Create timesheet with:
   - 4 days of work hours (32 hours total)
   - Charge code visible
   - Staff number visible
6. Submit timesheet → verify workflow starts
7. Approve step 1 (Supervisor)
8. Approve step 2 (Department Manager)
9. **Reject at step 3 (Finance Manager)** - reason: "Wrong charge code"
10. Verify timesheet status: Rejected
11. Update charge code on employee (e.g., FAC-LAUNDRY-002)
12. Resubmit timesheet
13. Approve all 4 steps
14. Verify final approval

### 5.6 Expected Results
- ✅ 4-day work week configured correctly
- ✅ 4-step approval workflow works
- ✅ Finance Manager can reject for wrong charge code
- ✅ Charge code update works
- ✅ Resubmission after rejection works
- ✅ Final approval completes successfully

**Deliverables:**
- ✅ Laundry Worker staff type
- ✅ 4-step workflow template
- ✅ Laundry worker employee
- ✅ Test script section
- ✅ Test results

---

## PHASE 6: Comprehensive Integration Test

### 6.1 Run All Scenarios
Execute all 4 scenarios sequentially:
1. Scenario 1: Path Story (As Is)
2. Scenario 2: 5-Step Leave Approval
3. Scenario 3: Casual Employee
4. Scenario 4: Laundry Worker

### 6.2 Verification Points
- ✅ No data conflicts
- ✅ All workflows complete
- ✅ All notifications sent
- ✅ All audit logs created
- ✅ Charge codes appear correctly
- ✅ Staff numbers appear correctly
- ✅ Performance acceptable

### 6.3 Test Cases
1. Run all scenarios sequentially
2. Verify no data conflicts
3. Verify all workflows complete
4. Verify all notifications sent
5. Verify all audit logs created
6. Verify charge codes appear correctly
7. Verify staff numbers appear correctly
8. Performance test (all scenarios in parallel)

**Deliverables:**
- ✅ Integration test script
- ✅ Test results
- ✅ Performance metrics

---

## PHASE 7: Analysis & Improvements

### 7.1 Review Test Results
- Analyze all test outputs
- Identify issues/bugs
- Identify performance bottlenecks
- Identify UX improvements

### 7.2 Document Findings
- Create findings document
- Prioritize issues
- Document improvement recommendations

### 7.3 Implement Improvements
- Fix critical bugs
- Optimize performance
- Improve UX
- Re-test after fixes

**Deliverables:**
- ✅ Test results report
- ✅ Issues list
- ✅ Improvement recommendations
- ✅ Updated code
- ✅ Re-test results

---

## Implementation Checklist

### Phase 1: Schema Extensions
- [ ] Add `staff_number` field to User model
- [ ] Add `charge_code` field to User model
- [ ] Create migration
- [ ] Create Casual staff type
- [ ] Create Laundry Worker staff type (4-day week)
- [ ] Update timesheet service to include charge_code/staff_number
- [ ] Update leave service to include charge_code/staff_number
- [ ] Update API responses

### Phase 2: Scenario 1
- [ ] Create test script section
- [ ] Run tests
- [ ] Document results

### Phase 3: Scenario 2
- [ ] Create 5-step workflow template
- [ ] Create 5 approvers
- [ ] Create test script section
- [ ] Run tests
- [ ] Document results

### Phase 4: Scenario 3
- [ ] Create Casual staff type
- [ ] Create Maureen (HR Assistant)
- [ ] Create casual employee
- [ ] Create test script section
- [ ] Run tests
- [ ] Document results

### Phase 5: Scenario 4
- [ ] Create Laundry Worker staff type
- [ ] Create 4-step workflow
- [ ] Create approvers
- [ ] Create laundry worker employee
- [ ] Create test script section
- [ ] Run tests
- [ ] Document results

### Phase 6: Integration Test
- [ ] Create integration test script
- [ ] Run all scenarios
- [ ] Verify all results
- [ ] Document findings

### Phase 7: Analysis
- [ ] Review all results
- [ ] Document findings
- [ ] Implement improvements
- [ ] Re-test

---

## Test Script Structure

```
scripts/test-path-story-comprehensive.ts
├── Phase 1: Schema Setup & Validation
├── Phase 2: Scenario 1 - Path Story (As Is)
├── Phase 3: Scenario 2 - 5-Step Leave Approval
├── Phase 4: Scenario 3 - Casual Employee
├── Phase 5: Scenario 4 - Laundry Worker
├── Phase 6: Integration Test
└── Phase 7: Results Analysis
```

---

## Success Criteria

### Overall Success:
- ✅ All 4 scenarios complete successfully
- ✅ All workflows function correctly
- ✅ Charge codes and staff numbers visible
- ✅ No data integrity issues
- ✅ Performance acceptable
- ✅ All improvements implemented

---

## Next Steps

1. ✅ Review and approve this plan
2. ⏭️ Begin Phase 1: Schema Extensions
3. ⏭️ Proceed through phases sequentially
4. ⏭️ Document findings at each phase
5. ⏭️ Implement improvements as identified

---

**Status:** 📋 Ready for Implementation  
**Created:** 2025-01-XX
