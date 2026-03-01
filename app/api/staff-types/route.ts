import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { createStaffTypeSchema, paginationSchema } from '@/lib/utils/validation';

/**
 * GET /api/staff-types
 * List all staff types
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
        return unauthorizedResponse('You do not have permission to view staff types');
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {
      deleted_at: null,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // OPTIMIZED: Cache staff types (read-only, relatively static data)
    const cacheKey = `staff_types:${JSON.stringify({ status, search, page, limit })}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return successResponse(JSON.parse(cached));
    }

    // Get staff types
    const [staffTypes, total] = await Promise.all([
      prisma.staffType.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ code: 'asc' }],
        include: {
          _count: {
            select: {
              work_hours_configs: true,
            },
          },
        },
      }),
      prisma.staffType.count({ where }),
    ]);

    const response = {
      staffTypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes (staff types are relatively static)
    await redis.setex(cacheKey, 300, JSON.stringify(response));

    return successResponse(response);
  } catch (error: any) {
    console.error('List staff types error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/staff-types
 * Create a new staff type
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
        return unauthorizedResponse('You do not have permission to create staff types');
      }
    }

    const body = await request.json();
    const validation = createStaffTypeSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if code already exists
    const existing = await prisma.staffType.findUnique({
      where: { code: validation.data.code },
    });

    if (existing && !existing.deleted_at) {
      return errorResponse('Staff type with this code already exists', 409);
    }

    // Create staff type
    const staffType = await prisma.staffType.create({
      data: {
        code: validation.data.code,
        name: validation.data.name,
        description: validation.data.description,
        metadata: validation.data.metadata || {},
      },
    });

    // OPTIMIZED: Invalidate staff types cache when data changes
    const keys = await redis.keys('staff_types:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return successResponse(staffType, undefined, 201);
  } catch (error: any) {
    console.error('Create staff type error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    if (error.code === 'P2002') {
      return errorResponse('Staff type with this code already exists', 409);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
