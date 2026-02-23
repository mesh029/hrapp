import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/admin/user-categories/[id]/users
 * Get all users assigned to a category
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
    });

    if (!category || category.deleted_at) {
      return errorResponse('Category not found', 404);
    }

    const assignments = await prisma.userCategoryAssignment.findMany({
      where: {
        user_category_id: params.id,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        assigner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        assigned_at: 'desc',
      },
    });

    return successResponse({
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
      },
      assignments,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error getting category users:', error);
    return errorResponse(error.message || 'Failed to get category users', 500);
  }
}
