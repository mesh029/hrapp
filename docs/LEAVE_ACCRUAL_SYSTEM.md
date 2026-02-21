# Leave Accrual System Design

## Overview
The leave accrual system allows organizations to configure how employees earn leave days over time. This is fully dynamic and configurable at multiple levels.

## Requirements

### 1. Accrual Rate Configuration
- **Default Rate:** 1.75 days per month (system-wide default)
- **Configurable Levels:**
  1. **Location-Specific:** Override default for specific locations
  2. **Employee Type-Specific:** Override default for specific staff types
  3. **Location + Employee Type:** Most specific (highest priority)

### 2. Priority Resolution
When calculating accrual rate for an employee:
1. Check for location + employee type combination (highest priority)
2. Check for employee type only
3. Check for location only
4. Use system default (lowest priority)

### 3. Accrual Calculation
- **Monthly Accrual:** Days earned per month (e.g., 1.75 days/month)
- **Annual Accrual:** Days earned per year (e.g., 21 days/year = 1.75/month)
- **Pro-rated:** For partial months (e.g., employee starts mid-month)

### 4. Accrual Periods
- **Monthly:** Accrual happens monthly (default)
- **Annual:** Accrual happens once per year
- **Quarterly:** Accrual happens quarterly

## Schema Design

### LeaveAccrualConfig Model
```prisma
model LeaveAccrualConfig {
  id                String   @id @default(uuid())
  leave_type_id     String   // Which leave type this applies to
  location_id       String?  // Optional: location-specific
  staff_type_id     String?  // Optional: staff-type-specific
  accrual_rate      Decimal  @db.Decimal(10, 2) // Days per period
  accrual_period    String   // "monthly", "quarterly", "annual"
  is_active         Boolean  @default(true)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  deleted_at        DateTime?

  leave_type LeaveType @relation(fields: [leave_type_id], references: [id], onDelete: Cascade)
  location   Location? @relation(fields: [location_id], references: [id], onDelete: Cascade)
  staff_type StaffType? @relation(fields: [staff_type_id], references: [id], onDelete: Cascade)

  @@unique([leave_type_id, location_id, staff_type_id]) // One config per combination
  @@index([leave_type_id, location_id, staff_type_id])
  @@index([is_active, deleted_at])
  @@map("leave_accrual_configs")
}
```

### System Default
- Stored in `LeaveAccrualConfig` with `location_id = null` and `staff_type_id = null`
- Default value: 1.75 days/month for standard leave types

## API Endpoints

### Accrual Config Management
- `GET /api/leave/accrual/configs` - List accrual configs
- `POST /api/leave/accrual/configs` - Create accrual config
- `GET /api/leave/accrual/configs/:id` - Get config details
- `PATCH /api/leave/accrual/configs/:id` - Update config
- `DELETE /api/leave/accrual/configs/:id` - Delete config
- `GET /api/leave/accrual/configs/resolve` - Resolve accrual rate for user/leave type

### Accrual Calculation
- `POST /api/leave/accrual/calculate` - Calculate accrual for a period
- `POST /api/leave/accrual/apply` - Apply accrual to leave balances

## Service Functions

### resolveAccrualRate
```typescript
async function resolveAccrualRate(
  leaveTypeId: string,
  locationId: string | null,
  staffTypeId: string | null
): Promise<{
  rate: number;
  period: string;
  source: 'location_staff_type' | 'staff_type' | 'location' | 'default';
}>
```

### calculateAccrual
```typescript
async function calculateAccrual(
  userId: string,
  leaveTypeId: string,
  startDate: Date,
  endDate: Date
): Promise<number> // Returns days accrued
```

### applyAccrual
```typescript
async function applyAccrual(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number
): Promise<void> // Adds days to leave balance
```

## Implementation Notes

1. **Default Configuration:** Seed script should create default accrual configs for standard leave types
2. **Priority Resolution:** Service should check in order: location+staff_type > staff_type > location > default
3. **Pro-rating:** For partial months, calculate based on days worked
4. **Backdating:** Accrual can be calculated and applied retroactively
