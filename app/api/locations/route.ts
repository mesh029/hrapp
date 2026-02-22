import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { calculatePath, calculateLevel } from '@/lib/services/location';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/responses';
import { z } from 'zod';

const createLocationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  parent_id: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

/**
 * GET /api/locations
 * List locations (tree structure)
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

    await requirePermission(user, 'locations.read', { locationId });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tree = searchParams.get('tree') === 'true'; // Return as tree structure

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const locations = await prisma.location.findMany({
      where,
      orderBy: { path: 'asc' },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            children: true,
            users_primary: true,
          },
        },
      },
    });

    // If tree format requested, build tree structure
    if (tree) {
      type LocationNode = typeof locations[0] & { children: LocationNode[] };
      const locationMap = new Map<string, LocationNode>(
        locations.map(loc => [loc.id, { ...loc, children: [] as LocationNode[] }])
      );
      const roots: LocationNode[] = [];

      locations.forEach(loc => {
        const node = locationMap.get(loc.id)!;
        if (loc.parent_id) {
          const parent = locationMap.get(loc.parent_id);
          if (parent) {
            parent.children.push(node);
          }
        } else {
          roots.push(node);
        }
      });

      return successResponse({ tree: roots, flat: locations });
    }

    return successResponse({ locations });
  } catch (error: any) {
    console.error('List locations error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

/**
 * POST /api/locations
 * Create new location
 */
export async function POST(request: NextRequest) {
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

    await requirePermission(user, 'locations.create', { locationId });

    const body = await request.json();
    const validationResult = createLocationSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse('Validation failed', 400, validationResult.error.flatten().fieldErrors);
    }

    const { name, parent_id, status } = validationResult.data;

    // If parent provided, verify it exists
    if (parent_id) {
      const parent = await prisma.location.findUnique({
        where: { id: parent_id },
      });

      if (!parent || parent.status !== 'active') {
        return errorResponse('Parent location not found or inactive', 404);
      }
    }

    // Calculate path and level
    const path = await calculatePath(parent_id ?? null);
    const level = calculateLevel(path);

    // Create location
    const location = await prisma.location.create({
      data: {
        name,
        parent_id: parent_id || null,
        path,
        level,
        status: status || 'active',
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse(location, 'Location created successfully', 201);
  } catch (error: any) {
    console.error('Create location error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
