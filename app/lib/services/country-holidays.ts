import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;
import { getWorkHoursForDate } from './work-hours';

/**
 * Get country holidays for a date range
 * Returns both recurring and one-time holidays
 */
export async function getCountryHolidays(
  countryCode: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: Date; name: string; hours: number; isRecurring: boolean }>> {
  const holidays: Array<{ date: Date; name: string; hours: number; isRecurring: boolean }> = [];

  // Get recurring holidays (check if they fall in the date range)
  const recurringHolidays = await prisma.countryHoliday.findMany({
    where: {
      country_code: countryCode,
      is_recurring: true,
    },
  });

  const currentYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Generate recurring holidays for each year in range
  for (let year = currentYear; year <= endYear; year++) {
    for (const holiday of recurringHolidays) {
      const holidayDate = new Date(holiday.date);
      holidayDate.setFullYear(year);

      if (holidayDate >= startDate && holidayDate <= endDate) {
        holidays.push({
          date: holidayDate,
          name: holiday.name,
          hours: holiday.hours.toNumber(),
          isRecurring: true,
        });
      }
    }
  }

  // Get one-time holidays in the date range
  const oneTimeHolidays = await prisma.countryHoliday.findMany({
    where: {
      country_code: countryCode,
      is_recurring: false,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  for (const holiday of oneTimeHolidays) {
    holidays.push({
      date: holiday.date,
      name: holiday.name,
      hours: holiday.hours.toNumber(),
      isRecurring: false,
    });
  }

  // Sort by date
  holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

  return holidays;
}

/**
 * Create a country holiday
 */
export async function createCountryHoliday(data: {
  countryCode: string;
  name: string;
  date: Date;
  hours?: number; // If not provided, will use work hours config default
  isRecurring?: boolean;
}) {
  const hours = data.hours ?? 8.5; // Default to 8.5 hours if not specified

  return await prisma.countryHoliday.create({
    data: {
      country_code: data.countryCode,
      name: data.name,
      date: data.date,
      hours: new Decimal(hours),
      is_recurring: data.isRecurring ?? true,
    },
  });
}

/**
 * Seed Kenya national holidays
 * These are the standard recurring holidays in Kenya
 */
export async function seedKenyaHolidays() {
  const currentYear = new Date().getFullYear();
  const kenyaHolidays = [
    { name: 'New Year\'s Day', month: 0, day: 1 }, // January 1
    { name: 'Good Friday', month: 2, day: 29 }, // Variable - approximate, will need manual adjustment
    { name: 'Easter Monday', month: 3, day: 1 }, // Variable - approximate
    { name: 'Labour Day', month: 4, day: 1 }, // May 1
    { name: 'Madaraka Day', month: 5, day: 1 }, // June 1
    { name: 'Eid ul-Fitr', month: 2, day: 10 }, // Variable - approximate
    { name: 'Eid ul-Adha', month: 5, day: 16 }, // Variable - approximate
    { name: 'Mashujaa Day', month: 9, day: 20 }, // October 20
    { name: 'Jamhuri Day', month: 11, day: 12 }, // December 12
    { name: 'Christmas Day', month: 11, day: 25 }, // December 25
    { name: 'Boxing Day', month: 11, day: 26 }, // December 26
  ];

  const seeded: string[] = [];

  for (const holiday of kenyaHolidays) {
    // Check if already exists
    const existing = await prisma.countryHoliday.findFirst({
      where: {
        country_code: 'KE',
        name: holiday.name,
        is_recurring: true,
      },
    });

    if (!existing) {
      // Use a representative date (current year)
      const date = new Date(currentYear, holiday.month, holiday.day);
      
      await prisma.countryHoliday.create({
        data: {
          country_code: 'KE',
          name: holiday.name,
          date: date,
          hours: new Decimal(8.5), // Default 8.5 hours for holidays
          is_recurring: true,
        },
      });
      seeded.push(holiday.name);
    }
  }

  return seeded;
}
