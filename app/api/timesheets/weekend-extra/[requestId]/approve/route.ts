import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { approveWeekendExtraSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * POST /api/timesheets/weekend-extra/:requestId/approve
 * Approve weekend extra request
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
    const hasPermission = await checkPermission(user.id, 'timesheets.approve', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.requestId);
    const body = await request.json();
    const validated = approveWeekendExtraSchema.parse(body);

    // Get request
    const extraRequest = await prisma.weekendExtraRequest.findUnique({
      where: { id: params.requestId },
      include: {
        timesheet: {
          include: {
            entries: true,
          },
        },
      },
    });

    if (!extraRequest) {
      return errorResponse('Weekend extra request not found', 404);
    }

    if (extraRequest.status !== 'pending') {
      return errorResponse('Request is not pending', 400);
    }

    // Update request
    await prisma.weekendExtraRequest.update({
      where: { id: params.requestId },
      data: {
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date(),
      },
    });

    // Update timesheet entry
    const entry = extraRequest.timesheet.entries.find(
      (e) => e.date.toISOString().split('T')[0] === extraRequest.entry_date.toISOString().split('T')[0]
    );

    if (entry) {
      // Update entry with approved weekend extra hours
      const totalHours = entry.work_hours
        .plus(entry.leave_hours)
        .plus(entry.holiday_hours)
        .plus(extraRequest.requested_hours)
        .plus(entry.overtime_hours);

      await prisma.timesheetEntry.update({
        where: { id: entry.id },
        data: {
          weekend_extra_hours: extraRequest.requested_hours,
          weekend_extra_request_id: params.requestId,
          total_hours: totalHours,
        },
      });

      // Recalculate timesheet total
      const allEntries = await prisma.timesheetEntry.findMany({
        where: { timesheet_id: extraRequest.timesheet.id },
      });

      const timesheetTotal = allEntries.reduce(
        (sum, e) => sum.plus(e.total_hours),
        new Decimal(0)
      );

      await prisma.timesheet.update({
        where: { id: extraRequest.timesheet.id },
        data: { total_hours: timesheetTotal },
      });
    }

    const updated = await prisma.weekendExtraRequest.findUnique({
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

    return successResponse(updated, 'Weekend extra request approved successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to approve weekend extra request', 500);
  }
}
