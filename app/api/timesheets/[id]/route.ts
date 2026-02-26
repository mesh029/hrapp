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
    const isAdmin = await checkPermission(user, 'system.admin', { locationId: locationId_hasPermission });
    if (!hasReadPermission && !hasCreatePermission && !isAdmin) {
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
    if (!isAdmin && timesheet.user_id !== user.id) {
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

/**
 * DELETE /api/timesheets/:id
 * Soft delete a timesheet (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - admin only
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Check for timesheet.delete permission or system.admin
    const hasDeletePermission = await checkPermission(user, 'timesheet.delete', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });

    if (!hasDeletePermission && !isAdmin) {
      return errorResponse('Forbidden: Only administrators can delete timesheets', 403);
    }

    uuidSchema.parse(params.id);

    // Check if timesheet exists
    const existing = await prisma.timesheet.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        user_id: true,
        status: true,
        deleted_at: true,
      },
    });

    if (!existing || existing.deleted_at) {
      return errorResponse('Timesheet not found', 404);
    }

    // Soft delete
    const deletedTimesheet = await prisma.timesheet.update({
      where: { id: params.id },
      data: { deleted_at: new Date() },
      select: {
        id: true,
        status: true,
        deleted_at: true,
      },
    });

    return successResponse(deletedTimesheet, 'Timesheet deleted successfully');
  } catch (error: any) {
    console.error('Delete timesheet error:', error);
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return errorResponse(error.message, 403);
    }
    return errorResponse(error.message || 'Failed to delete timesheet', 500);
  }
}
