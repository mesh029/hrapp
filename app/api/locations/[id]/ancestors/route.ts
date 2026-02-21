import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { getAncestors } from '@/lib/services/location';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/locations/[id]/ancestors
 * Get location ancestors
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

    // Check if location exists
    const location = await prisma.location.findUnique({
      where: { id: params.id },
    });

    if (!location) {
      return notFoundResponse('Location not found');
    }

    // Get ancestors
    const ancestorIds = await getAncestors(params.id);

    // Get ancestor details
    const ancestors = await prisma.location.findMany({
      where: {
        id: {
          in: ancestorIds,
        },
      },
      select: {
        id: true,
        name: true,
        path: true,
        level: true,
        status: true,
      },
      orderBy: { level: 'asc' },
    });

    return successResponse({ ancestors });
  } catch (error: any) {
    console.error('Get ancestors error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
