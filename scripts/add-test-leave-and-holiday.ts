#!/usr/bin/env tsx
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Adding test data for Lucy: Approved leave days and holiday\n');

  // Find Lucy
  const lucy = await prisma.user.findFirst({
    where: { 
      email: { contains: 'lucy', mode: 'insensitive' }
    },
    include: {
      primary_location: true,
    },
  });

  if (!lucy) {
    console.error('❌ Lucy user not found. Please check the email.');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Found user: ${lucy.name} (${lucy.email})`);
  console.log(`   Location: ${lucy.primary_location?.name || 'No location'}\n`);

  // Get an active leave type
  const leaveType = await prisma.leaveType.findFirst({
    where: { status: 'active' },
  });

  if (!leaveType) {
    console.error('❌ No active leave type found. Please create one first.');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Using leave type: ${leaveType.name}\n`);

  // Calculate dates: 3 consecutive days starting from tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const endDate = new Date(tomorrow);
  endDate.setDate(endDate.getDate() + 2); // 3 days total
  endDate.setHours(23, 59, 59, 999);

  console.log(`📅 Creating approved leave request:`);
  console.log(`   Start: ${tomorrow.toISOString().split('T')[0]}`);
  console.log(`   End: ${endDate.toISOString().split('T')[0]}`);
  console.log(`   Days: 3\n`);

  // Create approved leave request
  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      user_id: lucy.id,
      leave_type_id: leaveType.id,
      location_id: lucy.primary_location_id || undefined,
      start_date: tomorrow,
      end_date: endDate,
      days_requested: new Prisma.Decimal(3),
      reason: 'Test approved leave for timesheet auto-population',
      status: 'Approved',
    },
  });

  console.log(`✅ Created approved leave request: ${leaveRequest.id}`);
  console.log(`   Status: ${leaveRequest.status}\n`);

  // Create a test holiday (one day, in the same period or nearby)
  const holidayDate = new Date(tomorrow);
  holidayDate.setDate(holidayDate.getDate() + 5); // 5 days after leave starts
  holidayDate.setHours(0, 0, 0, 0);

  console.log(`🎉 Creating test holiday:`);
  console.log(`   Date: ${holidayDate.toISOString().split('T')[0]}\n`);

  // Check if location has a country
  const location = lucy.primary_location;
  if (!location) {
    console.error('❌ Lucy has no primary location. Cannot create holiday.');
    await prisma.$disconnect();
    return;
  }

  // Get or create country holiday
  let countryHoliday = await prisma.countryHoliday.findFirst({
    where: {
      country_code: 'KE', // Kenya
      date: holidayDate,
    },
  });

  if (!countryHoliday) {
    countryHoliday = await prisma.countryHoliday.create({
      data: {
        country_code: 'KE',
        name: 'Test Holiday for Timesheet',
        date: holidayDate,
        hours: new Prisma.Decimal(8),
        is_recurring: false,
      },
    });
    console.log(`✅ Created country holiday: ${countryHoliday.name}`);
  } else {
    console.log(`✅ Found existing country holiday: ${countryHoliday.name}`);
  }

  // Create/sync holiday for location (using Holiday model, not LocationHoliday)
  const existingHoliday = await prisma.holiday.findFirst({
    where: {
      location_id: location.id,
      date: holidayDate,
      deleted_at: null,
    },
  });

  if (!existingHoliday) {
    const locationHoliday = await prisma.holiday.create({
      data: {
        name: countryHoliday.name,
        date: holidayDate,
        location_id: location.id,
        hours: new Prisma.Decimal(8), // Full day holiday
        is_system: true,
        country_holiday_id: countryHoliday.id,
        created_by: lucy.id,
      },
    });
    console.log(`✅ Created location holiday: ${locationHoliday.id}`);
  } else {
    console.log(`✅ Location holiday already exists: ${existingHoliday.id}`);
  }

  console.log('');

  console.log('📋 Summary:');
  console.log(`   ✅ Approved leave: ${tomorrow.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (3 days)`);
  console.log(`   ✅ Test holiday: ${holidayDate.toISOString().split('T')[0]}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Create a timesheet for Lucy covering these dates`);
  console.log(`   2. The approved leave days should auto-populate with leave hours`);
  console.log(`   3. The holiday day should auto-populate with holiday hours`);
  console.log(`   4. Those days should be marked as non-editable\n`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
