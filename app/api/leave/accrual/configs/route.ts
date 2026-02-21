import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { createLeaveAccrualConfigSchema, paginationSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * GET /api/leave/accrual/configs
 * List accrual configs
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasPermission = await checkPermission(user.id, 'leave.manage', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const leaveTypeId = searchParams.get('leave_type_id');
    const locationId = searchParams.get('location_id');
    const staffTypeId = searchParams.get('staff_type_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: any = {
      deleted_at: null,
    };

    if (leaveTypeId) where.leave_type_id = leaveTypeId;
    if (locationId) where.location_id = locationId;
    if (staffTypeId) where.staff_type_id = staffTypeId;

    const [configs, total] = await Promise.all([
      prisma.leaveAccrualConfig.findMany({
        where,
        include: {
          leave_type: {
            select: {
              id: true,
              name: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          staff_type: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaveAccrualConfig.count({ where }),
    ]);

    return successResponse(
      {
        configs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Accrual configs retrieved successfully'
    );
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to retrieve accrual configs', 500);
  }
}

/**
 * POST /api/leave/accrual/configs
 * Create accrual config
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasPermission = await checkPermission(user.id, 'leave.manage', null);
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const body = await request.json();
    const validated = createLeaveAccrualConfigSchema.parse(body);

    // Check if config already exists for this combination
    const existing = await prisma.leaveAccrualConfig.findFirst({
      where: {
        leave_type_id: validated.leave_type_id,
        location_id: validated.location_id ?? null,
        staff_type_id: validated.staff_type_id ?? null,
        deleted_at: null,
      },
    });

    if (existing) {
      return errorResponse('Accrual config already exists for this combination', 400);
    }

    const config = await prisma.leaveAccrualConfig.create({
      data: {
        leave_type_id: validated.leave_type_id,
        location_id: validated.location_id ?? null,
        staff_type_id: validated.staff_type_id ?? null,
        accrual_rate: new Decimal(validated.accrual_rate),
        accrual_period: validated.accrual_period,
        is_active: validated.is_active,
      },
      include: {
        leave_type: true,
        location: true,
        staff_type: true,
      },
    });

    return successResponse(config, 'Accrual config created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    return errorResponse(error.message || 'Failed to create accrual config', 500);
  }
}
