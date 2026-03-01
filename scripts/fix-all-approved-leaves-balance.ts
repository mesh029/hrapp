import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { approveLeaveDays } from '../app/lib/services/leave-balance';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Fix all approved leave balances - move approved leave days from pending to used
 * This fixes the issue where approved leaves weren't updating the balance correctly
 */
async function fixAllApprovedLeaves() {
  try {
    console.log('🔧 Fixing all approved leave balances...\n');

    // Get all approved leave requests
    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'Approved',
        deleted_at: null,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        leave_type: {
          select: { id: true, name: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    console.log(`Found ${approvedLeaves.length} approved leave requests\n`);

    let totalFixed = 0;
    let totalSkipped = 0;

    for (const leave of approvedLeaves) {
      const year = new Date(leave.start_date).getFullYear();
      const days = leave.days_requested.toNumber();

      // Check current balance
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          user_id_leave_type_id_year: {
            user_id: leave.user_id,
            leave_type_id: leave.leave_type_id,
            year,
          },
        },
      });

      if (!balance) {
        console.log(`⚠️  No balance found for ${leave.user.name} - ${leave.leave_type.name} (${year})`);
        continue;
      }

      const currentUsed = balance.used.toNumber();
      const currentPending = balance.pending.toNumber();
      const allocated = balance.allocated.toNumber();

      // Check if this leave's days are already in used
      // We need to check if the days are in pending and should be moved to used
      if (currentPending >= days && currentUsed === 0) {
        // All days are in pending, move them to used
        await approveLeaveDays(leave.user_id, leave.leave_type_id, year, days);
        totalFixed += days;
        console.log(`✅ ${leave.user.name} - ${leave.leave_type.name}: Moved ${days} days from pending to used`);
      } else if (currentPending > 0 && currentUsed < days) {
        // Partial fix - move what's available in pending
        const toMove = Math.min(currentPending, days - currentUsed);
        await approveLeaveDays(leave.user_id, leave.leave_type_id, year, toMove);
        totalFixed += toMove;
        console.log(`⚠️  ${leave.user.name} - ${leave.leave_type.name}: Moved ${toMove} days (partial fix)`);
      } else {
        totalSkipped++;
        // Already processed or balance is correct
      }
    }

    console.log(`\n✅ Fixed ${totalFixed} days total`);
    console.log(`ℹ️  Skipped ${totalSkipped} leaves (already processed or correct)\n`);

  } catch (error: any) {
    console.error('❌ Error fixing leave balances:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixAllApprovedLeaves();
