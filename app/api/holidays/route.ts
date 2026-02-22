import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { getHolidays, createHoliday } from '@/lib/services/holiday';
import { createHolidaySchema, paginationSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';

/**
 * GET /api/holidays
 * List holidays (with optional date range and location filter)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasPermission = await checkPermission(user, 'holidays.read', { locationId });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const filterLocationId = searchParams.get('location_id');

    if (!startDate || !endDate) {
      return errorResponse('start_date and end_date query parameters are required', 400);
    }

    const holidays = await getHolidays(
      new Date(startDate),
      new Date(endDate),
      filterLocationId ?? undefined
    );

    return successResponse(holidays, 'Holidays retrieved successfully');
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to retrieve holidays', 500);
  }
}

/**
 * POST /api/holidays
 * Create a holiday (manual)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userWithLocationForCreate = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationIdForCreate = userWithLocationForCreate?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationIdForCreate) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasPermission = await checkPermission(user, 'holidays.create', { locationId: locationIdForCreate });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const body = await request.json();
    const validated = createHolidaySchema.parse(body);

    const holiday = await createHoliday({
      name: validated.name,
      date: new Date(validated.date),
      locationId: validated.location_id ?? undefined,
      hours: validated.hours,
      createdBy: user.id,
    });

    return successResponse(holiday, 'Holiday created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to create holiday', 500);
  }
}
