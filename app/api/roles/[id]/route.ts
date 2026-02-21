import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * GET /api/roles/[id]
 * Get role details
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
        _count: {
          select: {
            user_roles: true,
          },
        },
      },
    });

    if (!role) {
      return notFoundResponse('Role not found');
    }

    return successResponse(role);
  } catch (error: any) {
    console.error('Get role error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * PATCH /api/roles/[id]
 * Update role
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

    await requirePermission(user, 'roles.update', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid role ID', 400);
    }

    const body = await request.json();
    const validation = updateRoleSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if role exists
    const existing = await prisma.role.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return notFoundResponse('Role not found');
    }

    // If updating name, check for conflicts
    if (validation.data.name && validation.data.name !== existing.name) {
      const nameConflict = await prisma.role.findUnique({
        where: { name: validation.data.name },
      });

      if (nameConflict) {
        return errorResponse('Role with this name already exists', 409);
      }
    }

    const role = await prisma.role.update({
      where: { id: params.id },
      data: validation.data,
      include: {
        role_permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return successResponse(role, 'Role updated successfully');
  } catch (error: any) {
    console.error('Update role error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/roles/[id]
 * Delete role (soft delete by setting status to inactive)
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

    await requirePermission(user, 'roles.delete', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid role ID', 400);
    }

    // Check if role exists
    const existing = await prisma.role.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return notFoundResponse('Role not found');
    }

    // Soft delete by setting status to inactive
    const role = await prisma.role.update({
      where: { id: params.id },
      data: { status: 'inactive' },
    });

    return successResponse(role, 'Role deleted successfully');
  } catch (error: any) {
    console.error('Delete role error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
