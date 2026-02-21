import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { z } from 'zod';

const updateLocationSchema = z.object({
  primary_location_id: z.string().uuid('Invalid location ID').nullable(),
});

/**
 * PATCH /api/users/[id]/location
 * Assign primary location to user
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

    await requirePermission(user, 'users.update', { locationId });

    // Validate UUID
    const userValidation = uuidSchema.safeParse(params.id);
    if (!userValidation.success) {
      return errorResponse('Invalid user ID', 400);
    }

    const body = await request.json();
    const validation = updateLocationSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser || targetUser.deleted_at) {
      return notFoundResponse('User not found');
    }

    // If location provided, verify it exists
    if (validation.data.primary_location_id) {
      const location = await prisma.location.findUnique({
        where: { id: validation.data.primary_location_id },
      });

      if (!location || location.status !== 'active') {
        return notFoundResponse('Location not found or inactive');
      }
    }

    // Update primary location
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        primary_location_id: validation.data.primary_location_id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        primary_location_id: true,
        primary_location: {
          select: {
            id: true,
            name: true,
          },
        },
        updated_at: true,
      },
    });

    return successResponse(updatedUser, 'Primary location updated successfully');
  } catch (error: any) {
    console.error('Update user location error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
