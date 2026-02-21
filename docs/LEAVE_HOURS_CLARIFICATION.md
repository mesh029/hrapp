# Leave Hours Clarification

## Key Principle: All Leave Types Share the Same Hours

**IMPORTANT:** All leave types (Sick Leave, Vacation, Emergency Leave, Maternity Leave, etc.) **share the same hours** when calculating timesheet entries. They do NOT have their own specific hours assigned.

## How Leave Hours Are Calculated

When a leave request is approved and added to a timesheet:

1. **Source of Hours:** Leave hours come from the **work hours configuration** for that specific day
2. **Calculation:** `leave_hours = expected_work_hours_for_that_day`
3. **Factors:** Expected hours are determined by:
   - Staff type (Regular, Temporary, HRH, etc.)
   - Location
   - Day of week (Monday, Tuesday, etc.)

## Example

### Scenario: HRH Employee takes Sick Leave on Wednesday

- **Work Hours Config for HRH:** Monday-Friday = 8 hours/day
- **Leave Type:** Sick Leave
- **Day:** Wednesday
- **Leave Hours in Timesheet:** 8 hours (from work hours config, NOT from leave type)

### Scenario: Same Employee takes Vacation on Friday

- **Work Hours Config for HRH:** Friday = 8 hours
- **Leave Type:** Vacation
- **Day:** Friday
- **Leave Hours in Timesheet:** 8 hours (same as sick leave - they share hours)

## Why This Design?

1. **Consistency:** All leave types represent the same thing - time away from work
2. **Simplicity:** No need to configure hours per leave type
3. **Fairness:** All leave types are treated equally in terms of hours
4. **Flexibility:** Work hours can vary by day (e.g., Friday = 6 hours), and leave hours automatically match

## Implementation

In the code:
- `app/lib/services/timesheet.ts` - Uses `getWorkHoursForDate()` to get expected hours
- All leave types use the same calculation: `leave_hours = expected_hours_from_config`
- No leave-type-specific hour configuration exists

## Leave Balance vs Leave Hours

**Leave Balance (Days):**
- Each leave type has its own balance (e.g., 10 days sick leave, 21 days vacation)
- These are tracked separately per leave type

**Leave Hours (Timesheet):**
- All leave types use the same hours per day
- Hours come from work hours config, not leave type configuration

## Summary

✅ **Leave types share hours** - All use work hours config for that day  
✅ **No leave-type-specific hours** - Sick leave and vacation use the same hours  
✅ **Hours come from work config** - Based on staff type + location + day of week  
❌ **Leave types do NOT have their own hours** - They all share the same calculation
