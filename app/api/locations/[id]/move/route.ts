import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { calculatePath, calculateLevel, getDescendants, validateTreeIntegrity } from '@/lib/services/location';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const moveLocationSchema = z.object({
  parent_id: z.string().uuid('Invalid parent location ID').nullable(),
});

/**
 * PATCH /api/locations/[id]/move
 * Move location in tree
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
    const validation = moveLocationSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Get location to move
    const location = await prisma.location.findUnique({
      where: { id: params.id },
      include: {
        children: true,
      },
    });

    if (!location) {
      return notFoundResponse('Location not found');
    }

    // Check if trying to move to itself
    if (validation.data.parent_id === params.id) {
      return errorResponse('Cannot move location to itself', 400);
    }

    // Check if trying to move to a descendant (would create cycle)
    if (validation.data.parent_id) {
      const descendants = await getDescendants(params.id);
      if (descendants.includes(validation.data.parent_id)) {
        return errorResponse('Cannot move location to its own descendant', 400);
      }

      // Verify new parent exists
      const newParent = await prisma.location.findUnique({
        where: { id: validation.data.parent_id },
      });

      if (!newParent || newParent.status !== 'active') {
        return notFoundResponse('Parent location not found or inactive');
      }
    }

    // Calculate new path and level
    const newPath = await calculatePath(validation.data.parent_id);
    const newLevel = calculateLevel(newPath);
    const oldPath = location.path;

    // Update location and all descendants in a transaction
    await prisma.$transaction(async (tx) => {
      // Update the location
      await tx.location.update({
        where: { id: params.id },
        data: {
          parent_id: validation.data.parent_id,
          path: newPath,
          level: newLevel,
        },
      });

      // Update all descendants' paths
      const descendants = await tx.location.findMany({
        where: {
          path: {
            startsWith: oldPath + '.',
          },
        },
      });

      for (const descendant of descendants) {
        const newDescendantPath = descendant.path.replace(oldPath, newPath);
        const newDescendantLevel = calculateLevel(newDescendantPath);
        
        await tx.location.update({
          where: { id: descendant.id },
          data: {
            path: newDescendantPath,
            level: newDescendantLevel,
          },
        });
      }
    });

    // Validate tree integrity
    const isValid = await validateTreeIntegrity(params.id);
    if (!isValid) {
      return errorResponse('Tree integrity validation failed after move', 500);
    }

    // Return updated location
    const updatedLocation = await prisma.location.findUnique({
      where: { id: params.id },
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

    return successResponse(updatedLocation, 'Location moved successfully');
  } catch (error: any) {
    console.error('Move location error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
