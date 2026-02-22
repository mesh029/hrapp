import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { allocateLeaveBalanceSchema, uuidSchema } from '@/lib/utils/validation';
import { allocateLeaveDays } from '@/lib/services/leave-balance';
import { validateLeaveBalance } from '@/lib/services/leave-validation';

/**
 * POST /api/leave/balances/allocate
 * Manually allocate leave days to a user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission (admin only)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, 'leave.balances.manage', { locationId });
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
        return unauthorizedResponse('You do not have permission to manage leave balances');
      }
    }

    const body = await request.json();
    const { user_id } = body;
    
    if (!user_id) {
      return errorResponse('user_id is required', 400);
    }

    const uuidValidation = uuidSchema.safeParse(user_id);
    if (!uuidValidation.success) {
      return errorResponse('Invalid user_id', 400);
    }

    const validation = allocateLeaveBalanceSchema.safeParse(body);
    
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Validate user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!targetUser || targetUser.deleted_at) {
      return errorResponse('User not found', 400);
    }

    // Validate leave type exists
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: validation.data.leave_type_id },
    });

    if (!leaveType || leaveType.deleted_at || leaveType.status === 'inactive') {
      return errorResponse('Leave type not found or inactive', 400);
    }

    // Validate allocation
    const validationResult = await validateLeaveBalance(
      user_id,
      validation.data.leave_type_id,
      validation.data.year,
      validation.data.days
    );

    if (!validationResult.valid) {
      return errorResponse('Allocation validation failed', 400, {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    }

    // Allocate leave days
    await allocateLeaveDays(
      user_id,
      validation.data.leave_type_id,
      validation.data.year,
      validation.data.days
    );

    // Get updated balance
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        user_id_leave_type_id_year: {
          user_id: user_id,
          leave_type_id: validation.data.leave_type_id,
          year: validation.data.year,
        },
      },
      include: {
        leave_type: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse({
      ...balance,
      allocated: balance?.allocated.toNumber(),
      used: balance?.used.toNumber(),
      pending: balance?.pending.toNumber(),
    }, 'Leave days allocated successfully', 201);
  } catch (error: any) {
    console.error('Allocate leave balance error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
