import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { uuidSchema } from '@/lib/utils/validation';

const assignCategorySchema = z.object({
  user_id: z.string().uuid(),
  expires_at: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/admin/user-categories/[id]/assign
 * Assign a category to a user
 */
export async function POST(
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
    const validated = assignCategorySchema.parse(body);

    // Check if category exists
    const category = await prisma.userCategory.findUnique({
      where: { id: params.id },
    });

    if (!category || category.deleted_at) {
      return errorResponse('Category not found', 404);
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: validated.user_id },
    });

    if (!targetUser || targetUser.deleted_at) {
      return errorResponse('User not found', 404);
    }

    // Check if assignment already exists
    const existing = await prisma.userCategoryAssignment.findUnique({
      where: {
        user_id_user_category_id: {
          user_id: validated.user_id,
          user_category_id: params.id,
        },
      },
    });

    let assignment;
    if (existing) {
      // Update existing assignment
      assignment = await prisma.userCategoryAssignment.update({
        where: { id: existing.id },
        data: {
          expires_at: validated.expires_at ? new Date(validated.expires_at) : null,
          notes: validated.notes,
        },
      });
    } else {
      // Create new assignment
      assignment = await prisma.userCategoryAssignment.create({
        data: {
          user_id: validated.user_id,
          user_category_id: params.id,
          assigned_by: user.id,
          expires_at: validated.expires_at ? new Date(validated.expires_at) : null,
          notes: validated.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });
    }

    return successResponse(assignment, existing ? 'Assignment updated successfully' : 'Category assigned successfully', existing ? 200 : 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error assigning category:', error);
    return errorResponse(error.message || 'Failed to assign category', 500);
  }
}
