import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/config/work-hours/by-location/[locationId]
 * Get work hours configurations for a specific location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { locationId: string } }
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
      await requirePermission(user, 'config.read', { locationId });
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
        return unauthorizedResponse('You do not have permission to view work hours configurations');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.locationId);
    if (!validationResult.success) {
      return errorResponse('Invalid location ID', 400);
    }

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id: params.locationId },
    });

    if (!location || location.status === 'inactive') {
      return notFoundResponse('Location not found');
    }

    // Get work hours configs for this location
    const configs = await prisma.workHoursConfig.findMany({
      where: {
        location_id: params.locationId,
        deleted_at: null,
        is_active: true,
      },
      orderBy: [
        { staff_type_id: 'asc' },
        { day_of_week: 'asc' },
      ],
      include: {
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        staff_type: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return successResponse({
      location: {
        id: location.id,
        name: location.name,
      },
      configs,
    });
  } catch (error: any) {
    console.error('Get work hours by location error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
