import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { approveOvertimeSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const { Decimal } = Prisma;

/**
 * POST /api/timesheets/overtime/:requestId/approve
 * Approve overtime request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission (managers or timesheet approvers)
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasPermission = await checkPermission(user, 'timesheet.approve', { locationId: locationId_hasPermission });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.requestId);
    const body = await request.json();
    const validated = approveOvertimeSchema.parse(body);

    // Get request
    const overtimeRequest = await prisma.overtimeRequest.findUnique({
      where: { id: params.requestId },
      include: {
        timesheet: {
          include: {
            entries: true,
          },
        },
      },
    });

    if (!overtimeRequest) {
      return errorResponse('Overtime request not found', 404);
    }

    if (overtimeRequest.status !== 'pending') {
      return errorResponse('Request is not pending', 400);
    }

    // Update request
    await prisma.overtimeRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date(),
      },
    });

    // Update timesheet entry
    const entry = overtimeRequest.timesheet.entries.find(
      (e) => e.date.toISOString().split('T')[0] === overtimeRequest.entry_date.toISOString().split('T')[0]
    );

    if (entry) {
      // Update entry with approved overtime hours
      const totalHours = entry.work_hours
        .plus(entry.leave_hours)
        .plus(entry.holiday_hours)
        .plus(entry.weekend_extra_hours)
        .plus(overtimeRequest.requested_hours);

      await prisma.timesheetEntry.update({
        where: { id: entry.id },
        data: {
          overtime_hours: overtimeRequest.requested_hours,
          overtime_request_id: params.requestId,
          total_hours: totalHours,
        },
      });

      // Recalculate timesheet total
      const allEntries = await prisma.timesheetEntry.findMany({
        where: { timesheet_id: overtimeRequest.timesheet.id },
      });

      const timesheetTotal = allEntries.reduce(
        (sum, e) => sum.plus(e.total_hours),
        new Decimal(0)
      );

      await prisma.timesheet.update({
        where: { id: overtimeRequest.timesheet.id },
        data: { total_hours: timesheetTotal },
      });
    }

    const updated = await prisma.overtimeRequest.findUnique({
      where: { id: params.requestId },
      include: {
        approver: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return successResponse(updated, 'Overtime request approved successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to approve overtime request', 500);
  }
}
