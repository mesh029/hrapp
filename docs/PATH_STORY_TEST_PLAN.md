# Path Story Comprehensive Test Plan

## Overview
This document outlines a comprehensive test plan based on real-world PATH scenarios to validate system adaptability and identify areas for improvement.

---

## Phase Breakdown

### PHASE 1: Schema Extensions
**Objective:** Add required database fields and models

**Tasks:**
1. Add `charge_code` field to User model (editable, appears on timesheet/leave)
2. Add `staff_number` field to User model (unique identifier for tracking)
3. Create `Casual` staff type
4. Create `Laundry Worker` staff type (4-day work week)
5. Update timesheet/leave models to include charge_code display

**Deliverables:**
- Database migration
- Updated Prisma schema
- Seed data for new staff types

---

### PHASE 2: Scenario 1 - Path Story (As Is)
**Objective:** Test existing PATH story workflow

**Setup:**
- Use existing PATH story configuration
- Test standard leave request flow
- Test standard timesheet flow

**Test Cases:**
1. Create PATH employee
2. Submit leave request
3. Verify workflow progression
4. Submit timesheet
5. Verify timesheet workflow

**Expected Outcomes:**
- All workflows complete successfully
- Status updates correctly
- Notifications sent
- Audit logs created

---

### PHASE 3: Scenario 2 - 5-Step Leave Approval
**Objective:** Test multi-step leave approval with 5 different approvers

**Setup:**
- Create workflow template with 5 approval steps
- Each step requires different approver
- Test step progression through all 5 steps

**Test Cases:**
1. Create 5-step leave approval workflow
2. Assign different approvers to each step
3. Submit leave request
4. Approve step 1 → verify step 2 assignment
5. Approve step 2 → verify step 3 assignment
6. Approve step 3 → verify step 4 assignment
7. Approve step 4 → verify step 5 assignment
8. Approve step 5 → verify final approval
9. Verify leave request status updated

**Expected Outcomes:**
- All 5 steps progress correctly
- Each approver receives notification
- Final approval updates leave request
- Audit trail complete

---

### PHASE 4: Scenario 3 - Casual Employee
**Objective:** Test casual employee with weekend work

**Setup:**
- Create "Casual" staff type
- Create Maureen (HR Assistant) with leave approval rights
- Create casual employee reporting to Maureen
- Configure weekend work hours

**Test Cases:**
1. Create Casual staff type
2. Create Maureen (HR Assistant) with leave.approve permission
3. Create casual employee with:
   - Staff type: Casual
   - Manager: Maureen
   - Charge code: [assigned]
   - Staff number: [assigned]
4. Create leave request → verify Maureen is approver
5. Submit leave request → verify workflow
6. Create timesheet for period
7. Add random weekend work entries (weekend extra hours)
8. Submit timesheet → verify workflow
9. Verify charge code appears on timesheet
10. Verify staff number appears on timesheet

**Expected Outcomes:**
- Casual employee can create leave requests
- Maureen receives approval notifications
- Weekend work hours tracked correctly
- Charge code and staff number visible on timesheet
- All workflows complete successfully

---

### PHASE 5: Scenario 4 - Laundry Worker (4-Day Week)
**Objective:** Test laundry worker with 4-day work week and finance rejection

**Setup:**
- Create "Laundry Worker" staff type (4-day work week)
- Create 4-step timesheet approval workflow
- Create Finance Manager role with timesheet.approve permission
- Configure charge code validation

**Test Cases:**
1. Create Laundry Worker staff type (4-day work week)
2. Create 4-step timesheet approval workflow:
   - Step 1: Supervisor approval
   - Step 2: Department Manager approval
   - Step 3: Finance Manager approval (can reject for wrong charge code)
   - Step 4: HR Manager final approval
3. Create laundry worker employee:
   - Staff type: Laundry Worker
   - Charge code: [assigned]
   - Staff number: [assigned]
   - Work schedule: 4 days/week
4. Create timesheet with:
   - 4 days of work hours
   - Charge code visible
   - Staff number visible
5. Submit timesheet → verify workflow starts
6. Approve step 1 (Supervisor)
7. Approve step 2 (Department Manager)
8. **Reject at step 3 (Finance Manager)** - reason: "Wrong charge code"
9. Verify timesheet status: Rejected
10. Update charge code on employee
11. Resubmit timesheet
12. Approve all 4 steps
13. Verify final approval

**Expected Outcomes:**
- 4-day work week configured correctly
- 4-step approval workflow works
- Finance Manager can reject for wrong charge code
- Charge code update works
- Resubmission after rejection works
- Final approval completes successfully

---

### PHASE 6: Comprehensive Integration Test
**Objective:** Run all scenarios together and verify system behavior

**Test Cases:**
1. Run all 4 scenarios sequentially
2. Verify no data conflicts
3. Verify all workflows complete
4. Verify all notifications sent
5. Verify all audit logs created
6. Verify charge codes appear correctly
7. Verify staff numbers appear correctly
8. Performance test (all scenarios in parallel)

**Expected Outcomes:**
- All scenarios complete successfully
- No data integrity issues
- System performance acceptable
- All integrations working

---

### PHASE 7: Analysis & Improvements
**Objective:** Analyze test results and implement improvements

**Tasks:**
1. Review test results
2. Identify issues/bugs
3. Identify performance bottlenecks
4. Identify UX improvements
5. Document findings
6. Prioritize improvements
7. Implement critical fixes
8. Re-test after fixes

**Deliverables:**
- Test results report
- Issues list
- Improvement recommendations
- Updated code
- Re-test results

---

## Implementation Order

1. ✅ **Phase 1:** Schema Extensions
2. ✅ **Phase 2:** Scenario 1 - Path Story (As Is)
3. ✅ **Phase 3:** Scenario 2 - 5-Step Leave Approval
4. ✅ **Phase 4:** Scenario 3 - Casual Employee
5. ✅ **Phase 5:** Scenario 4 - Laundry Worker
6. ✅ **Phase 6:** Comprehensive Integration Test
7. ✅ **Phase 7:** Analysis & Improvements

---

## Success Criteria

### Phase 1 Success:
- ✅ All schema changes applied
- ✅ Migrations successful
- ✅ New staff types created
- ✅ Charge code and staff number fields added

### Phase 2 Success:
- ✅ PATH story workflow completes
- ✅ All status updates correct
- ✅ Notifications sent
- ✅ Audit logs created

### Phase 3 Success:
- ✅ 5-step workflow created
- ✅ All 5 steps progress correctly
- ✅ Each approver receives notification
- ✅ Final approval works

### Phase 4 Success:
- ✅ Casual employee created
- ✅ Maureen can approve leaves
- ✅ Weekend work tracked
- ✅ Charge code and staff number visible

### Phase 5 Success:
- ✅ Laundry worker created
- ✅ 4-day work week configured
- ✅ 4-step approval works
- ✅ Finance rejection works
- ✅ Charge code update works
- ✅ Resubmission works

### Phase 6 Success:
- ✅ All scenarios complete
- ✅ No conflicts
- ✅ Performance acceptable

### Phase 7 Success:
- ✅ All issues identified
- ✅ Critical fixes implemented
- ✅ Re-test passes

---

## Test Script Structure

```
scripts/test-path-story-comprehensive.ts
├── Phase 1: Schema Setup
├── Phase 2: Scenario 1 - Path Story
├── Phase 3: Scenario 2 - 5-Step Approval
├── Phase 4: Scenario 3 - Casual Employee
├── Phase 5: Scenario 4 - Laundry Worker
├── Phase 6: Integration Test
└── Phase 7: Results Analysis
```

---

## Documentation Deliverables

1. **Test Plan** (this document)
2. **Test Script** (`scripts/test-path-story-comprehensive.ts`)
3. **Test Results** (`docs/PATH_STORY_TEST_RESULTS.md`)
4. **Findings & Improvements** (`docs/PATH_STORY_FINDINGS.md`)
5. **Schema Changes** (migration files)

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1: Schema Extensions
3. Proceed through phases sequentially
4. Document findings at each phase
5. Implement improvements as identified

---

**Status:** 📋 Ready for Implementation  
**Created:** 2025-01-XX
