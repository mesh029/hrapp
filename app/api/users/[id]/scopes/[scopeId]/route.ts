import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const updateScopeSchema = z.object({
  location_id: z.string().uuid().nullable().optional(),
  include_descendants: z.boolean().optional(),
  is_global: z.boolean().optional(),
  valid_from: z.string().datetime().or(z.date()).optional(),
  valid_until: z.string().datetime().or(z.date()).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * PATCH /api/users/[id]/scopes/[scopeId]
 * Update user scope
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; scopeId: string } }
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
        return unauthorizedResponse('You do not have permission to manage user scopes');
      }
    }

    // Validate UUIDs
    const userValidation = uuidSchema.safeParse(params.id);
    const scopeValidation = uuidSchema.safeParse(params.scopeId);
    
    if (!userValidation.success || !scopeValidation.success) {
      return errorResponse('Invalid user ID or scope ID', 400);
    }

    const body = await request.json();
    const validation = updateScopeSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if scope exists and belongs to user
    const existing = await prisma.userPermissionScope.findUnique({
      where: { id: params.scopeId },
    });

    if (!existing) {
      return notFoundResponse('Scope not found');
    }

    if (existing.user_id !== params.id) {
      return errorResponse('Scope does not belong to this user', 403);
    }

    // Validate location if provided
    if (validation.data.location_id !== undefined) {
      if (validation.data.location_id) {
        const location = await prisma.location.findUnique({
          where: { id: validation.data.location_id },
        });

        if (!location || location.status !== 'active') {
          return notFoundResponse('Location not found or inactive');
        }
      }
    }

    // Validate is_global and location_id logic
    const isGlobal = validation.data.is_global !== undefined ? validation.data.is_global : existing.is_global;
    const locationId = validation.data.location_id !== undefined ? validation.data.location_id : existing.location_id;

    if (isGlobal && locationId) {
      return errorResponse('Cannot set both is_global and location_id', 400);
    }

    if (!isGlobal && !locationId) {
      return errorResponse('Either is_global must be true or location_id must be provided', 400);
    }

    // Prepare update data
    const updateData: any = {};
    if (validation.data.location_id !== undefined) updateData.location_id = validation.data.location_id;
    if (validation.data.include_descendants !== undefined) updateData.include_descendants = validation.data.include_descendants;
    if (validation.data.is_global !== undefined) updateData.is_global = validation.data.is_global;
    if (validation.data.status) updateData.status = validation.data.status;
    
    if (validation.data.valid_from) {
      updateData.valid_from = typeof validation.data.valid_from === 'string' 
        ? new Date(validation.data.valid_from) 
        : validation.data.valid_from;
    }
    
    if (validation.data.valid_until !== undefined) {
      updateData.valid_until = validation.data.valid_until
        ? (typeof validation.data.valid_until === 'string' ? new Date(validation.data.valid_until) : validation.data.valid_until)
        : null;
    }

    // Validate date range
    const validFrom = updateData.valid_from || existing.valid_from;
    const validUntil = updateData.valid_until !== undefined ? updateData.valid_until : existing.valid_until;
    
    if (validUntil && validUntil <= validFrom) {
      return errorResponse('valid_until must be after valid_from', 400);
    }

    // Update scope
    const scope = await prisma.userPermissionScope.update({
      where: { id: params.scopeId },
      data: updateData,
      include: {
        permission: true,
        location: true,
      },
    });

    return successResponse(scope, 'User scope updated successfully');
  } catch (error: any) {
    console.error('Update user scope error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/users/[id]/scopes/[scopeId]
 * Remove user scope
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; scopeId: string } }
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
        return unauthorizedResponse('You do not have permission to manage user scopes');
      }
    }

    // Validate UUIDs
    const userValidation = uuidSchema.safeParse(params.id);
    const scopeValidation = uuidSchema.safeParse(params.scopeId);
    
    if (!userValidation.success || !scopeValidation.success) {
      return errorResponse('Invalid user ID or scope ID', 400);
    }

    // Check if scope exists and belongs to user
    const existing = await prisma.userPermissionScope.findUnique({
      where: { id: params.scopeId },
    });

    if (!existing) {
      return notFoundResponse('Scope not found');
    }

    if (existing.user_id !== params.id) {
      return errorResponse('Scope does not belong to this user', 403);
    }

    // Delete scope
    await prisma.userPermissionScope.delete({
      where: { id: params.scopeId },
    });

    return successResponse(null, 'User scope removed successfully');
  } catch (error: any) {
    console.error('Delete user scope error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
