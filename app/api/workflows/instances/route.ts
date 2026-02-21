import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { paginationSchema } from '@/lib/utils/validation';

/**
 * GET /api/workflows/instances
 * List workflow instances
 */
export async function GET(request: NextRequest) {
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
      await requirePermission(user, 'workflows.instances.read', { locationId });
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
        return unauthorizedResponse('You do not have permission to view workflow instances');
      }
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const resource_type = searchParams.get('resource_type');
    const resource_id = searchParams.get('resource_id');
    const status = searchParams.get('status');
    const created_by = searchParams.get('created_by');

    // Build where clause
    const where: any = {};

    if (resource_type) {
      where.resource_type = resource_type;
    }

    if (resource_id) {
      where.resource_id = resource_id;
    }

    if (status) {
      where.status = status;
    }

    if (created_by) {
      where.created_by = created_by;
    }

    // Get instances
    const [instances, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ created_at: 'desc' }],
        include: {
          template: {
            select: {
              id: true,
              name: true,
              resource_type: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          steps: {
            orderBy: { step_order: 'asc' },
            include: {
              actor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.workflowInstance.count({ where }),
    ]);

    return successResponse({
      instances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('List workflow instances error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
