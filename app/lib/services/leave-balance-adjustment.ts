import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;
import { getOrCreateLeaveBalance } from './leave-balance';

/**
 * Adjust leave balance (add or subtract days)
 */
export async function adjustLeaveBalance(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number, // Positive = add, Negative = subtract
  reason: string,
  adjustedBy: string
): Promise<void> {
  // Get or create leave balance
  const balance = await getOrCreateLeaveBalance(userId, leaveTypeId, year);

  // Calculate new allocated amount
  const adjustment = new Decimal(days);
  const newAllocated = balance.allocated.plus(adjustment);

  // Allow negative balances (admins can adjust as needed)
  // This gives admins full control to set balances to any value

  // Update balance
  await prisma.leaveBalance.update({
    where: { id: balance.id },
    data: {
      allocated: newAllocated,
    },
  });

  // Log the adjustment
  await prisma.leaveBalanceAdjustment.create({
    data: {
      user_id: userId,
      leave_type_id: leaveTypeId,
      year,
      adjustment,
      reason,
      adjusted_by: adjustedBy,
    },
  });
}

/**
 * Get adjustment history for a user
 */
export async function getAdjustmentHistory(
  userId: string,
  leaveTypeId?: string,
  year?: number
): Promise<Array<{
  id: string;
  leaveTypeName: string;
  year: number;
  adjustment: number;
  reason: string;
  adjustedBy: string;
  adjustedAt: Date;
}>> {
  const where: any = { user_id: userId };
  if (leaveTypeId) where.leave_type_id = leaveTypeId;
  if (year) where.year = year;

  const adjustments = await prisma.leaveBalanceAdjustment.findMany({
    where,
    include: {
      leave_type: {
        select: {
          name: true,
        },
      },
      adjuster: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { adjusted_at: 'desc' },
  });

  return adjustments.map((adj) => ({
    id: adj.id,
    leaveTypeName: adj.leave_type.name,
    year: adj.year,
    adjustment: adj.adjustment.toNumber(),
    reason: adj.reason,
    adjustedBy: adj.adjuster.name || adj.adjuster.email,
    adjustedAt: adj.adjusted_at,
  }));
}
