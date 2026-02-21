# Timesheet Design Discussion - Phase 6

## UI Requirements Analysis

Based on the sample UI provided:

### UI Structure:
- **Columns:** Days 1-31 (or last day of month) + "Total" column
- **Rows:**
  1. **"hours" row** - Daily work hours (user input for each day)
  2. **"holiday/ vacation/ leave type" row** - Leave hours (auto-populated from approved leaves)
  3. **"total" row** - Calculated totals

### Data Flow:
1. User creates timesheet for a month (e.g., February 2025)
2. System auto-populates approved leave days into "holiday/ vacation/ leave type" row
3. User fills in work hours for each day in "hours" row
4. System calculates totals
5. User submits entire month's data at once

---

## Current Schema Analysis

### Timesheet Model:
```prisma
model Timesheet {
  id                String          @id @default(uuid())
  user_id           String
  period_start      DateTime        @db.Date  // e.g., 2025-02-01
  period_end        DateTime        @db.Date  // e.g., 2025-02-28
  status            TimesheetStatus @default(Draft)
  workflow_instance_id String?
  location_id       String
  total_hours       Decimal         @db.Decimal(10, 2) @default(0)
  is_locked         Boolean         @default(false)
  entries TimesheetEntry[]
}
```

### TimesheetEntry Model (Current):
```prisma
model TimesheetEntry {
  id          String   @id @default(uuid())
  timesheet_id String
  date        DateTime @db.Date
  hours       Decimal  @db.Decimal(10, 2)
  description String?
  entry_type  String?  // "work", "leave", "holiday"
  leave_request_id String?
}
```

---

## Design Options

### Option 1: Single Entry Per Day (Combined Hours)
**Approach:** One entry per day, with separate fields for work_hours and leave_hours

**Schema Change:**
```prisma
model TimesheetEntry {
  id                String   @id @default(uuid())
  timesheet_id      String
  date              DateTime @db.Date
  work_hours        Decimal  @db.Decimal(10, 2) @default(0)  // User input
  leave_hours       Decimal  @db.Decimal(10, 2) @default(0)  // Auto from approved leaves
  total_hours       Decimal  @db.Decimal(10, 2) @default(0)  // work_hours + leave_hours
  description       String?
  leave_request_id  String?  // If leave hours > 0
  entry_type        String?  // "work", "leave", "holiday", "work_and_leave"
}
```

**Pros:**
- Simple structure
- One entry per day
- Easy to query all days in month
- Clear separation of work vs leave hours

**Cons:**
- What if multiple leave types on same day? (rare but possible)
- Less flexible for complex scenarios

---

### Option 2: Multiple Entries Per Day (Separate Work/Leave)
**Approach:** Separate entries for work and leave on the same day

**Schema (No Change Needed):**
```prisma
model TimesheetEntry {
  id                String   @id @default(uuid())
  timesheet_id      String
  date              DateTime @db.Date
  hours             Decimal  @db.Decimal(10, 2)
  description       String?
  entry_type        String   // "work", "leave", "holiday"
  leave_request_id  String?  // Required if entry_type = "leave"
}
```

**Example Data:**
- Day 1: Entry 1 (work, 8.5 hours)
- Day 7: Entry 1 (leave, 8.5 hours, leave_request_id = "123")
- Day 12: Entry 1 (leave, 6 hours, leave_request_id = "456")

**Pros:**
- More flexible (can handle multiple leave types per day)
- Clear separation of work vs leave
- Can track which specific leave request contributed hours
- Matches current schema structure

**Cons:**
- Need to aggregate entries per day for UI display
- Slightly more complex queries

---

### Option 3: Hybrid Approach (Recommended)
**Approach:** Keep current schema, but add helper fields for easier UI rendering

**Schema Enhancement:**
```prisma
model TimesheetEntry {
  id                String   @id @default(uuid())
  timesheet_id      String
  date              DateTime @db.Date
  hours             Decimal  @db.Decimal(10, 2)
  description       String?
  entry_type        String   // "work", "leave", "holiday"
  leave_request_id  String?  // Required if entry_type = "leave"
  leave_type_id     String?  // For quick reference
  is_auto_added     Boolean  @default(false) // True if auto-added from approved leave
}
```

**Data Model:**
- **Work entries:** One per day with work hours (user input)
- **Leave entries:** One per approved leave day (auto-added)
- **Holiday entries:** One per holiday (user input)

**UI Aggregation:**
- For each day, sum hours where `entry_type = 'work'` → "hours" row
- For each day, sum hours where `entry_type = 'leave'` → "holiday/ vacation/ leave type" row
- Total = sum of all entries

**Pros:**
- Flexible (handles multiple leave types per day)
- Clear audit trail (each entry linked to leave request)
- Matches current schema with minimal changes
- Easy to query and aggregate

**Cons:**
- Need aggregation logic for UI
- Multiple entries per day possible

---

## Recommended Approach: Option 3 (Hybrid)

### Implementation Plan:

1. **Timesheet Creation:**
   - User creates timesheet for a month (period_start, period_end)
   - System auto-creates entries for all days in month (work_hours = 0, entry_type = 'work')
   - System auto-adds approved leave entries (entry_type = 'leave', is_auto_added = true)

2. **UI Data Structure:**
   ```typescript
   {
     date: "2025-02-01",
     work_hours: 8.5,        // Sum of work entries
     leave_hours: 0,         // Sum of leave entries
     total_hours: 8.5,       // work_hours + leave_hours
     leave_entries: []       // Array of leave entries for this day
   }
   ```

3. **Submit Payload:**
   ```typescript
   {
     timesheet_id: "uuid",
     entries: [
       { date: "2025-02-01", work_hours: 8.5 },
       { date: "2025-02-02", work_hours: 8.5 },
       { date: "2025-02-03", work_hours: 0 },
       // ... all days of month
     ]
   }
   ```

4. **Auto-Population Logic:**
   - When timesheet created, query approved leave requests for that period
   - For each approved leave day, create entry with:
     - entry_type = 'leave'
     - hours = calculated from work hours config for that day
     - leave_request_id = approved leave request id
     - is_auto_added = true

5. **Update Logic:**
   - User can update work hours for any day
   - Leave entries are read-only (managed by system)
   - User can add holiday entries manually

---

## Questions for Discussion:

1. **Entry Structure:** Do you prefer Option 3 (multiple entries per day) or Option 1 (single entry with separate fields)?

2. **Leave Auto-Population:**
   - Should approved leaves be auto-added when timesheet is created?
   - Or when leave is approved (even if timesheet doesn't exist yet)?
   - Should users be able to manually add leave entries?

3. **Holidays:**
   - Should holidays be user-input or system-managed?
   - Should holidays have hours (e.g., 8.5 hours) or just marked as holiday?

4. **Validation:**
   - Should we validate that work hours match expected work hours config?
   - Should we prevent over-submission (e.g., 10 hours on a day that should be 8.5)?

5. **Submission:**
   - Should all days be required, or can some days be empty?
   - Should we validate that all days in the month have entries?

---

## Proposed Next Steps:

1. Enhance TimesheetEntry schema (add `is_auto_added`, `leave_type_id`)
2. Create timesheet service for auto-populating approved leaves
3. Create timesheet endpoints with bulk entry update
4. Create aggregation service for UI data formatting
5. Implement leave-to-timesheet integration hook

**Please review and provide feedback on:**
- Preferred entry structure (Option 1 vs Option 3)
- Auto-population timing
- Holiday handling
- Validation rules
