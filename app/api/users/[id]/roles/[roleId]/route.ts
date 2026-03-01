import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { invalidateUserPermissionCache } from '@/lib/utils/cache-invalidation';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * DELETE /api/users/[id]/roles/[roleId]
 * Remove role from user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; roleId: string } }
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

    // Try users.update, fallback to system.admin
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
        return unauthorizedResponse('You do not have permission to manage user roles');
      }
    }

    // Validate UUIDs
    const userValidation = uuidSchema.safeParse(params.id);
    const roleValidation = uuidSchema.safeParse(params.roleId);
    
    if (!userValidation.success || !roleValidation.success) {
      return errorResponse('Invalid user ID or role ID', 400);
    }

    // Check if assignment exists
    const existing = await prisma.userRole.findUnique({
      where: {
        user_id_role_id: {
          user_id: params.id,
          role_id: params.roleId,
        },
      },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('Role not assigned to this user');
    }

    // Soft delete role assignment
    await prisma.userRole.update({
      where: {
        user_id_role_id: {
          user_id: params.id,
          role_id: params.roleId,
        },
      },
      data: {
        deleted_at: new Date(),
      },
    });

    // Clean up UserPermissionScope entries if user no longer has permission through other roles
    try {
      const { cleanupScopesForUserRole } = await import('@/lib/utils/sync-role-permissions');
      const result = await cleanupScopesForUserRole(params.id, params.roleId);
      console.log(`[User Role] Removed ${result.removed} scopes for user ${params.id} after removing role ${params.roleId}`);
    } catch (cleanupError: any) {
      // Log error but don't fail the request
      console.error('[User Role] Failed to cleanup scopes:', cleanupError.message);
    }

    // OPTIMIZED: Invalidate permission cache when roles change
    await invalidateUserPermissionCache(params.id);

    // Return updated user
    const updatedUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        user_roles: {
          where: { deleted_at: null },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return successResponse(updatedUser, 'Role removed successfully');
  } catch (error: any) {
    console.error('Remove role error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
