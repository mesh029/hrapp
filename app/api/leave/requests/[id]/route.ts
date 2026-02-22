import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { updateLeaveRequestSchema, uuidSchema } from '@/lib/utils/validation';
import { validateLeaveRequest } from '@/lib/services/leave-validation';
import { calculateDaysBetween } from '@/lib/services/leave-balance';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

/**
 * GET /api/leave/requests/[id]
 * Get a single leave request by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, 'leave.read', { locationId });
    } catch {
      const hasSystemAdmin = await prisma.userRole.findFirst({
        where: {
          user_id: user.id,
          deleted_at: null,
          role: {
            status: 'active',
            role_permissions: {
              some: {
                permission: {
                  name: 'system.admin',
                },
              },
            },
          },
        },
      });

      if (!hasSystemAdmin) {
        return unauthorizedResponse('You do not have permission to view leave requests');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave request ID', 400);
    }

    // Get leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            staff_number: true,
            charge_code: true,
          },
        },
        leave_type: {
          select: {
            id: true,
            name: true,
            description: true,
            is_paid: true,
            max_days_per_year: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!leaveRequest || leaveRequest.deleted_at) {
      return notFoundResponse('Leave request not found');
    }

    // Check if user owns this request or has permission
    if (leaveRequest.user_id !== user.id) {
      try {
        await requirePermission(user, 'leave.read', { locationId: leaveRequest.location_id });
      } catch {
        return unauthorizedResponse('You do not have permission to view this leave request');
      }
    }

    return successResponse({
      ...leaveRequest,
      days_requested: leaveRequest.days_requested.toNumber(),
    });
  } catch (error: any) {
    console.error('Get leave request error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * PATCH /api/leave/requests/[id]
 * Update a leave request (only if in Draft or Adjusted status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Check permission
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave request ID', 400);
    }

    const body = await request.json();
    const validation = updateLeaveRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if leave request exists
    const existing = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        leave_type: true,
      },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('Leave request not found');
    }

    // Only creator can update, and only if in Draft or Adjusted status
    if (existing.user_id !== user.id) {
      return unauthorizedResponse('Only the creator can update this leave request');
    }

    if (existing.status !== 'Draft' && existing.status !== 'Adjusted') {
      return errorResponse('Leave request can only be updated when in Draft or Adjusted status', 400);
    }

    // Prepare update data
    const updateData: any = {};
    let startDate = existing.start_date;
    let endDate = existing.end_date;
    let leaveTypeId = existing.leave_type_id;

    if (validation.data.leave_type_id) {
      leaveTypeId = validation.data.leave_type_id;
      const leaveType = await prisma.leaveType.findUnique({
        where: { id: validation.data.leave_type_id },
      });

      if (!leaveType || leaveType.deleted_at || leaveType.status === 'inactive') {
        return errorResponse('Leave type not found or inactive', 400);
      }

      updateData.leave_type_id = validation.data.leave_type_id;
    }

    if (validation.data.start_date) {
      startDate = new Date(validation.data.start_date);
      updateData.start_date = startDate;
    }

    if (validation.data.end_date) {
      endDate = new Date(validation.data.end_date);
      updateData.end_date = endDate;
    }

    if (validation.data.reason !== undefined) {
      updateData.reason = validation.data.reason;
    }

    // Recalculate days if dates changed
    if (validation.data.start_date || validation.data.end_date) {
      const daysRequested = calculateDaysBetween(startDate, endDate);
      updateData.days_requested = new Decimal(daysRequested);

      // Re-validate if dates or leave type changed
      const validationResult = await validateLeaveRequest(
        leaveTypeId,
        user.id,
        startDate,
        endDate,
        daysRequested
      );

      if (!validationResult.valid) {
        return errorResponse('Leave request validation failed', 400, {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
      }
    }

    // Update leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            staff_number: true,
            charge_code: true,
          },
        },
        leave_type: {
          select: {
            id: true,
            name: true,
            is_paid: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse({
      ...updatedRequest,
      days_requested: updatedRequest.days_requested.toNumber(),
    }, 'Leave request updated successfully');
  } catch (error: any) {
    console.error('Update leave request error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/leave/requests/[id]
 * Soft delete a leave request (only if in Draft status)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave request ID', 400);
    }

    // Check if leave request exists
    const existing = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('Leave request not found');
    }

    // Only creator can delete, and only if in Draft status
    if (existing.user_id !== user.id) {
      return unauthorizedResponse('Only the creator can delete this leave request');
    }

    if (existing.status !== 'Draft') {
      return errorResponse('Leave request can only be deleted when in Draft status', 400);
    }

    // Soft delete
    const deletedRequest = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: { deleted_at: new Date() },
      select: {
        id: true,
        status: true,
        deleted_at: true,
      },
    });

    return successResponse(deletedRequest, 'Leave request deleted successfully');
  } catch (error: any) {
    console.error('Delete leave request error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
