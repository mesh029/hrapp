import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }) as unknown as PrismaClient;

async function main() {
  const timesheetId = 'd5596cfd-1769-46ac-a408-274db9c8bda8';

  console.log(`Fetching timesheet ${timesheetId}...`);
  
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      entries: {
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!timesheet) {
    console.error('Timesheet not found');
    process.exit(1);
  }

  console.log(`Found ${timesheet.entries.length} entries`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const entry of timesheet.entries) {
    // Skip entries that have leave or holiday (they're auto-populated)
    const hasLeave = entry.leave_hours.toNumber() > 0;
    const hasHoliday = entry.holiday_hours.toNumber() > 0;
    const hasWorkHours = entry.work_hours.toNumber() > 0;

    if (hasLeave || hasHoliday) {
      console.log(`Skipping ${entry.date.toISOString().split('T')[0]} - has leave or holiday`);
      skippedCount++;
      continue;
    }

    if (hasWorkHours) {
      console.log(`Skipping ${entry.date.toISOString().split('T')[0]} - already has ${entry.work_hours.toNumber()} work hours`);
      skippedCount++;
      continue;
    }

    // Update with 8 hours
    const workHours = new Prisma.Decimal(8);
    const totalHours = workHours
      .plus(entry.leave_hours)
      .plus(entry.holiday_hours)
      .plus(entry.weekend_extra_hours)
      .plus(entry.overtime_hours);

    await prisma.timesheetEntry.update({
      where: { id: entry.id },
      data: {
        work_hours: workHours,
        total_hours: totalHours,
      },
    });

    console.log(`Updated ${entry.date.toISOString().split('T')[0]} with 8 work hours`);
    updatedCount++;
  }

  // Recalculate timesheet total
  const updatedEntries = await prisma.timesheetEntry.findMany({
    where: { timesheet_id: timesheetId },
  });

  const totalHours = updatedEntries.reduce(
    (sum, entry) => sum.plus(entry.total_hours),
    new Prisma.Decimal(0)
  );

  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: { total_hours: totalHours },
  });

  console.log(`\nSummary:`);
  console.log(`- Updated: ${updatedCount} entries`);
  console.log(`- Skipped: ${skippedCount} entries`);
  console.log(`- Total hours: ${totalHours.toNumber()}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
