import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { updateLeaveAccrualConfigSchema, uuidSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * GET /api/leave/accrual/configs/:id
 * Get accrual config details
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

    const hasPermission = await checkPermission(user, 'leave.read', { locationId: locationId_hasPermission });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);

    const config = await prisma.leaveAccrualConfig.findUnique({
      where: { id: params.id },
      include: {
        leave_type: true,
        location: true,
        staff_type: true,
      },
    });

    if (!config || config.deleted_at) {
      return errorResponse('Accrual config not found', 404);
    }

    return successResponse(config, 'Accrual config retrieved successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to retrieve accrual config', 500);
  }
}

/**
 * PATCH /api/leave/accrual/configs/:id
 * Update accrual config
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

    const hasPermission = await checkPermission(user, 'leave.manage', { locationId: locationId_hasPermission });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);
    const body = await request.json();
    const validated = updateLeaveAccrualConfigSchema.parse(body);

    const updateData: any = {};
    if (validated.accrual_rate !== undefined) updateData.accrual_rate = new Decimal(validated.accrual_rate);
    if (validated.accrual_period !== undefined) updateData.accrual_period = validated.accrual_period;
    if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

    const config = await prisma.leaveAccrualConfig.update({
      where: { id: params.id },
      data: updateData,
      include: {
        leave_type: true,
        location: true,
        staff_type: true,
      },
    });

    return successResponse(config, 'Accrual config updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to update accrual config', 500);
  }
}

/**
 * DELETE /api/leave/accrual/configs/:id
 * Soft delete accrual config
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
    // Check permission
    const userWithLocation_hasPermission = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId_hasPermission = userWithLocation_hasPermission?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId_hasPermission) {
      return errorResponse('No location available for permission check', 400);
    }

    const hasPermission = await checkPermission(user, 'leave.manage', { locationId: locationId_hasPermission });
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    uuidSchema.parse(params.id);

    await prisma.leaveAccrualConfig.update({
      where: { id: params.id },
      data: { deleted_at: new Date() },
    });

    return successResponse(null, 'Accrual config deleted successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to delete accrual config', 500);
  }
}
