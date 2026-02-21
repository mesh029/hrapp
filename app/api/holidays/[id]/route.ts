import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { updateHoliday, deleteHoliday } from '@/lib/services/holiday';
import { updateHolidaySchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';

/**
 * GET /api/holidays/:id
 * Get holiday details
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
    const hasPermission = await checkPermission(user.id, 'holidays.read', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);

    const holiday = await prisma.holiday.findUnique({
      where: { id: params.id },
      include: {
        location: true,
        creator: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!holiday || holiday.deleted_at) {
      return errorResponse('Holiday not found', 404);
    }

    return successResponse(holiday, 'Holiday retrieved successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to retrieve holiday', 500);
  }
}

/**
 * PATCH /api/holidays/:id
 * Update holiday
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
    const hasPermission = await checkPermission(user.id, 'holidays.update', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);
    const body = await request.json();
    const validated = updateHolidaySchema.parse(body);

    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.date !== undefined) updateData.date = new Date(validated.date);
    if (validated.hours !== undefined) updateData.hours = validated.hours;

    const holiday = await updateHoliday(params.id, updateData);

    return successResponse(holiday, 'Holiday updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to update holiday', 500);
  }
}

/**
 * DELETE /api/holidays/:id
 * Soft delete holiday
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

    // Check permission
    const hasPermission = await checkPermission(user.id, 'holidays.delete', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);

    await deleteHoliday(params.id);

    return successResponse(null, 'Holiday deleted successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to delete holiday', 500);
  }
}
