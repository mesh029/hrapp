import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { updateTimesheetEntries } from '@/lib/services/timesheet';
import { updateTimesheetEntriesSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/timesheets/:id/entries
 * Bulk update timesheet entries (submit all days)
 */
export async function PATCH(
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

    const hasUpdatePermission = await checkPermission(user, 'timesheet.update', { locationId: locationId_hasPermission });
    const hasCreatePermission = await checkPermission(user, 'timesheet.create', { locationId: locationId_hasPermission });
    const isAdminPermission = await checkPermission(user, 'system.admin', { locationId: locationId_hasPermission });
    if (!hasUpdatePermission && !hasCreatePermission && !isAdminPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);
    const body = await request.json();
    const validated = updateTimesheetEntriesSchema.parse(body);

    // Verify timesheet exists and belongs to user (or user is admin)
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
    });

    if (!timesheet || timesheet.deleted_at) {
      return errorResponse('Timesheet not found', 404);
    }

    // Check if user can update this timesheet
    const adminCheckLocation = userWithLocation_hasPermission?.primary_location_id || locationId_hasPermission || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    if (!adminCheckLocation) {
      return errorResponse('No location available for permission check', 400);
    }
    const isAdmin = await checkPermission(user, 'system.admin', { locationId: adminCheckLocation });
    if (!isAdmin && timesheet.user_id !== user.id) {
      return errorResponse('Forbidden: You can only update your own timesheets', 403);
    }

    // Check if timesheet is in draft status
    if (timesheet.status !== 'Draft') {
      return errorResponse('Timesheet can only be updated when in Draft status', 400);
    }

    // Update entries
    await updateTimesheetEntries(params.id, validated.entries);

    // Fetch updated timesheet
    const updated = await prisma.timesheet.findUnique({
      where: { id: params.id },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
      },
    });

    return successResponse(updated, 'Timesheet entries updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to update timesheet entries', 500);
  }
}
