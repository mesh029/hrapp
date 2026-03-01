import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Enable timesheet submission for the current month
 * This script helps resolve "Timesheet submission is not enabled for this period" errors
 */
async function enableCurrentPeriod() {
  try {
    console.log('🔧 Enabling timesheet submission for current period...\n');

    // Get current month start and end
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    console.log(`Period: ${currentMonthStart.toLocaleDateString()} - ${currentMonthEnd.toLocaleDateString()}\n`);

    // Check if period exists
    let period = await prisma.timesheetPeriod.findFirst({
      where: {
        period_start: { lte: currentMonthStart },
        period_end: { gte: currentMonthEnd },
      },
    });

    if (period) {
      if (period.submission_enabled) {
        console.log('✅ Timesheet submission is already enabled for this period');
        console.log(`   Period ID: ${period.id}`);
        console.log(`   Enabled: ${period.submission_enabled}`);
        return;
      }

      // Enable existing period
      period = await prisma.timesheetPeriod.update({
        where: { id: period.id },
        data: {
          submission_enabled: true,
          enabled_at: new Date(),
          enabled_by: null, // System enabled
        },
      });

      console.log('✅ Enabled timesheet submission for existing period');
      console.log(`   Period ID: ${period.id}`);
    } else {
      // Create new period
      period = await prisma.timesheetPeriod.create({
        data: {
          period_start: currentMonthStart,
          period_end: currentMonthEnd,
          submission_enabled: true,
          enabled_at: new Date(),
          enabled_by: null, // System enabled
        },
      });

      console.log('✅ Created and enabled new timesheet period');
      console.log(`   Period ID: ${period.id}`);
    }

    console.log(`\n✅ Timesheet submission is now enabled for ${currentMonthStart.toLocaleDateString()} - ${currentMonthEnd.toLocaleDateString()}`);
    console.log('   Users can now submit timesheets for this period.\n');

  } catch (error: any) {
    console.error('❌ Error enabling timesheet period:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

enableCurrentPeriod();
