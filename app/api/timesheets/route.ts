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
    const hasPermission = await checkPermission(user.id, 'timesheets.read', null);
    if (!hasPermission) {
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

    // If not system admin, only show own timesheets or those they can manage
    if (!(await checkPermission(user.id, 'system.admin', null))) {
      where.user_id = user.id;
    } else if (userId) {
      where.user_id = userId;
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
    const hasPermission = await checkPermission(user.id, 'timesheets.create', null);
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
