import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createConfigSchema = z.object({
  component_id: z.string().min(1),
  role_id: z.string().uuid().optional(), // Role-based (primary)
  user_category_id: z.string().uuid().optional(), // Legacy/optional
  user_id: z.string().uuid().optional(),
  visible: z.boolean().default(true),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/admin/component-visibility
 * List all component visibility configurations
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

    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get('component_id');
    const roleId = searchParams.get('role_id');
    const categoryId = searchParams.get('category_id');
    const userId = searchParams.get('user_id');

    const where: any = {};
    if (componentId) where.component_id = componentId;
    if (roleId) where.role_id = roleId;
    if (categoryId) where.user_category_id = categoryId;
    if (userId) where.user_id = userId;

    const configs = await prisma.componentVisibilityConfig.findMany({
      where,
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
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' },
      ],
    });

    return successResponse(configs);
  } catch (error: any) {
    console.error('Error getting component visibility configs:', error);
    return errorResponse(error.message || 'Failed to get component visibility configs', 500);
  }
}

/**
 * POST /api/admin/component-visibility
 * Create or update a component visibility configuration
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
    const validated = createConfigSchema.parse(body);

    // Must have role_id, category_id, or user_id (but only one)
    const providedCount = [
      validated.role_id,
      validated.user_category_id,
      validated.user_id,
    ].filter(Boolean).length;

    if (providedCount === 0) {
      return errorResponse('Must specify role_id, user_category_id, or user_id', 400);
    }

    if (providedCount > 1) {
      return errorResponse('Can only specify one of: role_id, user_category_id, or user_id', 400);
    }

    // Check if role exists (if provided)
    if (validated.role_id) {
      const role = await prisma.role.findUnique({
        where: { id: validated.role_id },
      });
      if (!role || role.deleted_at) {
        return errorResponse('Role not found', 404);
      }
    }

    // Check if category exists (if provided)
    if (validated.user_category_id) {
      const category = await prisma.userCategory.findUnique({
        where: { id: validated.user_category_id },
      });
      if (!category || category.deleted_at) {
        return errorResponse('User category not found', 404);
      }
    }

    // Check if user exists (if provided)
    if (validated.user_id) {
      const targetUser = await prisma.user.findUnique({
        where: { id: validated.user_id },
      });
      if (!targetUser || targetUser.deleted_at) {
        return errorResponse('User not found', 404);
      }
    }

    // Check if config already exists
    const existing = await prisma.componentVisibilityConfig.findFirst({
      where: {
        component_id: validated.component_id,
        role_id: validated.role_id || null,
        user_category_id: validated.user_category_id || null,
        user_id: validated.user_id || null,
      },
    });

    let config;
    if (existing) {
      // Update existing
      config = await prisma.componentVisibilityConfig.update({
        where: { id: existing.id },
        data: {
          visible: validated.visible,
          enabled: validated.enabled,
          priority: validated.priority,
          metadata: validated.metadata,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new
      config = await prisma.componentVisibilityConfig.create({
        data: {
          component_id: validated.component_id,
          role_id: validated.role_id || null,
          user_category_id: validated.user_category_id || null,
          user_id: validated.user_id || null,
          visible: validated.visible,
          enabled: validated.enabled,
          priority: validated.priority,
          metadata: validated.metadata,
          created_by: user.id,
        },
      });
    }

    return successResponse(config, existing ? 'Configuration updated successfully' : 'Configuration created successfully', existing ? 200 : 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error creating component visibility config:', error);
    return errorResponse(error.message || 'Failed to create component visibility config', 500);
  }
}
