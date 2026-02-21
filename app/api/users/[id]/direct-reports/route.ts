import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/users/[id]/direct-reports
 * Get all direct reports (employees managed by this user)
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

    try {
      await requirePermission(user, 'users.read', { locationId });
    } catch {
      // Allow users to view their own direct reports
      if (params.id !== user.id) {
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
          return unauthorizedResponse('You do not have permission to view user direct reports');
        }
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid user ID', 400);
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) {
      return notFoundResponse('User not found');
    }

    // Get direct reports
    const directReports = await prisma.user.findMany({
      where: {
        manager_id: params.id,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        primary_location_id: true,
        primary_location: {
          select: {
            id: true,
            name: true,
          },
        },
        created_at: true,
      },
      orderBy: { name: 'asc' },
    });

    return successResponse({
      manager: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
      directReports,
      count: directReports.length,
    });
  } catch (error: any) {
    console.error('Get direct reports error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
