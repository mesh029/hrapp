import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * PATCH /api/users/[id]/manager
 * Assign or update manager for a user
 */
export async function PATCH(
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

    await requirePermission(user, 'users.update', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid user ID', 400);
    }

    const body = await request.json();
    const { manager_id } = body;

    // Validate manager_id if provided
    if (manager_id !== null && manager_id !== undefined) {
      const managerValidation = uuidSchema.safeParse(manager_id);
      if (!managerValidation.success) {
        return errorResponse('Invalid manager ID', 400);
      }
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser || targetUser.deleted_at) {
      return notFoundResponse('User not found');
    }

    // Validate manager if provided
    if (manager_id !== null && manager_id !== undefined) {
      const manager = await prisma.user.findUnique({
        where: { id: manager_id },
      });

      if (!manager || manager.deleted_at || manager.status !== 'active') {
        return errorResponse('Invalid or inactive manager', 400);
      }

      // Prevent circular manager relationships
      if (manager_id === params.id) {
        return errorResponse('User cannot be their own manager', 400);
      }

      // Prevent creating manager loops
      if (manager.manager_id === params.id) {
        return errorResponse('Cannot create circular manager relationship', 400);
      }
    }

    // Update manager
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        manager_id: manager_id || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        manager_id: true,
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updated_at: true,
      },
    });

    return successResponse(updatedUser, 'Manager updated successfully');
  } catch (error: any) {
    console.error('Update manager error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
