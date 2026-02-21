import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { updateLeaveTypeSchema, uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/leave/types/[id]
 * Get a single leave type by ID
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
      await requirePermission(user, 'leave.types.read', { locationId });
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
        return unauthorizedResponse('You do not have permission to view leave types');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave type ID', 400);
    }

    // Get leave type
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            leave_requests: true,
            leave_balances: true,
          },
        },
      },
    });

    if (!leaveType || leaveType.deleted_at) {
      return notFoundResponse('Leave type not found');
    }

    return successResponse(leaveType);
  } catch (error: any) {
    console.error('Get leave type error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * PATCH /api/leave/types/[id]
 * Update a leave type
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

    try {
      await requirePermission(user, 'leave.types.update', { locationId });
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
        return unauthorizedResponse('You do not have permission to update leave types');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave type ID', 400);
    }

    const body = await request.json();
    const validation = updateLeaveTypeSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if leave type exists
    const existing = await prisma.leaveType.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('Leave type not found');
    }

    // Validate accrual_rule if provided
    let accrualRule = existing.accrual_rule;
    if (validation.data.accrual_rule !== undefined) {
      if (validation.data.accrual_rule === null) {
        accrualRule = null;
      } else {
        try {
          JSON.parse(validation.data.accrual_rule);
          accrualRule = validation.data.accrual_rule;
        } catch {
          return errorResponse('Invalid accrual_rule format. Must be valid JSON', 400);
        }
      }
    }

    // Update leave type
    const leaveType = await prisma.leaveType.update({
      where: { id: params.id },
      data: {
        ...(validation.data.name && { name: validation.data.name }),
        ...(validation.data.description !== undefined && { description: validation.data.description }),
        ...(validation.data.is_paid !== undefined && { is_paid: validation.data.is_paid }),
        ...(validation.data.max_days_per_year !== undefined && { max_days_per_year: validation.data.max_days_per_year }),
        ...(validation.data.accrual_rule !== undefined && { accrual_rule: accrualRule }),
        ...(validation.data.status && { status: validation.data.status }),
      },
    });

    return successResponse(leaveType);
  } catch (error: any) {
    console.error('Update leave type error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    if (error.code === 'P2002') {
      return errorResponse('Leave type with this name already exists', 409);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/leave/types/[id]
 * Soft delete a leave type
 */
export async function DELETE(
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
      await requirePermission(user, 'leave.types.delete', { locationId });
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
        return unauthorizedResponse('You do not have permission to delete leave types');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave type ID', 400);
    }

    // Check if leave type exists
    const existing = await prisma.leaveType.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('Leave type not found');
    }

    // Soft delete
    const leaveType = await prisma.leaveType.update({
      where: { id: params.id },
      data: {
        deleted_at: new Date(),
        status: 'inactive',
      },
    });

    return successResponse(leaveType);
  } catch (error: any) {
    console.error('Delete leave type error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
