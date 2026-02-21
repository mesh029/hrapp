import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { createDelegationSchema, paginationSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { hasOverlappingDelegation } from '@/lib/services/delegation';
import { checkAuthority } from '@/lib/services/authority';

/**
 * GET /api/delegations
 * List delegations (filtered by user, status, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasPermission = await requirePermission(request, user.id, 'delegations.read');
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as 'active' | 'revoked' | 'expired' | null;
    const delegator_id = searchParams.get('delegator_id');
    const delegate_id = searchParams.get('delegate_id');
    const permission_id = searchParams.get('permission_id');

    const where: any = {};

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by delegator (if user is viewing their own delegations)
    if (delegator_id) {
      if (delegator_id !== user.id && !await checkAuthority({
        userId: user.id,
        permission: 'system.admin',
        locationId: '',
      }).then(r => r.authorized)) {
        return errorResponse('Forbidden: Cannot view other users\' delegations', 403);
      }
      where.delegator_user_id = delegator_id;
    }

    // Filter by delegate
    if (delegate_id) {
      if (delegate_id !== user.id && !await checkAuthority({
        userId: user.id,
        permission: 'system.admin',
        locationId: '',
      }).then(r => r.authorized)) {
        return errorResponse('Forbidden: Cannot view other users\' delegations', 403);
      }
      where.delegate_user_id = delegate_id;
    }

    // Filter by permission
    if (permission_id) {
      where.permission_id = permission_id;
    }

    // If not admin, only show delegations where user is delegator or delegate
    if (!await checkAuthority({
      userId: user.id,
      permission: 'system.admin',
      locationId: '',
    }).then(r => r.authorized)) {
      where.OR = [
        { delegator_user_id: user.id },
        { delegate_user_id: user.id },
      ];
    }

    const [delegations, total] = await Promise.all([
      prisma.delegation.findMany({
        where,
        include: {
          delegator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          delegate: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
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
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.delegation.count({ where }),
    ]);

    return successResponse({
      delegations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error listing delegations:', error);
    return errorResponse(error.message || 'Failed to list delegations', 500);
  }
}

/**
 * POST /api/delegations
 * Create delegation (self or admin on behalf)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validated = createDelegationSchema.parse(body);

    // Determine delegator
    let delegatorId = validated.delegator_user_id || user.id;

    // Check if admin is delegating on behalf
    if (validated.delegator_user_id && validated.delegator_user_id !== user.id) {
      const isAdmin = await checkAuthority({
        userId: user.id,
        permission: 'system.admin',
        locationId: '',
      });
      
      if (!isAdmin.authorized) {
        return errorResponse('Forbidden: Only system admin can delegate on behalf of others', 403);
      }
    }

    // Check permission to create delegation
    const hasPermission = await requirePermission(request, user.id, 'delegations.create');
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    // Get permission name
    const permission = await prisma.permission.findUnique({
      where: { id: validated.permission_id },
      select: { name: true },
    });

    if (!permission) {
      return errorResponse('Permission not found', 404);
    }

    // Verify delegator has the permission being delegated
    const delegatorHasPermission = await checkAuthority({
      userId: delegatorId,
      permission: permission.name,
      locationId: validated.location_id || '',
    });

    if (!delegatorHasPermission.authorized) {
      return errorResponse('Delegator does not have the permission being delegated', 400);
    }

    // Check for overlapping delegations
    const hasOverlap = await hasOverlappingDelegation({
      delegator_user_id: delegatorId,
      delegate_user_id: validated.delegate_user_id,
      permission_id: validated.permission_id,
      location_id: validated.location_id || null,
      include_descendants: validated.include_descendants,
      valid_from: validated.valid_from,
      valid_until: validated.valid_until,
    });

    if (hasOverlap) {
      return errorResponse('Overlapping delegation exists for this combination', 400);
    }

    // Create delegation
    const delegation = await prisma.delegation.create({
      data: {
        delegator_user_id: delegatorId,
        delegate_user_id: validated.delegate_user_id,
        permission_id: validated.permission_id,
        location_id: validated.location_id || null,
        include_descendants: validated.include_descendants,
        valid_from: validated.valid_from,
        valid_until: validated.valid_until,
        status: 'active',
      },
      include: {
        delegator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        delegate: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
          },
        },
      },
    });

    return successResponse(delegation, 201);
  } catch (error: any) {
    console.error('Error creating delegation:', error);
    if (error.name === 'ZodError') {
      return errorResponse('Validation error', 400, error.errors);
    }
    return errorResponse(error.message || 'Failed to create delegation', 500);
  }
}
