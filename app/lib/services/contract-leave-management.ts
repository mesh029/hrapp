import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;
import { allocateLeaveDays, getOrCreateLeaveBalance } from './leave-balance';
import { resolveAccrualRate } from './leave-accrual';
import { updateContractStatus } from './leave-balance-reset';

/**
 * Auto-calculate and allocate leave days based on contract period and annual allocation
 * Formula: (Annual Leave Days / 12) * Months in Contract Period
 * Example: If annual is 21 days and contract is Jan-Mar (3 months): (21/12) * 3 = 5.25 days
 */
export async function autoCalculateAndAllocateLeaveDays(
  userId: string,
  contractStartDate: Date,
  contractEndDate: Date | null,
  leaveTypeId: string,
  year: number
): Promise<number> {
  // Get user to determine location and staff type
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      primary_location_id: true,
      staff_type_id: true,
    },
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Get or create leave balance to check if annual allocation exists
  const existingBalance = await prisma.leaveBalance.findUnique({
    where: {
      user_id_leave_type_id_year: {
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
      },
    },
  });
  
  // Get leave type to check max_days_per_year
  const leaveType = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: {
      max_days_per_year: true,
    },
  });
  
  // Determine annual allocation: use existing allocated balance if > 0, otherwise use max_days_per_year or accrual
  let annualAllocation = 0;
  
  if (existingBalance && existingBalance.allocated.toNumber() > 0) {
    // Use existing allocated balance as annual allocation
    annualAllocation = existingBalance.allocated.toNumber();
  } else if (leaveType?.max_days_per_year) {
    // Use max_days_per_year from leave type
    annualAllocation = leaveType.max_days_per_year;
  } else {
    // Fallback: Calculate from accrual rate (assume 12 months for annual)
    const accrualRate = await resolveAccrualRate(
      leaveTypeId,
      user.primary_location_id,
      user.staff_type_id
    );
    // Calculate annual allocation based on accrual period
    if (accrualRate.period === 'monthly') {
      annualAllocation = accrualRate.rate * 12; // Monthly rate * 12 months
    } else if (accrualRate.period === 'quarterly') {
      annualAllocation = accrualRate.rate * 4; // Quarterly rate * 4 quarters
    } else {
      annualAllocation = accrualRate.rate; // Annual rate
    }
  }
  
  if (annualAllocation <= 0) {
    throw new Error('Cannot determine annual leave allocation. Please set max_days_per_year for the leave type or allocate leave days first.');
  }
  
  // Calculate months worked in the contract period
  const start = new Date(contractStartDate);
  const end = contractEndDate ? new Date(contractEndDate) : new Date(year, 11, 31); // End of year if no end date
  
  // Ensure dates are within the year
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  
  const periodStart = start > yearStart ? start : yearStart;
  const periodEnd = end < yearEnd ? end : yearEnd;
  
  if (periodStart > periodEnd) {
    return 0; // No overlap with the year
  }
  
  // Calculate months (including partial months) - more accurate calculation
  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  const monthsWorked = daysDiff / 30.44; // Average days per month
  
  // Calculate leave days: (Annual Allocation / 12) * Months Worked
  // This gives us the proportional leave days for the contract period
  const monthlyRate = annualAllocation / 12;
  const totalDays = monthlyRate * monthsWorked;
  
  // Round to 2 decimal places
  const roundedDays = Math.round(totalDays * 100) / 100;
  
  if (roundedDays > 0) {
    await allocateLeaveDays(userId, leaveTypeId, year, roundedDays);
  }
  
  return roundedDays;
}

/**
 * Bulk assign contracts to users
 */
export async function bulkAssignContracts(
  filters: {
    user_ids?: string[];
    role_ids?: string[];
    category_ids?: string[];
    staff_type_ids?: string[];
  },
  contractStartDate: Date,
  contractEndDate: Date | null,
  options: {
    auto_calculate_leave?: boolean;
    leave_type_id?: string;
    manual_leave_days?: number;
  }
): Promise<{ assigned: number; errors: number; errors_detail: Array<{ user_id: string; error: string }> }> {
  // Build user query (same logic as bulkResetLeaveBalances)
  const userWhere: any = {
    deleted_at: null,
    status: 'active',
  };
  
  if (filters.user_ids && filters.user_ids.length > 0) {
    userWhere.id = { in: filters.user_ids };
  } else {
    const conditions: any[] = [];
    
    if (filters.role_ids && filters.role_ids.length > 0) {
      conditions.push({
        user_roles: {
          some: {
            role_id: { in: filters.role_ids },
            deleted_at: null,
          },
        },
      });
    }
    
    if (filters.category_ids && filters.category_ids.length > 0) {
      conditions.push({
        category_assignments: {
          some: {
            user_category_id: { in: filters.category_ids },
          },
        },
      });
    }
    
    if (filters.staff_type_ids && filters.staff_type_ids.length > 0) {
      conditions.push({
        staff_type_id: { in: filters.staff_type_ids },
      });
    }
    
    if (conditions.length > 0) {
      userWhere.AND = conditions;
    }
  }
  
  // Get users to assign contracts
  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true },
  });
  
  let assigned = 0;
  let errors = 0;
  const errorsDetail: Array<{ user_id: string; error: string }> = [];
  
  // Assign contract for each user
  for (const user of users) {
    try {
      // Update contract dates
      await prisma.user.update({
        where: { id: user.id },
        data: {
          contract_start_date: contractStartDate,
          contract_end_date: contractEndDate,
        },
      });
      
      // Update contract status
      await updateContractStatus(user.id);
      
      // Handle leave allocation if requested
      if (options.auto_calculate_leave && options.leave_type_id) {
        const year = contractStartDate.getFullYear();
        try {
          await autoCalculateAndAllocateLeaveDays(
            user.id,
            contractStartDate,
            contractEndDate,
            options.leave_type_id,
            year
          );
        } catch (leaveError: any) {
          console.error(`Error auto-calculating leave for user ${user.id}:`, leaveError);
          // Don't fail the contract assignment if leave calculation fails
        }
      } else if (!options.auto_calculate_leave && options.leave_type_id && options.manual_leave_days) {
        const year = contractStartDate.getFullYear();
        try {
          await allocateLeaveDays(user.id, options.leave_type_id, year, options.manual_leave_days);
        } catch (leaveError: any) {
          console.error(`Error manually allocating leave for user ${user.id}:`, leaveError);
          // Don't fail the contract assignment if leave allocation fails
        }
      }
      
      assigned++;
    } catch (error: any) {
      console.error(`Error assigning contract for user ${user.id}:`, error);
      errors++;
      errorsDetail.push({
        user_id: user.id,
        error: error.message || 'Unknown error',
      });
    }
  }
  
  return { assigned, errors, errors_detail: errorsDetail };
}

/**
 * Bulk reset leave balances
 */
export async function bulkResetLeaveBalances(
  filters: {
    user_ids?: string[];
    role_ids?: string[];
    category_ids?: string[];
    staff_type_ids?: string[];
    leave_type_id?: string | null;
  },
  reason: string,
  resetBy: string
): Promise<{ reset: number; errors: number }> {
  // Build user query
  const userWhere: any = {
    deleted_at: null,
    status: 'active',
  };
  
  if (filters.user_ids && filters.user_ids.length > 0) {
    userWhere.id = { in: filters.user_ids };
  } else {
    // Build complex filter
    const conditions: any[] = [];
    
    if (filters.role_ids && filters.role_ids.length > 0) {
      conditions.push({
        user_roles: {
          some: {
            role_id: { in: filters.role_ids },
            deleted_at: null,
          },
        },
      });
    }
    
    if (filters.category_ids && filters.category_ids.length > 0) {
      conditions.push({
        category_assignments: {
          some: {
            user_category_id: { in: filters.category_ids },
          },
        },
      });
    }
    
    if (filters.staff_type_ids && filters.staff_type_ids.length > 0) {
      conditions.push({
        staff_type_id: { in: filters.staff_type_ids },
      });
    }
    
    if (conditions.length > 0) {
      userWhere.AND = conditions;
    }
  }
  
  // Get users to reset
  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true },
  });
  
  let reset = 0;
  let errors = 0;
  
  // Reset balances for each user
  for (const user of users) {
    try {
      const balanceWhere: any = { user_id: user.id };
      if (filters.leave_type_id) {
        balanceWhere.leave_type_id = filters.leave_type_id;
      }
      
      const balances = await prisma.leaveBalance.findMany({
        where: balanceWhere,
      });
      
      for (const balance of balances) {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            allocated: new Decimal(0),
            used: new Decimal(0),
            pending: new Decimal(0),
          },
        });
      }
      
      // Log the reset
      await prisma.leaveBalanceReset.create({
        data: {
          user_id: user.id,
          leave_type_id: filters.leave_type_id || null,
          reset_type: 'manual',
          reason: `${reason} (Bulk reset for ${users.length} users)`,
          reset_by: resetBy,
        },
      });
      
      reset++;
    } catch (error) {
      console.error(`Error resetting balance for user ${user.id}:`, error);
      errors++;
    }
  }
  
  return { reset, errors };
}

/**
 * Bulk allocate leave days
 */
export async function bulkAllocateLeaveDays(
  filters: {
    user_ids?: string[];
    role_ids?: string[];
    category_ids?: string[];
    staff_type_ids?: string[];
  },
  leaveTypeId: string,
  year: number,
  days: number,
  allocatedBy: string
): Promise<{ allocated: number; errors: number }> {
  // Build user query (same logic as bulkResetLeaveBalances)
  const userWhere: any = {
    deleted_at: null,
    status: 'active',
  };
  
  if (filters.user_ids && filters.user_ids.length > 0) {
    userWhere.id = { in: filters.user_ids };
  } else {
    const conditions: any[] = [];
    
    if (filters.role_ids && filters.role_ids.length > 0) {
      conditions.push({
        user_roles: {
          some: {
            role_id: { in: filters.role_ids },
            deleted_at: null,
          },
        },
      });
    }
    
    if (filters.category_ids && filters.category_ids.length > 0) {
      conditions.push({
        category_assignments: {
          some: {
            user_category_id: { in: filters.category_ids },
          },
        },
      });
    }
    
    if (filters.staff_type_ids && filters.staff_type_ids.length > 0) {
      conditions.push({
        staff_type_id: { in: filters.staff_type_ids },
      });
    }
    
    if (conditions.length > 0) {
      userWhere.AND = conditions;
    }
  }
  
  // Get users to allocate
  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true },
  });
  
  let allocated = 0;
  let errors = 0;
  
  // Allocate for each user
  for (const user of users) {
    try {
      await allocateLeaveDays(user.id, leaveTypeId, year, days);
      
      // Log the allocation as an adjustment
      const balance = await getOrCreateLeaveBalance(user.id, leaveTypeId, year);
      await prisma.leaveBalanceAdjustment.create({
        data: {
          user_id: user.id,
          leave_type_id: leaveTypeId,
          year,
          adjustment: new Decimal(days),
          reason: `Bulk allocation: ${days} days for ${users.length} users`,
          adjusted_by: allocatedBy,
        },
      });
      
      allocated++;
    } catch (error) {
      console.error(`Error allocating leave for user ${user.id}:`, error);
      errors++;
    }
  }
  
  return { allocated, errors };
}
