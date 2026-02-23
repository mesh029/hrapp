import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { uuidSchema } from '@/lib/utils/validation';

const updateConfigSchema = z.object({
  visible: z.boolean().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/admin/component-visibility/[id]
 * Get a single component visibility configuration
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

    const config = await prisma.componentVisibilityConfig.findUnique({
      where: { id: params.id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!config) {
      return errorResponse('Configuration not found', 404);
    }

    return successResponse(config);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error getting component visibility config:', error);
    return errorResponse(error.message || 'Failed to get component visibility config', 500);
  }
}

/**
 * PATCH /api/admin/component-visibility/[id]
 * Update a component visibility configuration
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
    const validated = updateConfigSchema.parse(body);

    const config = await prisma.componentVisibilityConfig.update({
      where: { id: params.id },
      data: {
        ...validated,
        updated_at: new Date(),
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return successResponse(config, 'Configuration updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    if (error.code === 'P2025') {
      return errorResponse('Configuration not found', 404);
    }
    console.error('Error updating component visibility config:', error);
    return errorResponse(error.message || 'Failed to update component visibility config', 500);
  }
}

/**
 * DELETE /api/admin/component-visibility/[id]
 * Delete a component visibility configuration
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

    await prisma.componentVisibilityConfig.delete({
      where: { id: params.id },
    });

    return successResponse(null, 'Configuration deleted successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    if (error.code === 'P2025') {
      return errorResponse('Configuration not found', 404);
    }
    console.error('Error deleting component visibility config:', error);
    return errorResponse(error.message || 'Failed to delete component visibility config', 500);
  }
}
