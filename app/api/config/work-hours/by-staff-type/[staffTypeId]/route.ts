import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/config/work-hours/by-staff-type/[staffTypeId]
 * Get work hours configurations for a specific staff type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { staffTypeId: string } }
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
    const validationResult = uuidSchema.safeParse(params.staffTypeId);
    if (!validationResult.success) {
      return errorResponse('Invalid staff type ID', 400);
    }

    // Check if staff type exists
    const staffType = await prisma.staffType.findUnique({
      where: { id: params.staffTypeId },
    });

    if (!staffType || staffType.deleted_at) {
      return notFoundResponse('Staff type not found');
    }

    // Get work hours configs for this staff type
    const configs = await prisma.workHoursConfig.findMany({
      where: {
        staff_type_id: params.staffTypeId,
        deleted_at: null,
        is_active: true,
      },
      orderBy: { day_of_week: 'asc' },
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
      staffType: {
        id: staffType.id,
        code: staffType.code,
        name: staffType.name,
      },
      configs,
    });
  } catch (error: any) {
    console.error('Get work hours by staff type error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
