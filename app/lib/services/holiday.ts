import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;
import { getWorkHoursForDate } from './work-hours';
import { getCountryHolidays } from './country-holidays';

/**
 * Create a holiday (manual or from country config)
 */
export async function createHoliday(data: {
  name: string;
  date: Date;
  locationId?: string;
  hours?: number;
  isSystem?: boolean;
  countryHolidayId?: string;
  createdBy: string;
}) {
  // If hours not provided, try to get from work hours config
  // For now, default to 8.5 hours
  const hours = data.hours ?? 8.5;

  return await prisma.holiday.create({
    data: {
      name: data.name,
      date: data.date,
      location_id: data.locationId ?? null,
      hours: new Decimal(hours),
      is_system: data.isSystem ?? false,
      country_holiday_id: data.countryHolidayId ?? null,
      created_by: data.createdBy,
    },
  });
}

/**
 * Sync country holidays to location holidays for a date range
 * This creates Holiday records from CountryHoliday records
 */
export async function syncCountryHolidaysToLocation(
  countryCode: string,
  locationId: string,
  startDate: Date,
  endDate: Date,
  createdBy: string
): Promise<number> {
  const countryHolidays = await getCountryHolidays(countryCode, startDate, endDate);
  let synced = 0;

  for (const countryHoliday of countryHolidays) {
    // Check if holiday already exists for this location and date
    const existing = await prisma.holiday.findFirst({
      where: {
        location_id: locationId,
        date: countryHoliday.date,
        deleted_at: null,
      },
    });

    if (!existing) {
      // Find the country holiday record
      const countryHolidayRecord = await prisma.countryHoliday.findFirst({
        where: {
          country_code: countryCode,
          name: countryHoliday.name,
          is_recurring: countryHoliday.isRecurring,
        },
      });

      await prisma.holiday.create({
        data: {
          name: countryHoliday.name,
          date: countryHoliday.date,
          location_id: locationId,
          hours: new Decimal(countryHoliday.hours),
          is_system: true,
          country_holiday_id: countryHolidayRecord?.id ?? null,
          created_by: createdBy,
        },
      });
      synced++;
    }
  }

  return synced;
}

/**
 * Get holidays for a location and date range
 */
export async function getHolidaysForLocation(
  locationId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ id: string; name: string; date: Date; hours: number; isSystem: boolean }>> {
  const holidays = await prisma.holiday.findMany({
    where: {
      location_id: locationId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      deleted_at: null,
    },
    orderBy: { date: 'asc' },
  });

  return holidays.map((h) => ({
    id: h.id,
    name: h.name,
    date: h.date,
    hours: h.hours.toNumber(),
    isSystem: h.is_system,
  }));
}

/**
 * Get holidays for a date range (all locations or specific location)
 */
export async function getHolidays(
  startDate: Date,
  endDate: Date,
  locationId?: string
): Promise<Array<{ id: string; name: string; date: Date; hours: number; locationId: string | null; isSystem: boolean }>> {
  const holidays = await prisma.holiday.findMany({
    where: {
      ...(locationId ? { location_id: locationId } : {}),
      date: {
        gte: startDate,
        lte: endDate,
      },
      deleted_at: null,
    },
    include: {
      location: true,
    },
    orderBy: { date: 'asc' },
  });

  return holidays.map((h) => ({
    id: h.id,
    name: h.name,
    date: h.date,
    hours: h.hours.toNumber(),
    locationId: h.location_id,
    isSystem: h.is_system,
  }));
}

/**
 * Update a holiday
 */
export async function updateHoliday(
  id: string,
  data: {
    name?: string;
    date?: Date;
    hours?: number;
  }
) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.hours !== undefined) updateData.hours = new Decimal(data.hours);

  return await prisma.holiday.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Soft delete a holiday
 */
export async function deleteHoliday(id: string) {
  return await prisma.holiday.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
}
