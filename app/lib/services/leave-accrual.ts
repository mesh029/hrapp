import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;
import { getOrCreateLeaveBalance, allocateLeaveDays } from './leave-balance';

export type AccrualPeriod = 'monthly' | 'quarterly' | 'annual';

export interface ResolvedAccrualRate {
  rate: number;
  period: AccrualPeriod;
  source: 'location_staff_type' | 'staff_type' | 'location' | 'default';
  configId: string;
}

/**
 * Resolve accrual rate for a user, leave type, and location
 * Priority: location+staff_type > staff_type > location > default
 */
export async function resolveAccrualRate(
  leaveTypeId: string,
  locationId: string | null,
  staffTypeId: string | null
): Promise<ResolvedAccrualRate> {
  // Priority 1: Location + Staff Type (most specific)
  if (locationId && staffTypeId) {
    const config = await prisma.leaveAccrualConfig.findFirst({
      where: {
        leave_type_id: leaveTypeId,
        location_id: locationId,
        staff_type_id: staffTypeId,
        is_active: true,
        deleted_at: null,
      },
    });

    if (config) {
      return {
        rate: config.accrual_rate.toNumber(),
        period: config.accrual_period as AccrualPeriod,
        source: 'location_staff_type',
        configId: config.id,
      };
    }
  }

  // Priority 2: Staff Type only
  if (staffTypeId) {
    const config = await prisma.leaveAccrualConfig.findFirst({
      where: {
        leave_type_id: leaveTypeId,
        location_id: null,
        staff_type_id: staffTypeId,
        is_active: true,
        deleted_at: null,
      },
    });

    if (config) {
      return {
        rate: config.accrual_rate.toNumber(),
        period: config.accrual_period as AccrualPeriod,
        source: 'staff_type',
        configId: config.id,
      };
    }
  }

  // Priority 3: Location only
  if (locationId) {
    const config = await prisma.leaveAccrualConfig.findFirst({
      where: {
        leave_type_id: leaveTypeId,
        location_id: locationId,
        staff_type_id: null,
        is_active: true,
        deleted_at: null,
      },
    });

    if (config) {
      return {
        rate: config.accrual_rate.toNumber(),
        period: config.accrual_period as AccrualPeriod,
        source: 'location',
        configId: config.id,
      };
    }
  }

  // Priority 4: Default (location=null, staff_type=null)
  const defaultConfig = await prisma.leaveAccrualConfig.findFirst({
    where: {
      leave_type_id: leaveTypeId,
      location_id: null,
      staff_type_id: null,
      is_active: true,
      deleted_at: null,
    },
  });

  if (defaultConfig) {
    return {
      rate: defaultConfig.accrual_rate.toNumber(),
      period: defaultConfig.accrual_period as AccrualPeriod,
      source: 'default',
      configId: defaultConfig.id,
    };
  }

  // No config found - return system default (1.75 days/month)
  return {
    rate: 1.75,
    period: 'monthly',
    source: 'default',
    configId: '',
  };
}

/**
 * Calculate accrual for a date range
 */
export async function calculateAccrual(
  userId: string,
  leaveTypeId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      staff_type: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Respect employee contract window: accrual only applies while contract is active.
  const effectiveStartDate = user.contract_start_date && user.contract_start_date > startDate
    ? user.contract_start_date
    : startDate;
  const effectiveEndDate = user.contract_end_date && user.contract_end_date < endDate
    ? user.contract_end_date
    : endDate;

  if (effectiveEndDate < effectiveStartDate) {
    return 0;
  }

  // Resolve accrual rate
  const accrualConfig = await resolveAccrualRate(
    leaveTypeId,
    user.primary_location_id,
    user.staff_type_id ?? null
  );

  // Calculate months between dates
  const monthsDiff = (effectiveEndDate.getFullYear() - effectiveStartDate.getFullYear()) * 12 +
    (effectiveEndDate.getMonth() - effectiveStartDate.getMonth()) +
    (effectiveEndDate.getDate() >= effectiveStartDate.getDate() ? 0 : -1);

  // Calculate accrual based on period
  let daysAccrued = 0;

  switch (accrualConfig.period) {
    case 'monthly':
      daysAccrued = accrualConfig.rate * monthsDiff;
      break;
    case 'quarterly':
      daysAccrued = accrualConfig.rate * (monthsDiff / 3);
      break;
    case 'annual':
      const yearsDiff = monthsDiff / 12;
      daysAccrued = accrualConfig.rate * yearsDiff;
      break;
  }

  return Math.max(0, daysAccrued); // Ensure non-negative
}

/**
 * Apply accrual to leave balance
 */
export async function applyAccrual(
  userId: string,
  leaveTypeId: string,
  year: number,
  days: number
): Promise<void> {
  // Get or create leave balance
  const balance = await getOrCreateLeaveBalance(userId, leaveTypeId, year);

  // Add accrued days to allocated
  await allocateLeaveDays(userId, leaveTypeId, year, days);
}

/**
 * Process monthly accrual for all active users
 * This would typically be run as a scheduled job
 */
export async function processMonthlyAccrual(
  year: number,
  month: number
): Promise<{ processed: number; errors: number }> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month

  // Get all active users
  const users = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      OR: [
        { contract_status: null },
        { contract_status: { not: 'expired' } },
      ],
    },
    include: {
      staff_type: true,
    },
  });

  let processed = 0;
  let errors = 0;

  for (const user of users) {
    // Get all active leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        status: 'active',
        deleted_at: null,
      },
    });

    for (const leaveType of leaveTypes) {
      try {
        const daysAccrued = await calculateAccrual(
          user.id,
          leaveType.id,
          startDate,
          endDate
        );

        if (daysAccrued > 0) {
          await applyAccrual(user.id, leaveType.id, year, daysAccrued);
          processed++;
        }
      } catch (error) {
        console.error(`Error processing accrual for user ${user.id}, leave type ${leaveType.id}:`, error);
        errors++;
      }
    }
  }

  return { processed, errors };
}
