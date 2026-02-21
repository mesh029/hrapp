# Timesheet Test Scenarios

## Overview
This document outlines test scenarios for the timesheet system, focusing on HRH employees in February 2025.

## Test Setup

### Employee Details
- **Type:** HRH (Human Resources for Health)
- **Work Hours:** Monday-Friday: 8 hours/day, Weekends: 0 hours
- **Location:** Nairobi Office
- **Month:** February 2025 (28 days)

### February 2025 Calendar
- **Total Days:** 28
- **Weekdays:** 20 days (Mon-Fri)
- **Weekends:** 8 days (Sat-Sun)
- **Expected Work Hours:** 20 days × 8 hours = 160 hours

---

## Scenario 1: HRH Employee with Sick Leave, Holidays, and Vacation

### Details
- **Sick Leave:** 3 working days (approved)
  - Dates: February 5, 6, 7 (Wed, Thu, Fri)
  - Hours: 3 days × 8 hours = 24 hours
- **Holidays:** 2 holidays (company approved)
  - Date 1: February 10 (Monday) - "Company Holiday 1"
  - Date 2: February 14 (Friday) - "Valentine's Day"
  - Hours: 2 days × 8 hours = 16 hours
- **Vacation Leave:** 2 working days (approved)
  - Dates: February 18, 19 (Tue, Wed)
  - Hours: 2 days × 8 hours = 16 hours

### Expected Timesheet Entries

| Date | Day | Work | Leave | Holiday | Weekend Extra | Overtime | Total | Expected |
|------|-----|------|-------|--------|---------------|----------|-------|----------|
| Feb 1 | Sat | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 2 | Sun | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 3 | Mon | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 4 | Tue | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 5 | Wed | 0 | 8 | 0 | 0 | 0 | 8 | 8 (Sick) |
| Feb 6 | Thu | 0 | 8 | 0 | 0 | 0 | 8 | 8 (Sick) |
| Feb 7 | Fri | 0 | 8 | 0 | 0 | 0 | 8 | 8 (Sick) |
| Feb 8 | Sat | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 9 | Sun | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 10 | Mon | 0 | 0 | 8 | 0 | 0 | 8 | 8 (Holiday) |
| Feb 11 | Tue | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 12 | Wed | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 13 | Thu | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 14 | Fri | 0 | 0 | 8 | 0 | 0 | 8 | 8 (Holiday) |
| Feb 15 | Sat | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 16 | Sun | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 17 | Mon | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 18 | Tue | 0 | 8 | 0 | 0 | 0 | 8 | 8 (Vacation) |
| Feb 19 | Wed | 0 | 8 | 0 | 0 | 0 | 8 | 8 (Vacation) |
| Feb 20 | Thu | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 21 | Fri | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 22 | Sat | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 23 | Sun | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Feb 24 | Mon | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 25 | Tue | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 26 | Wed | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 27 | Thu | 8 | 0 | 0 | 0 | 0 | 8 | 8 |
| Feb 28 | Fri | 8 | 0 | 0 | 0 | 0 | 8 | 8 |

### Summary
- **Work Hours:** 13 days × 8 = 104 hours
- **Leave Hours:** 5 days × 8 = 40 hours (3 sick + 2 vacation)
- **Holiday Hours:** 2 days × 8 = 16 hours
- **Total Hours:** 160 hours
- **Expected Hours:** 160 hours
- **Status:** ✅ Valid (matches expected)

---

## Scenario 2: HRH Employee with Holidays Only

### Details
- **No Leaves:** No sick leave or vacation
- **Holidays:** 2 holidays (same as Scenario 1)
  - Date 1: February 10 (Monday)
  - Date 2: February 14 (Friday)

### Expected Timesheet Entries

| Date | Day | Work | Leave | Holiday | Weekend Extra | Overtime | Total | Expected |
|------|-----|------|-------|--------|---------------|----------|-------|----------|
| Feb 1 | Sat | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Feb 10 | Mon | 0 | 0 | 8 | 0 | 0 | 8 | 8 (Holiday) |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Feb 14 | Fri | 0 | 0 | 8 | 0 | 0 | 8 | 8 (Holiday) |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

### Summary
- **Work Hours:** 18 days × 8 = 144 hours
- **Leave Hours:** 0 hours
- **Holiday Hours:** 2 days × 8 = 16 hours
- **Total Hours:** 160 hours
- **Expected Hours:** 160 hours
- **Status:** ✅ Valid (matches expected)

---

## Scenario 3: HRH Employee with Weekend Extra and Overtime

### Details
- **No Leaves:** No sick leave, vacation, or holidays
- **Weekend Extra:** 6 hours on February 8 (Saturday) - **Requires Approval**
- **Overtime:** 2 hours on February 12 (Wednesday) - **Requires Approval**

### Expected Timesheet Entries

| Date | Day | Work | Leave | Holiday | Weekend Extra | Overtime | Total | Expected |
|------|-----|------|-------|--------|---------------|----------|-------|----------|
| Feb 1 | Sat | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Feb 8 | Sat | 0 | 0 | 0 | 6 | 0 | 6 | 0 (Weekend) |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Feb 12 | Wed | 8 | 0 | 0 | 0 | 2 | 10 | 8 (Overtime) |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

### Summary
- **Work Hours:** 20 days × 8 = 160 hours
- **Leave Hours:** 0 hours
- **Holiday Hours:** 0 hours
- **Weekend Extra Hours:** 6 hours (approved)
- **Overtime Hours:** 2 hours (approved)
- **Total Hours:** 168 hours
- **Expected Hours:** 160 hours
- **Status:** ✅ Valid (excess is from approved extras)

---

## Test Steps

### For Each Scenario:

1. **Setup:**
   - Create HRH employee
   - Create timesheet for February 2025
   - Create/approve leaves (if applicable)
   - Create holidays (if applicable)
   - Request/approve weekend extra (if applicable)
   - Request/approve overtime (if applicable)

2. **Verify:**
   - All days have entries
   - Auto-populated leaves are correct
   - Auto-populated holidays are correct
   - Work hours can be entered
   - Weekend extra/overtime require approval
   - Total hours calculation is correct
   - Validation passes

3. **Submit:**
   - Validate timesheet
   - Submit for approval
   - Verify workflow instance created

## Notes
- All leave hours and holiday hours are read-only (system-managed)
- Weekend extra and overtime require manager/approver approval
- Validation should pass if total = expected OR excess is from approved extras
- Timesheet should auto-populate leaves and holidays on creation
