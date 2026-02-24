import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const assignPermissionSchema = z.object({
  permissionId: z.string().uuid('Invalid permission ID'),
});

/**
 * GET /api/roles/[id]/permissions
 * Get role permissions
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

    await requirePermission(user, 'roles.read', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid role ID', 400);
    }

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        role_permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return notFoundResponse('Role not found');
    }

    return successResponse({
      roleId: role.id,
      roleName: role.name,
      permissions: role.role_permissions.map((rp) => rp.permission),
    });
  } catch (error: any) {
    console.error('Get role permissions error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/roles/[id]/permissions
 * Assign permission to role
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Check permission (need roles.manage_permissions or similar)
    // For now, using roles.update as manage_permissions might not exist
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
    if (!roleValidation.success) {
      return errorResponse('Invalid role ID', 400);
    }

    const body = await request.json();
    const validation = assignPermissionSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: params.id },
    });

    if (!role) {
      return notFoundResponse('Role not found');
    }

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: validation.data.permissionId },
    });

    if (!permission) {
      return notFoundResponse('Permission not found');
    }

    // Check if already assigned
    const existing = await prisma.rolePermission.findUnique({
      where: {
        role_id_permission_id: {
          role_id: params.id,
          permission_id: validation.data.permissionId,
        },
      },
    });

    if (existing) {
      return errorResponse('Permission already assigned to this role', 409);
    }

    // Assign permission
    await prisma.rolePermission.create({
      data: {
        role_id: params.id,
        permission_id: validation.data.permissionId,
      },
    });

    // Automatically create UserPermissionScope entries for all users with this role
    try {
      const { syncScopesForRolePermission } = await import('@/lib/utils/sync-role-permissions');
      const result = await syncScopesForRolePermission(params.id, validation.data.permissionId);
      console.log(`[Role Permission] Created ${result.created} scopes, skipped ${result.skipped} existing scopes for role ${params.id}`);
    } catch (syncError: any) {
      // Log error but don't fail the request - scopes can be created manually if needed
      console.error('[Role Permission] Failed to sync scopes:', syncError.message);
    }

    // Return updated role with permissions
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

    return successResponse(updatedRole, 'Permission assigned successfully', 201);
  } catch (error: any) {
    console.error('Assign permission error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
