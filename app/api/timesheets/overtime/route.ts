import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { createOvertimeRequestSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * POST /api/timesheets/overtime
 * Request overtime hours
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validated = createOvertimeRequestSchema.parse(body);

    // Verify timesheet exists and belongs to user
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: validated.timesheet_id },
    });

    if (!timesheet || timesheet.deleted_at) {
      return errorResponse('Timesheet not found', 404);
    }

    if (timesheet.user_id !== user.id) {
      return errorResponse('Forbidden: You can only request overtime for your own timesheets', 403);
    }

    // Check if request already exists for this date
    const existing = await prisma.overtimeRequest.findFirst({
      where: {
        timesheet_id: validated.timesheet_id,
        entry_date: new Date(validated.entry_date),
      },
    });

    if (existing) {
      return errorResponse('Overtime request already exists for this date', 400);
    }

    // Create request
    const overtimeRequest = await prisma.overtimeRequest.create({
      data: {
        timesheet_id: validated.timesheet_id,
        entry_date: new Date(validated.entry_date),
        requested_hours: new Decimal(validated.requested_hours),
        reason: validated.reason,
        created_by: user.id,
      },
    });

    return successResponse(overtimeRequest, 'Overtime request created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to create overtime request', 500);
  }
}
