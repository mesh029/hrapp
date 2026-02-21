import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const assignRoleSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
});

/**
 * POST /api/users/[id]/roles
 * Assign role to user
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

    // Try users.manage_roles, fallback to users.update or system.admin
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
    if (!userValidation.success) {
      return errorResponse('Invalid user ID', 400);
    }

    const body = await request.json();
    const validation = assignRoleSchema.safeParse(body);
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

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: validation.data.roleId },
    });

    if (!role || role.status !== 'active') {
      return notFoundResponse('Role not found or inactive');
    }

    // Check if already assigned
    const existing = await prisma.userRole.findUnique({
      where: {
        user_id_role_id: {
          user_id: params.id,
          role_id: validation.data.roleId,
        },
      },
    });

    if (existing && !existing.deleted_at) {
      return errorResponse('Role already assigned to this user', 409);
    }

    // Assign role (upsert to handle soft-deleted assignments)
    await prisma.userRole.upsert({
      where: {
        user_id_role_id: {
          user_id: params.id,
          role_id: validation.data.roleId,
        },
      },
      update: {
        deleted_at: null, // Restore if soft-deleted
      },
      create: {
        user_id: params.id,
        role_id: validation.data.roleId,
      },
    });

    // Return updated user with roles
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

    return successResponse(updatedUser, 'Role assigned successfully', 201);
  } catch (error: any) {
    console.error('Assign role error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
