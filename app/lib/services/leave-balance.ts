import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;
import { calculateLeaveAccrual } from './leave-validation';

/**
 * Get or create leave balance for a user, leave type, and year
 */
export async function getOrCreateLeaveBalance(
  userId: string,
  leaveTypeId: string,
  year: number
) {
  let balance = await prisma.leaveBalance.findUnique({
    where: {
      user_id_leave_type_id_year: {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
      },
    },
  });

  if (!balance) {
    balance = await prisma.leaveBalance.create({
      data: {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
        allocated: 0,
        used: 0,
        pending: 0,
      },
    });
  }

  return balance;
}

/**
 * Calculate available balance (allocated - used - pending)
 */
export async function getAvailableBalance(
  userId: string,
  leaveTypeId: string,
  year: number
): Promise<number> {
  const balance = await getOrCreateLeaveBalance(userId, leaveTypeId, year);
  const allocated = balance.allocated.toNumber();
  const used = balance.used.toNumber();
  const pending = balance.pending.toNumber();

  return Math.max(0, allocated - used - pending);
}

/**
 * Allocate leave days to a user (e.g., annual allocation, accrual)
 */
export async function allocateLeaveDays(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number
): Promise<void> {
  const balance = await getOrCreateLeaveBalance(userId, leaveTypeId, year);
  const currentAllocated = balance.allocated.toNumber();

  await prisma.leaveBalance.update({
    where: {
      user_id_leave_type_id_year: {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
      },
    },
    data: {
      allocated: new Decimal(currentAllocated + days),
    },
  });
}

/**
 * Add pending days when leave request is submitted
 */
export async function addPendingDays(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number
): Promise<void> {
  const balance = await getOrCreateLeaveBalance(userId, leaveTypeId, year);
  const currentPending = balance.pending.toNumber();

  await prisma.leaveBalance.update({
    where: {
      user_id_leave_type_id_year: {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
      },
    },
    data: {
      pending: new Decimal(currentPending + days),
    },
  });
}

/**
 * Remove pending days (e.g., when request is declined or cancelled)
 */
export async function removePendingDays(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number
): Promise<void> {
  const balance = await getOrCreateLeaveBalance(userId, leaveTypeId, year);
  const currentPending = balance.pending.toNumber();
  const newPending = Math.max(0, currentPending - days);

  await prisma.leaveBalance.update({
    where: {
      user_id_leave_type_id_year: {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
      },
    },
    data: {
      pending: new Decimal(newPending),
    },
  });
}

/**
 * Move pending to used when leave request is approved
 */
export async function approveLeaveDays(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number
): Promise<void> {
  const balance = await getOrCreateLeaveBalance(userId, leaveTypeId, year);
  const currentPending = balance.pending.toNumber();
  const currentUsed = balance.used.toNumber();

  // Remove from pending and add to used
  const newPending = Math.max(0, currentPending - days);
  const newUsed = currentUsed + days;

  await prisma.leaveBalance.update({
    where: {
      user_id_leave_type_id_year: {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
      },
    },
    data: {
      pending: new Decimal(newPending),
      used: new Decimal(newUsed),
    },
  });
}

/**
 * Calculate and allocate leave based on accrual rules
 */
export async function calculateAndAllocateAccrual(
  userId: string,
  leaveTypeId: string,
  year: number,
  monthsWorked: number
): Promise<number> {
  const accrualDays = await calculateLeaveAccrual(leaveTypeId, monthsWorked);
  
  if (accrualDays > 0) {
    await allocateLeaveDays(userId, leaveTypeId, year, accrualDays);
  }

  return accrualDays;
}

/**
 * Get all leave balances for a user in a year
 */
export async function getUserLeaveBalances(
  userId: string,
  year: number
) {
  const balances = await prisma.leaveBalance.findMany({
    where: {
      user_id: userId,
      year,
    },
    include: {
      leave_type: {
        select: {
          id: true,
          name: true,
          description: true,
          is_paid: true,
          max_days_per_year: true,
        },
      },
    },
    orderBy: {
      leave_type: {
        name: 'asc',
      },
    },
  });

  return balances.map((balance) => ({
    ...balance,
    allocated: balance.allocated.toNumber(),
    used: balance.used.toNumber(),
    pending: balance.pending.toNumber(),
    available: Math.max(0, balance.allocated.toNumber() - balance.used.toNumber() - balance.pending.toNumber()),
  }));
}

/**
 * Calculate days between two dates (excluding weekends if needed)
 */
export function calculateDaysBetween(startDate: Date, endDate: Date, excludeWeekends: boolean = false): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    return 0;
  }

  if (!excludeWeekends) {
    // Simple day count including weekends
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    return diffDays;
  }

  // Count only weekdays
  let count = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
