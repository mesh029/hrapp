import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { updateWorkHoursConfigSchema, uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/config/work-hours/[id]
 * Get a single work hours configuration by ID
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
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid work hours config ID', 400);
    }

    // Get work hours config
    const config = await prisma.workHoursConfig.findUnique({
      where: { id: params.id },
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

    if (!config || config.deleted_at) {
      return notFoundResponse('Work hours configuration not found');
    }

    return successResponse(config);
  } catch (error: any) {
    console.error('Get work hours config error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * PATCH /api/config/work-hours/[id]
 * Update a work hours configuration
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

    try {
      await requirePermission(user, 'config.update', { locationId });
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
        return unauthorizedResponse('You do not have permission to update work hours configurations');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid work hours config ID', 400);
    }

    const body = await request.json();
    const validation = updateWorkHoursConfigSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if config exists
    const existing = await prisma.workHoursConfig.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('Work hours configuration not found');
    }

    // Update config
    const config = await prisma.workHoursConfig.update({
      where: { id: params.id },
      data: {
        ...(validation.data.day_of_week !== undefined && { day_of_week: validation.data.day_of_week }),
        ...(validation.data.hours !== undefined && { hours: validation.data.hours }),
        ...(validation.data.is_active !== undefined && { is_active: validation.data.is_active }),
      },
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

    return successResponse(config);
  } catch (error: any) {
    console.error('Update work hours config error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/config/work-hours/[id]
 * Soft delete a work hours configuration
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

    try {
      await requirePermission(user, 'config.delete', { locationId });
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
        return unauthorizedResponse('You do not have permission to delete work hours configurations');
      }
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid work hours config ID', 400);
    }

    // Check if config exists
    const existing = await prisma.workHoursConfig.findUnique({
      where: { id: params.id },
    });

    if (!existing || existing.deleted_at) {
      return notFoundResponse('Work hours configuration not found');
    }

    // Soft delete
    const config = await prisma.workHoursConfig.update({
      where: { id: params.id },
      data: {
        deleted_at: new Date(),
        is_active: false,
      },
    });

    return successResponse(config);
  } catch (error: any) {
    console.error('Delete work hours config error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
