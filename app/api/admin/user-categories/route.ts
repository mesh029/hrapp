import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  priority: z.number().int().default(0),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  priority: z.number().int().optional(),
});

/**
 * GET /api/admin/user-categories
 * List all user categories
 */
export async function GET(request: NextRequest) {
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

    // Debug: Check all categories first (including deleted)
    const allCategoriesDebug = await prisma.userCategory.findMany({
      select: {
        id: true,
        name: true,
        deleted_at: true,
      },
    });
    console.log('[UserCategories API] All categories in DB (including deleted):', allCategoriesDebug.length);
    allCategoriesDebug.forEach(cat => {
      console.log(`  - ${cat.name} (deleted: ${cat.deleted_at ? 'YES' : 'NO'})`);
    });

    const categories = await prisma.userCategory.findMany({
      where: {
        deleted_at: null,
      },
      include: {
        _count: {
          select: {
            assignments: true,
            visibility_configs: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' },
      ],
    });

    console.log('[UserCategories API] Active categories found:', categories.length);
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id})`);
    });

    return successResponse(categories);
  } catch (error: any) {
    console.error('Error getting user categories:', error);
    return errorResponse(error.message || 'Failed to get user categories', 500);
  }
}

/**
 * POST /api/admin/user-categories
 * Create a new user category
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validated = createCategorySchema.parse(body);

    // Check if category with same name exists
    const existing = await prisma.userCategory.findFirst({
      where: {
        name: validated.name,
        deleted_at: null,
      },
    });

    if (existing) {
      return errorResponse('Category with this name already exists', 400);
    }

    const category = await prisma.userCategory.create({
      data: {
        name: validated.name,
        description: validated.description,
        color: validated.color,
        priority: validated.priority,
      },
    });

    return successResponse(category, 'Category created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error creating user category:', error);
    return errorResponse(error.message || 'Failed to create user category', 500);
  }
}
