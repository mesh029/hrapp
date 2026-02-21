# Leave Balance Reset & Adjustment System

## Overview
The system supports manual reset and adjustment of leave balances for employees, with automatic reset when contract periods expire.

## Requirements

### 1. Contract Period Management
- **Contract Start Date:** When employee contract begins
- **Contract End Date:** When employee contract expires (optional - can be null for permanent employees)
- **Contract Status:** Active, Expired, Unknown

### 2. Leave Balance Reset
- **Automatic Reset:** When contract period expires, leave balances reset to 0
- **Manual Reset:** Admins can manually reset leave balances for any employee
- **Selective Reset:** Can reset specific leave types or all leave types

### 3. Leave Balance Adjustment
- **Manual Adjustment:** Admins can add or subtract days from leave balances
- **Reason Required:** All adjustments must have a reason/comment
- **Audit Trail:** All adjustments are logged in audit logs

### 4. Contract Expiration Handling
- **Scheduled Job:** Check for expired contracts and reset balances
- **Notification:** Notify HR when contracts expire
- **Grace Period:** Optional grace period before reset (e.g., 30 days)

## Schema Updates

### User Model
```prisma
model User {
  // ... existing fields ...
  contract_start_date DateTime?  @db.Date
  contract_end_date   DateTime?  @db.Date
  contract_status     String?    // "active", "expired", "unknown"
  // ... existing relations ...
}
```

### LeaveBalanceReset Model (New)
```prisma
model LeaveBalanceReset {
  id                String   @id @default(uuid())
  user_id           String
  leave_type_id     String?  // null = all leave types
  reset_type        String   // "automatic" (contract expired) or "manual"
  reason            String
  reset_by          String?  // null if automatic
  reset_at          DateTime @default(now())
  
  user       User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  leave_type LeaveType? @relation(fields: [leave_type_id], references: [id], onDelete: Cascade)
  resetter   User?     @relation("LeaveBalanceResetter", fields: [reset_by], references: [id], onDelete: SetNull)
  
  @@index([user_id, reset_at])
  @@index([reset_type])
  @@map("leave_balance_resets")
}
```

### LeaveBalanceAdjustment Model (New)
```prisma
model LeaveBalanceAdjustment {
  id            String   @id @default(uuid())
  user_id       String
  leave_type_id String
  year          Int
  adjustment    Decimal  @db.Decimal(10, 2) // Positive = add, Negative = subtract
  reason        String
  adjusted_by   String
  adjusted_at   DateTime @default(now())
  
  user       User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  leave_type LeaveType @relation(fields: [leave_type_id], references: [id], onDelete: Cascade)
  adjuster   User      @relation("LeaveBalanceAdjuster", fields: [adjusted_by], references: [id], onDelete: Cascade)
  
  @@index([user_id, leave_type_id, year])
  @@index([adjusted_at])
  @@map("leave_balance_adjustments")
}
```

## API Endpoints

### Leave Balance Reset
- `POST /api/leave/balances/reset` - Manually reset leave balance(s)
- `GET /api/leave/balances/reset/history` - Get reset history
- `POST /api/leave/balances/reset/expired-contracts` - Process expired contracts (admin only)

### Leave Balance Adjustment
- `POST /api/leave/balances/adjust` - Adjust leave balance (add/subtract days)
- `GET /api/leave/balances/adjustments` - Get adjustment history

### Contract Management
- `PATCH /api/users/:id/contract` - Update contract dates
- `GET /api/users/contracts/expiring` - Get contracts expiring soon
- `GET /api/users/contracts/expired` - Get expired contracts

## Service Functions

### resetLeaveBalance
```typescript
async function resetLeaveBalance(
  userId: string,
  leaveTypeId: string | null, // null = all leave types
  reason: string,
  resetBy: string | null // null = automatic
): Promise<void>
```

### adjustLeaveBalance
```typescript
async function adjustLeaveBalance(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number, // Positive = add, Negative = subtract
  reason: string,
  adjustedBy: string
): Promise<void>
```

### processExpiredContracts
```typescript
async function processExpiredContracts(): Promise<{
  processed: number;
  errors: number;
}>
```

## Implementation Notes

1. **Contract Status:**
   - "active": contract_end_date is null or in the future
   - "expired": contract_end_date is in the past
   - "unknown": contract_start_date is null

2. **Automatic Reset:**
   - Runs as scheduled job (e.g., daily)
   - Checks for contracts where contract_end_date < today
   - Resets all leave balances for expired contracts
   - Logs reset in LeaveBalanceReset table

3. **Manual Reset:**
   - Requires admin permission
   - Can reset specific leave type or all leave types
   - Reason is required

4. **Adjustment:**
   - Can add or subtract days
   - Updates LeaveBalance.allocated field
   - Creates audit log entry
   - Reason is required
