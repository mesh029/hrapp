import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { createLeaveTypeSchema, paginationSchema } from '@/lib/utils/validation';

/**
 * GET /api/leave/types
 * List all leave types
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission (leave.types.read or system.admin)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const is_paid = searchParams.get('is_paid');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {
      deleted_at: null,
    };

    if (status) {
      where.status = status;
    }

    if (is_paid !== null && is_paid !== undefined) {
      where.is_paid = is_paid === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get leave types
    const [leaveTypes, total] = await Promise.all([
      prisma.leaveType.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ name: 'asc' }],
        include: {
          _count: {
            select: {
              leave_requests: true,
              leave_balances: true,
            },
          },
        },
      }),
      prisma.leaveType.count({ where }),
    ]);

    return successResponse({
      leaveTypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List leave types error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/leave/types
 * Create a new leave type
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission (leave.types.create or system.admin)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, 'leave.types.create', { locationId });
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
        return unauthorizedResponse('You do not have permission to create leave types');
      }
    }

    const body = await request.json();
    const validation = createLeaveTypeSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if name already exists
    const existing = await prisma.leaveType.findUnique({
      where: { name: validation.data.name },
    });

    if (existing && !existing.deleted_at) {
      return errorResponse('Leave type with this name already exists', 409);
    }

    // Parse accrual_rule if provided
    let accrualRule = null;
    if (validation.data.accrual_rule) {
      try {
        accrualRule = JSON.parse(validation.data.accrual_rule);
      } catch {
        return errorResponse('Invalid accrual_rule format. Must be valid JSON', 400);
      }
    }

    // Create leave type
    const leaveType = await prisma.leaveType.create({
      data: {
        name: validation.data.name,
        description: validation.data.description,
        is_paid: validation.data.is_paid,
        max_days_per_year: validation.data.max_days_per_year,
        accrual_rule: validation.data.accrual_rule || null,
      },
    });

    return successResponse(leaveType, 201);
  } catch (error: any) {
    console.error('Create leave type error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    if (error.code === 'P2002') {
      return errorResponse('Leave type with this name already exists', 409);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
