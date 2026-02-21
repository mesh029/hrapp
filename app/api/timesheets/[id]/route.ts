import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * GET /api/timesheets/:id
 * Get timesheet details with all entries
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    uuidSchema.parse(params.id);

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            staff_type: true,
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
          include: {
            leave_request: {
              select: {
                id: true,
                leave_type: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            holiday: {
              select: {
                id: true,
                name: true,
              },
            },
            weekend_extra_request: {
              select: {
                id: true,
                status: true,
                requested_hours: true,
              },
            },
            overtime_request: {
              select: {
                id: true,
                status: true,
                requested_hours: true,
              },
            },
          },
        },
      },
    });

    if (!timesheet || timesheet.deleted_at) {
      return errorResponse('Timesheet not found', 404);
    }

    // Check if user can access this timesheet
    if (!(await checkPermission(user.id, 'system.admin', null)) && timesheet.user_id !== user.id) {
      return errorResponse('Forbidden: You can only access your own timesheets', 403);
    }

    return successResponse(timesheet, 'Timesheet retrieved successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to retrieve timesheet', 500);
  }
}
