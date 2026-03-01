import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { approveLeaveDays } from '../app/lib/services/leave-balance';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Fix Brian's leave balance - move approved leave days from pending to used
 */
async function fixBrianLeaveBalance() {
  try {
    console.log('🔧 Fixing Brian Kiprotich\'s leave balance...\n');

    // Find Brian
    const brian = await prisma.user.findFirst({
      where: {
        name: { contains: 'Brian', mode: 'insensitive' },
      },
    });

    if (!brian) {
      console.log('❌ Brian Kiprotich not found');
      return;
    }

    console.log(`✅ Found Brian: ${brian.id}\n`);

    // Get all approved leave requests for 2026
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        user_id: brian.id,
        status: 'Approved',
        deleted_at: null,
      },
      include: {
        leave_type: {
          select: { id: true, name: true },
        },
      },
    });

    console.log(`Found ${approvedLeaves.length} approved leave requests\n`);

    let totalFixed = 0;

    for (const leave of approvedLeaves) {
      const year = new Date(leave.start_date).getFullYear();
      const days = leave.days_requested.toNumber();

      // Check current balance
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          user_id_leave_type_id_year: {
            user_id: brian.id,
            leave_type_id: leave.leave_type_id,
            year,
          },
        },
      });

      if (balance) {
        const currentUsed = balance.used.toNumber();
        const currentPending = balance.pending.toNumber();

        console.log(`Processing: ${leave.leave_type.name} - ${days} days (${leave.start_date.toLocaleDateString()} - ${leave.end_date.toLocaleDateString()})`);
        console.log(`  Current: Used=${currentUsed}, Pending=${currentPending}`);

        // If this leave's days are still in pending, move them to used
        if (currentPending >= days) {
          await approveLeaveDays(brian.id, leave.leave_type_id, year, days);
          totalFixed += days;
          console.log(`  ✅ Moved ${days} days from pending to used`);
        } else if (currentUsed === 0 && currentPending > 0) {
          // Partial fix - move what's available
          await approveLeaveDays(brian.id, leave.leave_type_id, year, currentPending);
          totalFixed += currentPending;
          console.log(`  ⚠️  Only ${currentPending} days were in pending, moved those to used`);
        } else {
          console.log(`  ℹ️  Balance already correct or partially processed`);
        }
        console.log('');
      } else {
        console.log(`  ⚠️  No balance record found for ${leave.leave_type.name} in ${year}`);
      }
    }

    console.log(`\n✅ Fixed ${totalFixed} days total\n`);

    // Show updated balances
    const balances = await prisma.leaveBalance.findMany({
      where: {
        user_id: brian.id,
        year: 2026,
      },
      include: {
        leave_type: {
          select: { name: true },
        },
      },
    });

    console.log('Updated Leave Balances for 2026:');
    balances.forEach(balance => {
      const allocated = balance.allocated.toNumber();
      const used = balance.used.toNumber();
      const pending = balance.pending.toNumber();
      const available = allocated - used - pending;
      console.log(`  ${balance.leave_type.name}:`);
      console.log(`    Allocated: ${allocated} days`);
      console.log(`    Used: ${used} days`);
      console.log(`    Pending: ${pending} days`);
      console.log(`    Available: ${available} days`);
    });

  } catch (error: any) {
    console.error('❌ Error fixing leave balance:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixBrianLeaveBalance();
