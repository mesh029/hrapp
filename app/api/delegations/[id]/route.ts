import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { checkAuthority } from '@/lib/services/authority';

/**
 * GET /api/delegations/:id
 * Get delegation details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const delegation = await prisma.delegation.findUnique({
      where: { id: params.id },
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

    if (!delegation) {
      return errorResponse('Delegation not found', 404);
    }

    // Check if user can view this delegation
    const isAdmin = await checkAuthority({
      userId: user.id,
      permission: 'system.admin',
      locationId: '',
    });

    if (!isAdmin.authorized && delegation.delegator_user_id !== user.id && delegation.delegate_user_id !== user.id) {
      return errorResponse('Forbidden: Cannot view this delegation', 403);
    }

    return successResponse(delegation);
  } catch (error: any) {
    console.error('Error getting delegation:', error);
    return errorResponse(error.message || 'Failed to get delegation', 500);
  }
}

/**
 * DELETE /api/delegations/:id
 * Delete delegation (soft delete by revoking)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasPermission = await requirePermission(request, user.id, 'delegations.delete');
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const delegation = await prisma.delegation.findUnique({
      where: { id: params.id },
    });

    if (!delegation) {
      return errorResponse('Delegation not found', 404);
    }

    // Check if user can delete this delegation
    const isAdmin = await checkAuthority({
      userId: user.id,
      permission: 'system.admin',
      locationId: '',
    });

    if (!isAdmin.authorized && delegation.delegator_user_id !== user.id) {
      return errorResponse('Forbidden: Can only delete your own delegations', 403);
    }

    // Revoke the delegation
    const updated = await prisma.delegation.update({
      where: { id: params.id },
      data: {
        status: 'revoked',
        revoked_at: new Date(),
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

    return successResponse(updated);
  } catch (error: any) {
    console.error('Error deleting delegation:', error);
    return errorResponse(error.message || 'Failed to delete delegation', 500);
  }
}
