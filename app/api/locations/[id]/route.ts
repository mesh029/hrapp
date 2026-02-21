import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

/**
 * GET /api/locations/[id]
 * Get location details
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

    await requirePermission(user, 'locations.read', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid location ID', 400);
    }

    const location = await prisma.location.findUnique({
      where: { id: params.id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            path: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            status: true,
            path: true,
            level: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            users_primary: true,
            leave_requests: true,
            timesheets: true,
            workflow_templates: true,
          },
        },
      },
    });

    if (!location) {
      return notFoundResponse('Location not found');
    }

    return successResponse(location);
  } catch (error: any) {
    console.error('Get location error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * PATCH /api/locations/[id]
 * Update location
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

    await requirePermission(user, 'locations.update', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid location ID', 400);
    }

    const body = await request.json();
    const validation = updateLocationSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if location exists
    const existing = await prisma.location.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return notFoundResponse('Location not found');
    }

    // Update location
    const location = await prisma.location.update({
      where: { id: params.id },
      data: validation.data,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return successResponse(location, 'Location updated successfully');
  } catch (error: any) {
    console.error('Update location error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * DELETE /api/locations/[id]
 * Disable location (soft delete by setting status to inactive)
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

    await requirePermission(user, 'locations.delete', { locationId });

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid location ID', 400);
    }

    // Check if location exists
    const existing = await prisma.location.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            children: true,
            users_primary: true,
            leave_requests: true,
            timesheets: true,
          },
        },
      },
    });

    if (!existing) {
      return notFoundResponse('Location not found');
    }

    // Check if location has children
    if (existing._count.children > 0) {
      return errorResponse('Cannot delete location with child locations', 400);
    }

    // Check if location is in use
    if (existing._count.users_primary > 0 || existing._count.leave_requests > 0 || existing._count.timesheets > 0) {
      return errorResponse('Cannot delete location that is in use', 400);
    }

    // Soft delete by setting status to inactive
    const location = await prisma.location.update({
      where: { id: params.id },
      data: { status: 'inactive' },
    });

    return successResponse(location, 'Location deleted successfully');
  } catch (error: any) {
    console.error('Delete location error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
