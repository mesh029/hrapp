import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { uuidSchema } from '@/lib/utils/validation';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  priority: z.number().int().optional(),
});

/**
 * GET /api/admin/user-categories/[id]
 * Get a single user category
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

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'system.admin', { locationId });

    uuidSchema.parse(params.id);

    const category = await prisma.userCategory.findUnique({
      where: { id: params.id },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          take: 10,
        },
        _count: {
          select: {
            assignments: true,
            visibility_configs: true,
          },
        },
      },
    });

    if (!category || category.deleted_at) {
      return errorResponse('Category not found', 404);
    }

    return successResponse(category);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error getting user category:', error);
    return errorResponse(error.message || 'Failed to get user category', 500);
  }
}

/**
 * PATCH /api/admin/user-categories/[id]
 * Update a user category
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

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'system.admin', { locationId });

    uuidSchema.parse(params.id);
    const body = await request.json();
    const validated = updateCategorySchema.parse(body);

    // Check if category exists
    const existing = await prisma.userCategory.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return errorResponse('Category not found', 404);
    }

    // If updating name, check for duplicates
    if (validated.name && validated.name !== existing.name) {
      const duplicate = await prisma.userCategory.findFirst({
        where: {
          name: validated.name,
          deleted_at: null,
          id: { not: params.id },
        },
      });

      if (duplicate) {
        return errorResponse('Category with this name already exists', 400);
      }
    }

    const category = await prisma.userCategory.update({
      where: { id: params.id },
      data: {
        ...validated,
        updated_at: new Date(),
      },
    });

    return successResponse(category, 'Category updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error updating user category:', error);
    return errorResponse(error.message || 'Failed to update user category', 500);
  }
}

/**
 * DELETE /api/admin/user-categories/[id]
 * Soft delete a user category
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

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    await requirePermission(user, 'system.admin', { locationId });

    uuidSchema.parse(params.id);

    const category = await prisma.userCategory.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!category || category.deleted_at) {
      return errorResponse('Category not found', 404);
    }

    // Soft delete
    await prisma.userCategory.update({
      where: { id: params.id },
      data: {
        deleted_at: new Date(),
      },
    });

    return successResponse(null, 'Category deleted successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error deleting user category:', error);
    return errorResponse(error.message || 'Failed to delete user category', 500);
  }
}
