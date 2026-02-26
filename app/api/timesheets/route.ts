import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { createTimesheet } from '@/lib/services/timesheet';
import { createTimesheetSchema, paginationSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * GET /api/timesheets
 * List timesheets (with optional filters)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasReadPermission = await checkPermission(user, 'timesheet.read', { locationId: locationId_hasPermission });
    const hasCreatePermission = await checkPermission(user, 'timesheet.create', { locationId: locationId_hasPermission });
    const hasApprovePermission = await checkPermission(user, 'timesheet.approve', { locationId: locationId_hasPermission });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId: locationId_hasPermission });
    if (!hasReadPermission && !hasCreatePermission && !hasApprovePermission && !isAdmin) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: any = {
      deleted_at: null,
    };

    // Admin sees all; read/approvers are location-scoped; create-only users see their own.
    if (isAdmin) {
      if (userId) where.user_id = userId;
    } else if (hasReadPermission || hasApprovePermission) {
      where.location_id = locationId_hasPermission;
      if (userId) where.user_id = userId;
    } else {
      where.user_id = user.id;
    }

    if (status) {
      where.status = status;
    }

    const [timesheets, total] = await Promise.all([
      prisma.timesheet.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              staff_number: true,
              charge_code: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.timesheet.count({ where }),
    ]);

    return successResponse(
      {
        timesheets,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Timesheets retrieved successfully'
    );
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to retrieve timesheets', 500);
  }
}

/**
 * POST /api/timesheets
 * Create a timesheet (auto-creates entries for all days)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasPermission = await checkPermission(user, 'timesheet.create', { locationId: locationId_hasPermission });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const body = await request.json();
    const validated = createTimesheetSchema.parse(body);

    // Get user's primary location if not specified
    let locationId = validated.location_id;
    if (!locationId) {
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { primary_location_id: true },
      });
      if (!userRecord?.primary_location_id) {
        return errorResponse('Location is required', 400);
      }
      locationId = userRecord.primary_location_id;
    }

    const result = await createTimesheet({
      userId: user.id,
      periodStart: new Date(validated.period_start),
      periodEnd: new Date(validated.period_end),
      locationId,
    });

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: result.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        entries: {
          orderBy: { date: 'asc' },
        },
      },
    });

    return successResponse(timesheet, 'Timesheet created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to create timesheet', 500);
  }
}
