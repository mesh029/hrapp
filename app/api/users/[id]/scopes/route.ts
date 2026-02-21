import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const createScopeSchema = z.object({
  permission_id: z.string().uuid('Invalid permission ID'),
  location_id: z.string().uuid('Invalid location ID').nullable().optional(),
  include_descendants: z.boolean().default(false),
  is_global: z.boolean().default(false),
  valid_from: z.string().datetime().or(z.date()),
  valid_until: z.string().datetime().or(z.date()).nullable().optional(),
});

/**
 * GET /api/users/[id]/scopes
 * Get user permission scopes
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

    await requirePermission(user, 'users.read', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid user ID', 400);
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser || targetUser.deleted_at) {
      return notFoundResponse('User not found');
    }

    // Get scopes
    const scopes = await prisma.userPermissionScope.findMany({
      where: {
        user_id: params.id,
      },
      include: {
        permission: {
          select: {
            id: true,
            name: true,
            module: true,
            description: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            path: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return successResponse({ scopes });
  } catch (error: any) {
    console.error('Get user scopes error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/users/[id]/scopes
 * Create user scope
 */
export async function POST(
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

    // Try users.manage_scopes, fallback to users.update or system.admin
    try {
      await requirePermission(user, 'users.update', { locationId });
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
        return unauthorizedResponse('You do not have permission to manage user scopes');
      }
    }

    // Validate UUID
    const userValidation = uuidSchema.safeParse(params.id);
    if (!userValidation.success) {
      return errorResponse('Invalid user ID', 400);
    }

    const body = await request.json();
    const validation = createScopeSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser || targetUser.deleted_at) {
      return notFoundResponse('User not found');
    }

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: validation.data.permission_id },
    });

    if (!permission) {
      return notFoundResponse('Permission not found');
    }

    // Validate location if provided
    if (validation.data.location_id) {
      const location = await prisma.location.findUnique({
        where: { id: validation.data.location_id },
      });

      if (!location || location.status !== 'active') {
        return notFoundResponse('Location not found or inactive');
      }
    }

    // Validate is_global and location_id logic
    if (validation.data.is_global && validation.data.location_id) {
      return errorResponse('Cannot set both is_global and location_id', 400);
    }

    if (!validation.data.is_global && !validation.data.location_id) {
      return errorResponse('Either is_global must be true or location_id must be provided', 400);
    }

    // Parse dates
    const validFrom = typeof validation.data.valid_from === 'string' 
      ? new Date(validation.data.valid_from) 
      : validation.data.valid_from;
    const validUntil = validation.data.valid_until
      ? (typeof validation.data.valid_until === 'string' ? new Date(validation.data.valid_until) : validation.data.valid_until)
      : null;

    // Validate date range
    if (validUntil && validUntil <= validFrom) {
      return errorResponse('valid_until must be after valid_from', 400);
    }

    // Create scope
    const scope = await prisma.userPermissionScope.create({
      data: {
        user_id: params.id,
        permission_id: validation.data.permission_id,
        location_id: validation.data.location_id || null,
        include_descendants: validation.data.include_descendants,
        is_global: validation.data.is_global,
        valid_from: validFrom,
        valid_until: validUntil,
        status: 'active',
      },
      include: {
        permission: true,
        location: true,
      },
    });

    return successResponse(scope, 'User scope created successfully', 201);
  } catch (error: any) {
    console.error('Create user scope error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
