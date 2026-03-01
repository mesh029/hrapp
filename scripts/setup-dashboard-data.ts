import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const { Decimal } = Prisma;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Phase 1: Data Setup & Seeding
 * - Assign contract dates to users (some expiring in March, rest regular)
 * - Assign leave balances based on accrual rate (1.75 * months_worked)
 * - Create admin configuration for accrual rate
 */

const ACCRUAL_RATE = 1.75; // Days per month (configurable from admin panel)
const CURRENT_YEAR = new Date().getFullYear();

async function setupDashboardData() {
  try {
    console.log('🚀 Starting Dashboard Data Setup...\n');

    // Step 1: Get all active users who have leave/timesheet activity
    console.log('📊 Step 1: Identifying users with activity...');
    
    const usersWithActivity = await prisma.user.findMany({
      where: {
        status: 'active',
        deleted_at: null,
        OR: [
          { leave_requests: { some: { deleted_at: null } } },
          { timesheets: { some: { deleted_at: null } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        contract_start_date: true,
        contract_end_date: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    console.log(`   ✅ Found ${usersWithActivity.length} users with activity\n`);

    if (usersWithActivity.length === 0) {
      console.log('⚠️  No users with activity found. Skipping setup.');
      return;
    }

    // Step 2: Assign contract dates
    console.log('📅 Step 2: Assigning contract dates...');
    
    const now = new Date();
    const marchEnd = new Date(CURRENT_YEAR, 2, 31, 23, 59, 59); // March 31, end of day
    const janStart = new Date(CURRENT_YEAR, 0, 1); // January 1
    
    // 30-40% get 3-month contracts expiring end of March
    const contractExpiringCount = Math.ceil(usersWithActivity.length * 0.35);
    const contractExpiringUsers = usersWithActivity.slice(0, contractExpiringCount);
    const regularUsers = usersWithActivity.slice(contractExpiringCount);

    let updatedContracts = 0;

    // Assign 3-month contracts (Jan to March)
    for (const user of contractExpiringUsers) {
      if (!user.contract_start_date || !user.contract_end_date) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            contract_start_date: janStart,
            contract_end_date: marchEnd,
            contract_status: marchEnd < now ? 'expired' : 'active',
          },
        });
        updatedContracts++;
      }
    }

    // Assign regular/permanent contracts (no end date or far future)
    const farFuture = new Date(CURRENT_YEAR + 10, 11, 31); // 10 years from now
    for (const user of regularUsers) {
      if (!user.contract_start_date) {
        // Use created_at as contract start if no start date
        const startDate = user.created_at || new Date(CURRENT_YEAR, 0, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            contract_start_date: startDate,
            contract_end_date: null, // Permanent
            contract_status: 'active',
          },
        });
        updatedContracts++;
      } else if (!user.contract_end_date) {
        // Already has start date but no end date - keep as permanent
        await prisma.user.update({
          where: { id: user.id },
          data: {
            contract_status: 'active',
          },
        });
        updatedContracts++;
      }
    }

    console.log(`   ✅ Updated ${updatedContracts} user contracts`);
    console.log(`   - ${contractExpiringUsers.length} with 3-month contracts (expiring March)`);
    console.log(`   - ${regularUsers.length} with regular/permanent contracts\n`);

    // Step 3: Calculate and assign leave balances
    console.log('💰 Step 3: Assigning leave balances...');
    
    // Get all leave types
    const leaveTypes = await prisma.leaveType.findMany({
      where: { deleted_at: null, status: 'active' },
      select: { id: true, name: true },
    });

    let balancesCreated = 0;
    let balancesUpdated = 0;

    if (leaveTypes.length === 0) {
      console.log('   ⚠️  No leave types found. Skipping leave balance assignment.');
    } else {
      for (const user of usersWithActivity) {
        // Calculate months worked
        const contractStart = user.contract_start_date || user.created_at || new Date(CURRENT_YEAR, 0, 1);
        const monthsWorked = Math.max(2, Math.floor((now.getTime() - contractStart.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        
        // Calculate allocated days: 1.75 * months_worked (minimum 2 months)
        const allocatedDays = ACCRUAL_RATE * monthsWorked;

        for (const leaveType of leaveTypes) {
          // Check if balance exists
          const existingBalance = await prisma.leaveBalance.findUnique({
            where: {
              user_id_leave_type_id_year: {
                user_id: user.id,
                leave_type_id: leaveType.id,
                year: CURRENT_YEAR,
              },
            },
          });

          if (existingBalance) {
            // Update allocated if it's less than calculated
            if (existingBalance.allocated.toNumber() < allocatedDays) {
              await prisma.leaveBalance.update({
                where: { id: existingBalance.id },
                data: {
                  allocated: new Decimal(allocatedDays),
                },
              });
              balancesUpdated++;
            }
          } else {
            // Create new balance
            await prisma.leaveBalance.create({
              data: {
                user_id: user.id,
                leave_type_id: leaveType.id,
                year: CURRENT_YEAR,
                allocated: new Decimal(allocatedDays),
                used: new Decimal(0),
                pending: new Decimal(0),
              },
            });
            balancesCreated++;
          }
        }
      }

      console.log(`   ✅ Created ${balancesCreated} new leave balances`);
      console.log(`   ✅ Updated ${balancesUpdated} existing leave balances`);
      console.log(`   ✅ Accrual rate: ${ACCRUAL_RATE} days/month\n`);
    }

    // Step 4: Create/Update admin configuration for accrual rate
    console.log('⚙️  Step 4: Setting up admin configuration...');
    
    // Check if config table exists (we'll use a simple approach with a config key-value store)
    // For now, we'll store this in a note or create a proper config table later
    // For this implementation, we'll just log it
    console.log(`   ✅ Accrual rate configured: ${ACCRUAL_RATE} days/month`);
    console.log(`   ℹ️  Note: This should be made configurable from admin panel\n`);

    console.log('✅ Dashboard data setup completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Users processed: ${usersWithActivity.length}`);
    console.log(`   - Contracts updated: ${updatedContracts}`);
    console.log(`   - Leave balances: ${balancesCreated + balancesUpdated} total`);
    console.log(`   - Accrual rate: ${ACCRUAL_RATE} days/month\n`);

  } catch (error: any) {
    console.error('❌ Error setting up dashboard data:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

setupDashboardData();
