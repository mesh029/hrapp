import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { createWorkHoursConfigSchema, paginationSchema } from '@/lib/utils/validation';

/**
 * GET /api/config/work-hours
 * List all work hours configurations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission (config.read or system.admin)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, 'config.read', { locationId });
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
        return unauthorizedResponse('You do not have permission to view work hours configurations');
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const location_id = searchParams.get('location_id');
    const staff_type_id = searchParams.get('staff_type_id');
    const is_active = searchParams.get('is_active');
    const day_of_week = searchParams.get('day_of_week');

    // Build where clause
    const where: any = {
      deleted_at: null,
    };

    if (location_id) {
      where.location_id = location_id;
    }

    if (staff_type_id) {
      where.staff_type_id = staff_type_id;
    }

    if (is_active !== null && is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    if (day_of_week !== null && day_of_week !== undefined) {
      where.day_of_week = parseInt(day_of_week, 10);
    }

    // Get work hours configs
    const [configs, total] = await Promise.all([
      prisma.workHoursConfig.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { location_id: 'asc' },
          { staff_type_id: 'asc' },
          { day_of_week: 'asc' },
        ],
        include: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          staff_type: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
      prisma.workHoursConfig.count({ where }),
    ]);

    return successResponse({
      configs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List work hours configs error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/config/work-hours
 * Create a new work hours configuration
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    // Check permission (config.create or system.admin)
    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    try {
      await requirePermission(user, 'config.create', { locationId });
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
        return unauthorizedResponse('You do not have permission to create work hours configurations');
      }
    }

    const body = await request.json();
    const validation = createWorkHoursConfigSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Validate location if provided
    if (validation.data.location_id) {
      const location = await prisma.location.findUnique({
        where: { id: validation.data.location_id },
      });

      if (!location || location.status === 'inactive') {
        return errorResponse('Invalid or inactive location', 400);
      }
    }

    // Validate staff type if provided
    if (validation.data.staff_type_id) {
      const staffType = await prisma.staffType.findUnique({
        where: { id: validation.data.staff_type_id },
      });

      if (!staffType || staffType.deleted_at || staffType.status === 'inactive') {
        return errorResponse('Invalid or inactive staff type', 400);
      }
    }

    // Check if configuration already exists for this combination
    const existing = await prisma.workHoursConfig.findFirst({
      where: {
        location_id: validation.data.location_id || null,
        staff_type_id: validation.data.staff_type_id || null,
        day_of_week: validation.data.day_of_week,
        deleted_at: null,
      },
    });

    if (existing) {
      return errorResponse('Work hours configuration already exists for this combination', 409);
    }

    // Create work hours config
    const config = await prisma.workHoursConfig.create({
      data: {
        location_id: validation.data.location_id || null,
        staff_type_id: validation.data.staff_type_id || null,
        day_of_week: validation.data.day_of_week,
        hours: validation.data.hours,
        is_active: validation.data.is_active,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        staff_type: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return successResponse(config, undefined, 201);
  } catch (error: any) {
    console.error('Create work hours config error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
