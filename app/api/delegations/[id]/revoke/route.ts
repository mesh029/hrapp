import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { checkAuthority } from '@/lib/services/authority';

/**
 * PATCH /api/delegations/:id/revoke
 * Revoke delegation (set status to revoked)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasPermission = await requirePermission(request, user.id, 'delegations.revoke');
    if (!hasPermission) {
      return errorResponse('Forbidden: Insufficient permissions', 403);
    }

    const delegation = await prisma.delegation.findUnique({
      where: { id: params.id },
    });

    if (!delegation) {
      return errorResponse('Delegation not found', 404);
    }

    // Check if already revoked or expired
    if (delegation.status === 'revoked') {
      return errorResponse('Delegation is already revoked', 400);
    }

    if (delegation.status === 'expired') {
      return errorResponse('Delegation is already expired', 400);
    }

    // Check if user can revoke this delegation
    const isAdmin = await checkAuthority({
      userId: user.id,
      permission: 'system.admin',
      locationId: '',
    });

    if (!isAdmin.authorized && delegation.delegator_user_id !== user.id) {
      return errorResponse('Forbidden: Can only revoke your own delegations', 403);
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

    return successResponse(updated);
  } catch (error: any) {
    console.error('Error revoking delegation:', error);
    return errorResponse(error.message || 'Failed to revoke delegation', 500);
  }
}
