import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getWorkHoursForDate } from './work-hours';

const { Decimal } = Prisma;
import { getHolidaysForLocation } from './holiday';
import { syncCountryHolidaysToLocation } from './holiday';

/**
 * Create a timesheet with entries for all days in the period
 * Auto-populates leaves and holidays
 */
export async function createTimesheet(data: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  locationId: string;
}): Promise<{ id: string; entriesCount: number }> {
  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    include: {
      staff_type: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if timesheet already exists
  const existing = await prisma.timesheet.findFirst({
    where: {
      user_id: data.userId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      deleted_at: null,
    },
  });

  if (existing) {
    throw new Error('Timesheet already exists for this period');
  }

  // Sync country holidays to location (if not already synced)
  // This ensures all country holidays are available as Holiday records
  await syncCountryHolidaysToLocation(
    'KE', // Default country code (Kenya)
    data.locationId,
    data.periodStart,
    data.periodEnd,
    data.userId // Created by user
  );

  // Create timesheet
  const timesheet = await prisma.timesheet.create({
    data: {
      user_id: data.userId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      location_id: data.locationId,
      status: 'Draft',
    },
  });

  // Get holidays for this location and period
  const holidays = await getHolidaysForLocation(
    data.locationId,
    data.periodStart,
    data.periodEnd
  );

  // Get approved leave requests for this user in this period
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      user_id: data.userId,
      status: 'Approved',
      start_date: { lte: data.periodEnd },
      end_date: { gte: data.periodStart },
      deleted_at: null,
    },
    include: {
      leave_type: true,
    },
  });

  // Create entries for all days in period
  const entries: Array<{
    timesheet_id: string;
    date: Date;
    work_hours: Prisma.Decimal;
    leave_hours: Prisma.Decimal;
    holiday_hours: Prisma.Decimal;
    weekend_extra_hours: Prisma.Decimal;
    overtime_hours: Prisma.Decimal;
    total_hours: Prisma.Decimal;
    expected_hours: Prisma.Decimal;
    leave_request_id: string | null;
    holiday_id: string | null;
    is_auto_added: boolean;
  }> = [];

  const currentDate = new Date(data.periodStart);
  while (currentDate <= data.periodEnd) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();

    // Get expected hours from work hours config
    const expectedHours = await getWorkHoursForDate(
      currentDate,
      user.staff_type_id ?? null,
      data.locationId
    );

    // Check if this date is a holiday
    const holiday = holidays.find(
      (h) => h.date.toISOString().split('T')[0] === dateStr
    );

    // Check if this date is within an approved leave
    let leaveRequest: typeof approvedLeaves[0] | null = null;
    let leaveHours = new Decimal(0);

    for (const leave of approvedLeaves) {
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date);
      leaveStart.setHours(0, 0, 0, 0);
      leaveEnd.setHours(23, 59, 59, 999);
      const checkDate = new Date(currentDate);
      checkDate.setHours(0, 0, 0, 0);

      if (checkDate >= leaveStart && checkDate <= leaveEnd) {
        leaveRequest = leave;
        // IMPORTANT: All leave types share the same hours - they use the expected work hours
        // for that day from work hours config (based on staff type + location + day of week).
        // Leave types (sick, vacation, etc.) do NOT have their own specific hours.
        leaveHours = new Decimal(expectedHours);
        break;
      }
    }

    // Calculate total hours
    const workHours = new Decimal(0); // User will fill this
    const holidayHours = holiday ? new Decimal(holiday.hours) : new Decimal(0);
    const weekendExtraHours = new Decimal(0);
    const overtimeHours = new Decimal(0);

    const totalHours = workHours
      .plus(leaveHours)
      .plus(holidayHours)
      .plus(weekendExtraHours)
      .plus(overtimeHours);

    entries.push({
      timesheet_id: timesheet.id,
      date: new Date(currentDate),
      work_hours: workHours,
      leave_hours: leaveHours,
      holiday_hours: holidayHours,
      weekend_extra_hours: weekendExtraHours,
      overtime_hours: overtimeHours,
      total_hours: totalHours,
      expected_hours: new Decimal(expectedHours),
      leave_request_id: leaveRequest?.id ?? null,
      holiday_id: holiday?.id ?? null,
      is_auto_added: leaveRequest !== null || holiday !== null,
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Bulk create entries
  await prisma.timesheetEntry.createMany({
    data: entries,
  });

  // Calculate total hours for timesheet
  const totalHours = entries.reduce(
    (sum, entry) => sum.plus(entry.total_hours),
    new Decimal(0)
  );

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { total_hours: totalHours },
  });

  return {
    id: timesheet.id,
    entriesCount: entries.length,
  };
}

/**
 * Update timesheet entries (bulk update)
 */
export async function updateTimesheetEntries(
  timesheetId: string,
  entries: Array<{
    date: string; // YYYY-MM-DD
    work_hours: number;
    description?: string;
  }>
): Promise<void> {
  const timesheet = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      entries: true,
    },
  });

  if (!timesheet) {
    throw new Error('Timesheet not found');
  }

  // Update each entry
  for (const entryData of entries) {
    const entryDate = new Date(entryData.date);
    const existingEntry = timesheet.entries.find(
      (e) => e.date.toISOString().split('T')[0] === entryData.date
    );

    if (!existingEntry) {
      throw new Error(`Entry not found for date ${entryData.date}`);
    }

    // Recalculate total hours
    const workHours = new Decimal(entryData.work_hours);
    const leaveHours = existingEntry.leave_hours;
    const holidayHours = existingEntry.holiday_hours;
    const weekendExtraHours = existingEntry.weekend_extra_hours;
    const overtimeHours = existingEntry.overtime_hours;

    const totalHours = workHours
      .plus(leaveHours)
      .plus(holidayHours)
      .plus(weekendExtraHours)
      .plus(overtimeHours);

    await prisma.timesheetEntry.update({
      where: { id: existingEntry.id },
      data: {
        work_hours: workHours,
        total_hours: totalHours,
        description: entryData.description ?? existingEntry.description,
      },
    });
  }

  // Recalculate timesheet total
  const updatedEntries = await prisma.timesheetEntry.findMany({
    where: { timesheet_id: timesheetId },
  });

  const totalHours = updatedEntries.reduce(
    (sum, entry) => sum.plus(entry.total_hours),
    new Decimal(0)
  );

  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: { total_hours: totalHours },
  });
}

/**
 * Add leave entry to timesheet (called when leave is approved)
 */
export async function addLeaveEntryToTimesheet(
  leaveRequestId: string
): Promise<void> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      user: {
        include: {
          staff_type: true,
        },
      },
    },
  });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  // Find or create timesheet for this period
  // We'll create it if it doesn't exist (auto-create)
  let timesheet = await prisma.timesheet.findFirst({
    where: {
      user_id: leaveRequest.user_id,
      period_start: { lte: leaveRequest.start_date },
      period_end: { gte: leaveRequest.end_date },
      deleted_at: null,
    },
  });

  if (!timesheet) {
    // Auto-create timesheet
    const result = await createTimesheet({
      userId: leaveRequest.user_id,
      periodStart: leaveRequest.start_date,
      periodEnd: leaveRequest.end_date,
      locationId: leaveRequest.location_id,
    });
    timesheet = await prisma.timesheet.findUnique({
      where: { id: result.id },
    });
  }

  if (!timesheet) {
    throw new Error('Failed to create timesheet');
  }

  // Update entries for leave period
  const currentDate = new Date(leaveRequest.start_date);
  const endDate = new Date(leaveRequest.end_date);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Get expected hours for this day
    // IMPORTANT: All leave types share the same hours - they use the expected work hours
    // for that day from work hours config. Leave types do NOT have their own specific hours.
    const expectedHours = await getWorkHoursForDate(
      currentDate,
      leaveRequest.user.staff_type_id ?? null,
      leaveRequest.location_id
    );

    // Find or create entry for this date
    let entry = await prisma.timesheetEntry.findFirst({
      where: {
        timesheet_id: timesheet.id,
        date: currentDate,
      },
    });

    if (!entry) {
      // Create entry if it doesn't exist
      entry = await prisma.timesheetEntry.create({
        data: {
          timesheet_id: timesheet.id,
          date: currentDate,
          work_hours: new Decimal(0),
          leave_hours: new Decimal(expectedHours),
          holiday_hours: new Decimal(0),
          weekend_extra_hours: new Decimal(0),
          overtime_hours: new Decimal(0),
          total_hours: new Decimal(expectedHours),
          expected_hours: new Decimal(expectedHours),
          leave_request_id: leaveRequest.id,
          is_auto_added: true,
        },
      });
    } else {
      // Update existing entry
      const leaveHours = new Decimal(expectedHours);
      const totalHours = entry.work_hours
        .plus(leaveHours)
        .plus(entry.holiday_hours)
        .plus(entry.weekend_extra_hours)
        .plus(entry.overtime_hours);

      await prisma.timesheetEntry.update({
        where: { id: entry.id },
        data: {
          leave_hours: leaveHours,
          leave_request_id: leaveRequest.id,
          total_hours: totalHours,
          is_auto_added: true,
        },
      });
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Recalculate timesheet total
  const allEntries = await prisma.timesheetEntry.findMany({
    where: { timesheet_id: timesheet.id },
  });

  const totalHours = allEntries.reduce(
    (sum, entry) => sum.plus(entry.total_hours),
    new Decimal(0)
  );

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { total_hours: totalHours },
  });
}
