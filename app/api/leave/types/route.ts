import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/utils/responses';
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

    // Allow users with leave.create, leave.types.read, or system.admin to view leave types
    // (Users need to see leave types to create leave requests)
    const hasTypesRead = await checkPermission(user, 'leave.types.read', { locationId });
    const hasCreate = await checkPermission(user, 'leave.create', { locationId });
    const hasSubmit = await checkPermission(user, 'leave.submit', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });

    if (!hasTypesRead && !hasCreate && !hasSubmit && !isAdmin) {
      return forbiddenResponse('You do not have permission to view leave types');
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

    // OPTIMIZED: Cache leave types (read-only, relatively static data)
    // Cache key includes filters to handle different queries
    const cacheKey = `leave_types:${JSON.stringify({ status, is_paid, search, page, limit })}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return successResponse(JSON.parse(cached));
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

    const response = {
      leaveTypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes (leave types are relatively static)
    await redis.setex(cacheKey, 300, JSON.stringify(response));

    return successResponse(response);
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

    const hasCreatePermission = await checkPermission(user, 'leave.types.create', { locationId });
    const isAdmin = await checkPermission(user, 'system.admin', { locationId });

    if (!hasCreatePermission && !isAdmin) {
      return forbiddenResponse('You do not have permission to create leave types');
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

    // OPTIMIZED: Invalidate leave types cache when data changes
    const keys = await redis.keys('leave_types:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return successResponse(leaveType, undefined, 201);
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
