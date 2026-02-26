import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * GET /api/timesheets/requests/pending
 * Get pending weekend extra and overtime requests
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

    const hasPermission = await checkPermission(user, 'timesheet.approve', { locationId });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    // Get pending weekend extra requests
    const weekendExtraRequests = await prisma.weekendExtraRequest.findMany({
      where: {
        status: 'pending',
      },
      include: {
        timesheet: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Get pending overtime requests
    const overtimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        status: 'pending',
      },
      include: {
        timesheet: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return successResponse({
      weekend_extra: weekendExtraRequests.map(req => ({
        id: req.id,
        timesheet_id: req.timesheet_id,
        entry_date: req.entry_date,
        requested_hours: req.requested_hours.toNumber(),
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        timesheet: {
          id: req.timesheet.id,
          period_start: req.timesheet.period_start,
          period_end: req.timesheet.period_end,
          user: req.timesheet.user,
          location: req.timesheet.location,
        },
        requester: req.requester,
      })),
      overtime: overtimeRequests.map(req => ({
        id: req.id,
        timesheet_id: req.timesheet_id,
        entry_date: req.entry_date,
        requested_hours: req.requested_hours.toNumber(),
        reason: req.reason,
        status: req.status,
        created_at: req.created_at,
        timesheet: {
          id: req.timesheet.id,
          period_start: req.timesheet.period_start,
          period_end: req.timesheet.period_end,
          user: req.timesheet.user,
          location: req.timesheet.location,
        },
        requester: req.requester,
      })),
    });
  } catch (error: any) {
    console.error('Error getting pending requests:', error);
    return errorResponse(error.message || 'Failed to get pending requests', 500);
  }
}
