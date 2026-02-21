import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;

/**
 * Reset leave balance for a user
 * If leaveTypeId is null, resets all leave types
 */
export async function resetLeaveBalance(
  userId: string,
  leaveTypeId: string | null,
  reason: string,
  resetBy: string | null = null // null = automatic
): Promise<void> {
  // Get all leave balances for user
  const where: any = { user_id: userId };
  if (leaveTypeId) {
    where.leave_type_id = leaveTypeId;
  }

  const balances = await prisma.leaveBalance.findMany({
    where,
  });

  // Reset all balances to 0
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
      user_id: userId,
      leave_type_id: leaveTypeId,
      reset_type: resetBy ? 'manual' : 'automatic',
      reason,
      reset_by: resetBy,
    },
  });
}

/**
 * Process expired contracts and reset leave balances
 */
export async function processExpiredContracts(): Promise<{
  processed: number;
  errors: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find users with expired contracts
  const expiredUsers = await prisma.user.findMany({
    where: {
      contract_end_date: {
        lte: today,
      },
      contract_status: {
        not: 'expired',
      },
      status: 'active',
      deleted_at: null,
    },
  });

  let processed = 0;
  let errors = 0;

  for (const user of expiredUsers) {
    try {
      // Update contract status
      await prisma.user.update({
        where: { id: user.id },
        data: {
          contract_status: 'expired',
        },
      });

      // Reset all leave balances
      await resetLeaveBalance(
        user.id,
        null, // All leave types
        `Contract expired on ${user.contract_end_date?.toISOString().split('T')[0]}`,
        null // Automatic
      );

      processed++;
    } catch (error) {
      console.error(`Error processing expired contract for user ${user.id}:`, error);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Update contract status based on dates
 */
export async function updateContractStatus(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let contractStatus: string | null = null;

  if (!user.contract_start_date) {
    contractStatus = 'unknown';
  } else if (user.contract_end_date) {
    const endDate = new Date(user.contract_end_date);
    endDate.setHours(0, 0, 0, 0);

    if (endDate < today) {
      contractStatus = 'expired';
    } else {
      contractStatus = 'active';
    }
  } else {
    contractStatus = 'active'; // Permanent employee
  }

  await prisma.user.update({
    where: { id: userId },
    data: { contract_status: contractStatus },
  });
}
