import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  status: z.enum(['active', 'suspended', 'deactivated']).optional(),
  primary_location_id: z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(), // Optional manager assignment
  staff_number: z.string().nullable().optional(), // Optional unique staff number
  charge_code: z.string().nullable().optional(), // Optional charge code
});

/**
 * GET /api/users/[id]
 * Get user details
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

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid user ID', 400);
    }

    // Allow users to view their own profile without users.read permission
    const isViewingOwnProfile = user.id === params.id;
    
    if (!isViewingOwnProfile) {
      // For viewing other users, require users.read permission
      await requirePermission(user, 'users.read', { locationId });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        primary_location_id: true,
        deleted_at: true,
        staff_number: true,
        charge_code: true,
        primary_location: {
          select: {
            id: true,
            name: true,
          },
        },
        manager_id: true,
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        created_at: true,
        updated_at: true,
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

    if (!targetUser || targetUser.deleted_at) {
      return notFoundResponse('User not found');
    }

    return successResponse(targetUser);
  } catch (error: any) {
    console.error('Get user error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * PATCH /api/users/[id]
 * Update user
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
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('User not found');
    }

    // If updating email, check for conflicts
    if (validation.data.email && validation.data.email !== existing.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: validation.data.email },
      });

      if (emailConflict) {
        return errorResponse('User with this email already exists', 409);
      }
    }

    // Prepare update data
    const updateData: any = {};

    // If updating staff_number, check for conflicts
    if (validation.data.staff_number !== undefined && validation.data.staff_number !== existing.staff_number) {
      if (validation.data.staff_number === null) {
        // Allow removing staff_number
        updateData.staff_number = null;
      } else {
        const staffNumberConflict = await prisma.user.findUnique({
          where: { staff_number: validation.data.staff_number },
        });

        if (staffNumberConflict) {
          return errorResponse('User with this staff number already exists', 409);
        }
        updateData.staff_number = validation.data.staff_number;
      }
    }
    if (validation.data.name) updateData.name = validation.data.name;
    if (validation.data.email) updateData.email = validation.data.email;
    if (validation.data.status) updateData.status = validation.data.status;
    if (validation.data.primary_location_id !== undefined) {
      updateData.primary_location_id = validation.data.primary_location_id;
    }
    if (validation.data.password) {
      updateData.password_hash = await hashPassword(validation.data.password);
    }
    if (validation.data.charge_code !== undefined) {
      updateData.charge_code = validation.data.charge_code;
    }

    // Validate manager if provided
    if (validation.data.manager_id !== undefined) {
      if (validation.data.manager_id === null) {
        // Allow removing manager
        updateData.manager_id = null;
      } else {
        // Validate manager exists and is active
        const manager = await prisma.user.findUnique({
          where: { id: validation.data.manager_id },
        });

        if (!manager || manager.deleted_at || manager.status !== 'active') {
          return errorResponse('Invalid or inactive manager', 400);
        }

        // Prevent circular manager relationships
        if (validation.data.manager_id === params.id) {
          return errorResponse('User cannot be their own manager', 400);
        }

        // Prevent creating manager loops (manager cannot have this user as their manager)
        if (manager.manager_id === params.id) {
          return errorResponse('Cannot create circular manager relationship', 400);
        }

        updateData.manager_id = validation.data.manager_id;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        primary_location_id: true,
        manager_id: true,
        staff_number: true,
        charge_code: true,
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

    // Auto-sync Manager role if manager_id changed
    if (validation.data.manager_id !== undefined) {
      const { syncManagerRole } = await import('@/lib/utils/manager-role');
      // Sync for the old manager (if removed) and new manager (if assigned)
      if (validation.data.manager_id) {
        await syncManagerRole(validation.data.manager_id).catch(err => {
          console.error('Failed to sync Manager role for new manager:', err);
        });
      }
      // Also sync for the user being updated (in case they became/didn't become a manager)
      await syncManagerRole(params.id).catch(err => {
        console.error('Failed to sync Manager role for updated user:', err);
      });
    }

    return successResponse(updatedUser, 'User updated successfully');
  } catch (error: any) {
    console.error('Update user error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/users/[id]
 * Soft delete user
 */
export async function DELETE(
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

    await requirePermission(user, 'users.delete', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid user ID', 400);
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('User not found');
    }

    // Prevent self-deletion
    if (params.id === user.id) {
      return errorResponse('You cannot delete your own account', 400);
    }

    // Soft delete
    const deletedUser = await prisma.user.update({
      where: { id: params.id },
      data: { deleted_at: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        deleted_at: true,
      },
    });

    return successResponse(deletedUser, 'User deleted successfully');
  } catch (error: any) {
    console.error('Delete user error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
