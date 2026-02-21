# Timesheet Design Proposal - Phase 6

## Requirements Summary

### 1. Entry Structure Requirements
- **Work Hours:** Hours worked for each day of the month
- **Holiday Hours:** Hours for each holiday in the month (system-suggested + manual)
- **Leave Hours:** Hours for each leave day in the month (auto-populated from approved leaves)
  - **IMPORTANT:** All leave types (sick, vacation, etc.) share the same hours
  - Leave hours = expected work hours for that day (from work hours config)
  - Leave types do NOT have their own specific hours assigned
- **Total:** Sum of all hours (work + leave + holiday + weekend extra)

### 2. Auto-Population
- **On Leave Approval:** Automatically create timesheet entry (if timesheet exists)
- **On Timesheet Creation:** Sync all approved leaves for that period

### 3. Holidays
- **System-Suggested:** Predefined holidays (stored in database)
- **Manual Addition:** Authorized users can add holidays
- **Hours:** Holidays have hours (e.g., 8.5 hours for a holiday)

### 4. Daily Entry Requirements
- **Every Day Must Have Entry:** All days in month must have entries
- **Validation:** Compare expected hours vs actual hours
  - Expected = Work hours config for that day (based on staff type + location)
  - Actual = Work hours + Leave hours + Holiday hours + Weekend extra hours
- **Weekend Extra Hours:** Can be allowed by system admins (requires permission)

### 5. Validation Rules
- **Prevent Submission:** If validation fails
- **Warnings:** Show warnings for discrepancies
- **Notifications:** Send notifications to relevant parties

### 6. Submission Format
- **All Days in One Payload:** Submit entire month's data at once

---

## Proposed Schema Design

### 1. Holiday Model (New)
```prisma
model Holiday {
  id          String   @id @default(uuid())
  name        String
  date        DateTime @db.Date
  location_id String?  // Optional: location-specific holidays
  hours       Decimal  @db.Decimal(10, 2) // Hours for this holiday
  is_recurring Boolean @default(false) // Recurring annually?
  created_by  String
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  deleted_at  DateTime?

  location Location? @relation(fields: [location_id], references: [id], onDelete: Cascade)
  creator  User     @relation(fields: [created_by], references: [id], onDelete: Cascade)

  @@unique([date, location_id]) // One holiday per date per location
  @@index([date, location_id])
  @@index([is_recurring])
  @@map("holidays")
}
```

### 2. Enhanced TimesheetEntry Model
```prisma
model TimesheetEntry {
  id                String   @id @default(uuid())
  timesheet_id      String
  date              DateTime @db.Date
  work_hours        Decimal  @db.Decimal(10, 2) @default(0)  // User input: hours worked
  leave_hours       Decimal  @db.Decimal(10, 2) @default(0)  // Auto: from approved leaves
  holiday_hours     Decimal  @db.Decimal(10, 2) @default(0)  // Auto/Manual: from holidays
  weekend_extra_hours Decimal @db.Decimal(10, 2) @default(0) // Manual: extra weekend hours (requires permission)
  total_hours       Decimal  @db.Decimal(10, 2) @default(0)  // Calculated: work + leave + holiday + weekend_extra
  description       String?  // Optional notes
  leave_request_id  String?  // If leave_hours > 0, link to leave request
  holiday_id        String?  // If holiday_hours > 0, link to holiday
  is_auto_added     Boolean  @default(false) // True if auto-added (leave/holiday)
  weekend_extra_allowed Boolean @default(false) // True if admin allowed weekend extra hours
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  timesheet Timesheet @relation(fields: [timesheet_id], references: [id], onDelete: Cascade)
  leave_request LeaveRequest? @relation(fields: [leave_request_id], references: [id], onDelete: SetNull)
  holiday Holiday? @relation(fields: [holiday_id], references: [id], onDelete: SetNull)

  @@unique([timesheet_id, date]) // One entry per day per timesheet
  @@index([timesheet_id, date])
  @@index([date])
  @@map("timesheet_entries")
}
```

**Key Points:**
- **One entry per day** (simpler structure)
- **Separate fields** for work, leave, holiday, weekend extra hours
- **Total calculated** automatically
- **Links to leave_request and holiday** for traceability

### 3. Timesheet Validation Model (New)
```prisma
model TimesheetValidation {
  id                String   @id @default(uuid())
  timesheet_id      String   @unique
  expected_hours    Decimal  @db.Decimal(10, 2) // Based on work hours config
  actual_hours      Decimal  @db.Decimal(10, 2) // Sum of all entries
  discrepancy       Decimal  @db.Decimal(10, 2) // actual - expected
  validation_status String   // "valid", "warning", "error"
  validation_notes  String?  // Details about discrepancies
  validated_at      DateTime?
  validated_by      String?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  timesheet Timesheet @relation(fields: [timesheet_id], references: [id], onDelete: Cascade)
  validator User?     @relation(fields: [validated_by], references: [id], onDelete: SetNull)

  @@index([validation_status])
  @@map("timesheet_validations")
}
```

---

## Data Flow & Logic

### 1. Timesheet Creation Flow

```
User creates timesheet for February 2025
  ↓
System:
  1. Creates timesheet record (period_start: 2025-02-01, period_end: 2025-02-28)
  2. Gets user's staff type and location
  3. Gets work hours config for staff type + location
  4. Creates entries for ALL days in month:
     - For each day, create TimesheetEntry with:
       - date = day
       - work_hours = 0 (user will fill)
       - expected_hours = from work hours config (based on day of week)
       - leave_hours = 0
       - holiday_hours = 0
       - weekend_extra_hours = 0
  5. Auto-populate approved leaves:
     - Query approved leave requests for this user in this period
     - For each leave day, update entry:
       - leave_hours = work hours config for that day
       - leave_request_id = leave request id
       - is_auto_added = true
  6. Auto-populate holidays:
     - Query holidays for this location in this period
     - For each holiday, update entry:
       - holiday_hours = holiday.hours
       - holiday_id = holiday.id
       - is_auto_added = true
  7. Calculate total_hours for each entry
  8. Calculate timesheet.total_hours (sum of all entries)
```

### 2. Leave Approval Integration

```
Leave request approved
  ↓
System:
  1. Get leave request details (user, dates, leave type)
  2. Check if timesheet exists for that period
  3. If exists:
     - For each day in leave period:
       - Find or create TimesheetEntry for that day
       - Update leave_hours = work hours config for that day
       - Set leave_request_id
       - Set is_auto_added = true
       - Recalculate total_hours
  4. If timesheet doesn't exist:
     - Store pending leave entry (will be added when timesheet created)
     - Or create timesheet automatically? (need to decide)
```

### 3. Validation Logic

```
Before Submission:
  ↓
For each day in month:
  1. Get expected hours from work hours config (based on day of week, staff type, location)
  2. Calculate actual hours = work_hours + leave_hours + holiday_hours + weekend_extra_hours
  3. Compare expected vs actual
  
Validation Rules:
  - If actual < expected (and no leave/holiday): WARNING
  - If actual > expected (and no weekend_extra_allowed): ERROR (prevent submission)
  - If actual = expected: VALID
  - If actual > expected (with weekend_extra_allowed): VALID (but log for audit)
  
Overall Validation:
  - Sum all expected hours for month
  - Sum all actual hours for month
  - Calculate discrepancy
  - If discrepancy > threshold: ERROR (prevent submission)
  - If discrepancy < threshold: WARNING (allow with notification)
```

### 4. Submission Payload Structure

```typescript
POST /api/timesheets/:id/submit
{
  entries: [
    {
      date: "2025-02-01",
      work_hours: 8.5,
      leave_hours: 0,
      holiday_hours: 0,
      weekend_extra_hours: 0,
      description: "Regular work"
    },
    {
      date: "2025-02-02",
      work_hours: 8.5,
      leave_hours: 0,
      holiday_hours: 0,
      weekend_extra_hours: 0
    },
    {
      date: "2025-02-07",
      work_hours: 0,
      leave_hours: 8.5,  // Auto-populated, read-only
      holiday_hours: 0,
      weekend_extra_hours: 0
    },
    {
      date: "2025-02-12",
      work_hours: 0,
      leave_hours: 6,  // Auto-populated, read-only
      holiday_hours: 0,
      weekend_extra_hours: 0
    },
    // ... all days of month
  ]
}
```

---

## Key Design Decisions

### 1. Entry Structure: Single Entry Per Day
- **Rationale:** Simpler structure, easier to query, matches UI layout
- **Fields:** work_hours, leave_hours, holiday_hours, weekend_extra_hours, total_hours
- **Benefits:** One record per day, clear separation of hour types

### 2. Holiday Management
- **Holiday Model:** Stores predefined and manual holidays
- **Location-Specific:** Holidays can be location-specific or global
- **Recurring:** Support for annual recurring holidays
- **Hours:** Each holiday has hours (from work hours config or custom)

### 3. Weekend Extra Hours
- **Permission-Based:** Only system admins can allow weekend extra hours
- **Flag:** `weekend_extra_allowed` on entry
- **Validation:** If weekend_extra_hours > 0, must have `weekend_extra_allowed = true`

### 4. Validation Service
- **Expected Hours:** Calculated from work hours config (staff type + location + day of week)
- **Actual Hours:** Sum of work + leave + holiday + weekend extra
- **Validation Status:** "valid", "warning", "error"
- **Prevents Submission:** If status = "error"
- **Notifications:** Send on warnings/errors

### 5. Auto-Population Strategy
- **On Leave Approval:** Add entry immediately if timesheet exists
- **On Timesheet Creation:** Sync all approved leaves for period
- **On Holiday Creation:** Add to existing timesheets in that period

---

## API Endpoints Needed

### Timesheet Endpoints
- `POST /api/timesheets` - Create timesheet (auto-creates entries for all days)
- `GET /api/timesheets` - List timesheets
- `GET /api/timesheets/:id` - Get timesheet with all entries
- `PATCH /api/timesheets/:id/entries` - Bulk update entries (submit all days)
- `POST /api/timesheets/:id/submit` - Submit for approval
- `GET /api/timesheets/:id/validate` - Validate timesheet before submission

### Holiday Endpoints
- `GET /api/holidays` - List holidays (with date range filter)
- `POST /api/holidays` - Create holiday (admin only)
- `PATCH /api/holidays/:id` - Update holiday
- `DELETE /api/holidays/:id` - Delete holiday

### Weekend Extra Hours
- `POST /api/timesheets/:id/entries/:date/allow-weekend-extra` - Allow weekend extra hours (admin only)

---

## Final Design Decisions (Confirmed)

1. **Holiday Hours Source:**
   - ✅ Come from predefined country holiday config (default: Kenya)
   - ✅ Users with rights can add sudden holidays not in country calendar
   - ✅ Need country setting and holiday config system

2. **Weekend Extra Hours:**
   - ✅ Request/approval process (not just a flag)
   - ✅ Allowed by managers or timesheet approvers
   - ✅ Must be requested and approved before use

3. **Validation Threshold:**
   - ✅ Hard validation: hours should NOT exceed expected EXCEPT:
     - Approved weekend extra hours
     - Approved holiday hours  
     - Approved overtime
   - ✅ Strict - no over-submission unless explicitly approved

4. **Auto-Create Timesheet on Leave Approval:**
   - ✅ If timesheet doesn't exist when leave approved, auto-create it

5. **Period Locking:**
   - ✅ Per period, controlled by managers
   - ✅ "Enable timesheet submission" flag on TimesheetPeriod

6. **Entry Updates:**
   - ✅ leave_hours and holiday_hours are read-only (system-managed)
   - ✅ weekend_extra_hours requires approval before use
   - ✅ work_hours can be updated by user

Please confirm these details and I'll proceed with implementation!
