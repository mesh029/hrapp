import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { createWeekendExtraRequestSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * POST /api/timesheets/:id/weekend-extra
 * Request weekend extra hours
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    uuidSchema.parse(params.id);
    const body = await request.json();
    const validated = createWeekendExtraRequestSchema.parse({
      ...body,
      timesheet_id: params.id,
    });

    // Verify timesheet exists and belongs to user
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
    });

    if (!timesheet || timesheet.deleted_at) {
      return errorResponse('Timesheet not found', 404);
    }

    if (timesheet.user_id !== user.id) {
      return errorResponse('Forbidden: You can only request weekend extra for your own timesheets', 403);
    }

    // Check if request already exists for this date
    const existing = await prisma.weekendExtraRequest.findFirst({
      where: {
        timesheet_id: params.id,
        entry_date: new Date(validated.entry_date),
      },
    });

    if (existing) {
      return errorResponse('Weekend extra request already exists for this date', 400);
    }

    // Create request
    const weekendExtraRequest = await prisma.weekendExtraRequest.create({
      data: {
        timesheet_id: params.id,
        entry_date: new Date(validated.entry_date),
        requested_hours: new Decimal(validated.requested_hours),
        reason: validated.reason,
        created_by: user.id,
      },
    });

    return successResponse(weekendExtraRequest, 'Weekend extra request created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to create weekend extra request', 500);
  }
}
