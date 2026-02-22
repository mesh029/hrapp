import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;

/**
 * Get work hours configuration for a specific staff type and location
 * Priority: location-specific > staff-type-specific > default
 */
export async function getWorkHoursConfig(
  staffTypeId: string | null,
  locationId: string | null
): Promise<Map<number, Prisma.Decimal>> {
  const configMap = new Map<number, Prisma.Decimal>();

  // Priority 1: Location-specific configuration (highest priority)
  if (locationId) {
    const locationConfigs = await prisma.workHoursConfig.findMany({
      where: {
        location_id: locationId,
        deleted_at: null,
        is_active: true,
      },
      orderBy: { day_of_week: 'asc' },
    });

    for (const config of locationConfigs) {
      configMap.set(config.day_of_week, config.hours);
    }

    // If we have location-specific configs, return them
    if (configMap.size > 0) {
      return configMap;
    }
  }

  // Priority 2: Staff-type-specific configuration
  if (staffTypeId) {
    const staffTypeConfigs = await prisma.workHoursConfig.findMany({
      where: {
        staff_type_id: staffTypeId,
        location_id: null, // Only staff-type-specific, not location-specific
        deleted_at: null,
        is_active: true,
      },
      orderBy: { day_of_week: 'asc' },
    });

    for (const config of staffTypeConfigs) {
      configMap.set(config.day_of_week, config.hours);
    }
  }

  return configMap;
}

/**
 * Calculate total work hours for a date range
 */
export async function calculateWorkHours(
  startDate: Date,
  endDate: Date,
  staffTypeId: string | null,
  locationId: string | null
): Promise<{ totalHours: number; dailyBreakdown: Array<{ date: Date; dayOfWeek: number; hours: number }> }> {
  const configMap = await getWorkHoursConfig(staffTypeId, locationId);
  const dailyBreakdown: Array<{ date: Date; dayOfWeek: number; hours: number }> = [];
  let totalHours = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0=Sunday, 6=Saturday
    const hours = configMap.get(dayOfWeek)?.toNumber() || 0;

    dailyBreakdown.push({
      date: new Date(currentDate),
      dayOfWeek,
      hours,
    });

    totalHours += hours;

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { totalHours, dailyBreakdown };
}

/**
 * Calculate work hours for a specific date
 */
export async function getWorkHoursForDate(
  date: Date,
  staffTypeId: string | null,
  locationId: string | null
): Promise<number> {
  const configMap = await getWorkHoursConfig(staffTypeId, locationId);
  const dayOfWeek = date.getDay();
  return configMap.get(dayOfWeek)?.toNumber() || 0;
}

/**
 * Calculate weekly work hours for a staff type and location
 */
export async function getWeeklyWorkHours(
  staffTypeId: string | null,
  locationId: string | null
): Promise<number> {
  const configMap = await getWorkHoursConfig(staffTypeId, locationId);
  let total = 0;

  // Sum hours for all days of the week (0-6)
  for (let day = 0; day <= 6; day++) {
    const hours = configMap.get(day)?.toNumber() || 0;
    total += hours;
  }

  return total;
}

/**
 * Get work hours breakdown by day of week
 */
export async function getWorkHoursBreakdown(
  staffTypeId: string | null,
  locationId: string | null
): Promise<Array<{ dayOfWeek: number; dayName: string; hours: number }>> {
  const configMap = await getWorkHoursConfig(staffTypeId, locationId);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const breakdown: Array<{ dayOfWeek: number; dayName: string; hours: number }> = [];

  for (let day = 0; day <= 6; day++) {
    breakdown.push({
      dayOfWeek: day,
      dayName: dayNames[day],
      hours: configMap.get(day)?.toNumber() || 0,
    });
  }

  return breakdown;
}
