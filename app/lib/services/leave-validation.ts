import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;

export interface LeaveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate leave request against leave type constraints
 */
export async function validateLeaveRequest(
  leaveTypeId: string,
  userId: string,
  startDate: Date,
  endDate: Date,
  daysRequested: number
): Promise<LeaveValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get leave type
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
  });

  if (!leaveType || leaveType.deleted_at || leaveType.status === 'inactive') {
    errors.push('Leave type not found or inactive');
    return { valid: false, errors, warnings };
  }

  // Validate max days per year
  if (leaveType.max_days_per_year !== null) {
    const currentYear = new Date().getFullYear();
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        user_id_leave_type_id_year: {
          user_id: userId,
          leave_type_id: leaveTypeId,
          year: currentYear,
        },
      },
    });

    const used = leaveBalance?.used.toNumber() || 0;
    const pending = leaveBalance?.pending.toNumber() || 0;
    const allocated = leaveBalance?.allocated.toNumber() || 0;

    const totalUsed = used + pending + daysRequested;

    if (totalUsed > allocated) {
      errors.push(`Requested days (${daysRequested}) would exceed allocated balance`);
    }

    if (leaveType.max_days_per_year && totalUsed > leaveType.max_days_per_year) {
      errors.push(`Requested days would exceed maximum allowed per year (${leaveType.max_days_per_year})`);
    }
  }

  // Validate date range
  if (startDate > endDate) {
    errors.push('Start date must be before or equal to end date');
  }

  // Check for overlapping leave requests
  const overlappingRequests = await prisma.leaveRequest.findMany({
    where: {
      user_id: userId,
      status: {
        in: ['Draft', 'Submitted', 'UnderReview', 'Approved'],
      },
      deleted_at: null,
      OR: [
        {
          start_date: { lte: endDate },
          end_date: { gte: startDate },
        },
      ],
    },
  });

  if (overlappingRequests.length > 0) {
    warnings.push(`Found ${overlappingRequests.length} overlapping leave request(s)`);
  }

  // Validate accrual rules if applicable
  if (leaveType.accrual_rule) {
    try {
      const accrualRule = typeof leaveType.accrual_rule === 'string' 
        ? JSON.parse(leaveType.accrual_rule) 
        : leaveType.accrual_rule;

      // Additional validation based on accrual rule type
      if (accrualRule.type === 'monthly' && accrualRule.days) {
        // Could add monthly accrual validation here
      }
    } catch (e) {
      warnings.push('Could not parse accrual rule');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate leave balance before allocation
 */
export async function validateLeaveBalance(
  userId: string,
  leaveTypeId: string,
  year: number,
  daysToAllocate: number
): Promise<LeaveValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get leave type
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
  });

  if (!leaveType || leaveType.deleted_at || leaveType.status === 'inactive') {
    errors.push('Leave type not found or inactive');
    return { valid: false, errors, warnings };
  }

  // Check max days per year
  if (leaveType.max_days_per_year !== null) {
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        user_id_leave_type_id_year: {
          user_id: userId,
          leave_type_id: leaveTypeId,
          year,
        },
      },
    });

    const currentAllocated = leaveBalance?.allocated.toNumber() || 0;
    const newAllocated = currentAllocated + daysToAllocate;

    if (leaveType.max_days_per_year && newAllocated > leaveType.max_days_per_year) {
      errors.push(`Allocation would exceed maximum allowed per year (${leaveType.max_days_per_year})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate leave accrual based on leave type rules
 */
export async function calculateLeaveAccrual(
  leaveTypeId: string,
  monthsWorked: number
): Promise<number> {
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
  });

  if (!leaveType || !leaveType.accrual_rule) {
    return 0;
  }

  try {
    const accrualRule = typeof leaveType.accrual_rule === 'string'
      ? JSON.parse(leaveType.accrual_rule)
      : leaveType.accrual_rule;

    if (accrualRule.type === 'monthly' && accrualRule.days) {
      return monthsWorked * accrualRule.days;
    }

    if (accrualRule.type === 'annual' && accrualRule.days) {
      // Pro-rated based on months worked
      return (monthsWorked / 12) * accrualRule.days;
    }
  } catch (e) {
    console.error('Error parsing accrual rule:', e);
  }

  return 0;
}

/**
 * Check if leave type is paid
 */
export async function isLeaveTypePaid(leaveTypeId: string): Promise<boolean> {
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: { is_paid: true },
  });

  return leaveType?.is_paid ?? false;
}
