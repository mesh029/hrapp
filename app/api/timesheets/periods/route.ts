import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * GET /api/timesheets/periods
 * List timesheet periods
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

    const hasPermission =
      (await checkPermission(user, 'timesheet.approve', { locationId })) ||
      (await checkPermission(user, 'system.admin', { locationId }));
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const where: any = {};

    if (startDate) {
      where.period_start = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.period_end = { lte: new Date(endDate) };
    }

    const [periods, total] = await Promise.all([
      prisma.timesheetPeriod.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { period_start: 'desc' },
      }),
      prisma.timesheetPeriod.count({ where }),
    ]);

    return successResponse({
      periods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List timesheet periods error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
