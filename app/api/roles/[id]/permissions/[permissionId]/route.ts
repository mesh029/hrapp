import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * DELETE /api/roles/[id]/permissions/[permissionId]
 * Remove permission from role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; permissionId: string } }
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

    // Try roles.update first, fallback to system.admin
    try {
      await requirePermission(user, 'roles.update', { locationId });
    } catch {
      // Check if system admin
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
        return unauthorizedResponse('You do not have permission to manage role permissions');
      }
    }

    // Validate UUIDs
    const roleValidation = uuidSchema.safeParse(params.id);
    const permissionValidation = uuidSchema.safeParse(params.permissionId);
    
    if (!roleValidation.success || !permissionValidation.success) {
      return errorResponse('Invalid role ID or permission ID', 400);
    }

    // Check if assignment exists
    const existing = await prisma.rolePermission.findUnique({
      where: {
        role_id_permission_id: {
          role_id: params.id,
          permission_id: params.permissionId,
        },
      },
    });

    if (!existing) {
      return notFoundResponse('Permission not assigned to this role');
    }

    // Remove permission
    await prisma.rolePermission.delete({
      where: {
        role_id_permission_id: {
          role_id: params.id,
          permission_id: params.permissionId,
        },
      },
    });

    // Clean up UserPermissionScope entries for users who only had this permission through this role
    try {
      // Get all users with this role
      const usersWithRole = await prisma.userRole.findMany({
        where: {
          role_id: params.id,
          deleted_at: null,
          user: {
            status: 'active',
            deleted_at: null,
          },
        },
        select: {
          user_id: true,
        },
      });

      for (const userRole of usersWithRole) {
        // Check if user still has this permission through another role
        const hasPermissionThroughOtherRole = await prisma.userRole.findFirst({
          where: {
            user_id: userRole.user_id,
            deleted_at: null,
            role_id: { not: params.id },
            role: {
              status: 'active',
              role_permissions: {
                some: {
                  permission_id: params.permissionId,
                },
              },
            },
          },
        });

        // Only remove scope if user doesn't have permission through another role
        if (!hasPermissionThroughOtherRole) {
          await prisma.userPermissionScope.deleteMany({
            where: {
              user_id: userRole.user_id,
              permission_id: params.permissionId,
            },
          });
        }
      }
    } catch (cleanupError: any) {
      // Log error but don't fail the request
      console.error('[Role Permission] Failed to cleanup scopes:', cleanupError.message);
    }

    // Return updated role
    const updatedRole = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        role_permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return successResponse(updatedRole, 'Permission removed successfully');
  } catch (error: any) {
    console.error('Remove permission error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
