import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkBrianData() {
  try {
    console.log('🔍 Checking Brian Kiprotich\'s data...\n');

    // Find Brian
    const brian = await prisma.user.findFirst({
      where: {
        name: { contains: 'Brian', mode: 'insensitive' },
      },
      include: {
        primary_location: {
          select: { id: true, name: true },
        },
        leave_balances: {
          where: { year: 2026 },
          include: {
            leave_type: {
              select: { id: true, name: true },
            },
          },
        },
        leave_requests: {
          where: {
            deleted_at: null,
            status: { in: ['Approved', 'Submitted', 'UnderReview'] },
          },
          include: {
            leave_type: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!brian) {
      console.log('❌ Brian Kiprotich not found');
      return;
    }

    console.log('✅ Found Brian Kiprotich:');
    console.log(`   ID: ${brian.id}`);
    console.log(`   Email: ${brian.email}`);
    console.log(`   Primary Location ID: ${brian.primary_location_id}`);
    console.log(`   Primary Location Name: ${brian.primary_location?.name || 'NOT SET'}`);
    console.log(`   Status: ${brian.status}\n`);

    // Check all locations
    const allLocations = await prisma.location.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
    });
    console.log('Available Locations:');
    allLocations.forEach(loc => {
      console.log(`   - ${loc.name} (${loc.id})`);
    });
    console.log('');

    // Check leave balances
    console.log('Leave Balances for 2026:');
    if (brian.leave_balances.length === 0) {
      console.log('   ⚠️  No leave balances found for 2026');
    } else {
      brian.leave_balances.forEach(balance => {
        const allocated = balance.allocated.toNumber();
        const used = balance.used.toNumber();
        const pending = balance.pending.toNumber();
        const available = allocated - used - pending;
        console.log(`   ${balance.leave_type.name}:`);
        console.log(`     Allocated: ${allocated} days`);
        console.log(`     Used: ${used} days`);
        console.log(`     Pending: ${pending} days`);
        console.log(`     Available: ${available} days`);
      });
    }
    console.log('');

    // Check approved leave requests
    console.log('Approved/Active Leave Requests:');
    if (brian.leave_requests.length === 0) {
      console.log('   No approved leave requests found');
    } else {
      brian.leave_requests.forEach(req => {
        console.log(`   ${req.leave_type.name}: ${req.days_requested.toNumber()} days (${req.status})`);
        console.log(`     Dates: ${req.start_date.toLocaleDateString()} - ${req.end_date.toLocaleDateString()}`);
      });
    }
    console.log('');

    // Check contract dates
    console.log('Contract Information:');
    console.log(`   Start Date: ${brian.contract_start_date?.toLocaleDateString() || 'NOT SET'}`);
    console.log(`   End Date: ${brian.contract_end_date?.toLocaleDateString() || 'NOT SET'}`);
    console.log(`   Status: ${brian.contract_status || 'NOT SET'}\n`);

    // Check if location issue
    if (!brian.primary_location_id) {
      console.log('❌ ISSUE: Brian has no primary_location_id assigned!');
      console.log('   This is why the location error occurs.\n');
      
      // Try to find Nairobi location
      const nairobi = await prisma.location.findFirst({
        where: {
          name: { contains: 'Nairobi', mode: 'insensitive' },
        },
      });
      
      if (nairobi) {
        console.log(`✅ Found Nairobi location: ${nairobi.id}`);
        console.log('   Would need to update Brian\'s primary_location_id to:', nairobi.id);
      }
    } else {
      console.log('✅ Brian has a primary location assigned');
    }

  } catch (error: any) {
    console.error('❌ Error checking Brian\'s data:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkBrianData();
