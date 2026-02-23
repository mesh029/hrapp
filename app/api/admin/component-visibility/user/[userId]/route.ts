import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { uuidSchema } from '@/lib/utils/validation';

/**
 * GET /api/admin/component-visibility/user/[userId]
 * Get all visible components for a specific user
 * This considers user categories, user-specific overrides, and priority
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    uuidSchema.parse(params.userId);

    // Get user's roles
    const userRoles = await prisma.userRole.findMany({
      where: {
        user_id: params.userId,
        deleted_at: null,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    const roleIds = userRoles
      .filter(ur => ur.role.status === 'active')
      .map(ur => ur.role_id);

    // Get user's category assignments (legacy support)
    const categoryAssignments = await prisma.userCategoryAssignment.findMany({
      where: {
        user_id: params.userId,
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } },
        ],
      },
      include: {
        category: true,
      },
    });

    const categoryIds = categoryAssignments.map(ca => ca.category_id);

    // Get all visibility configs that apply to this user
    // Priority: user-specific > role-specific > category-specific
    const userConfigs = await prisma.componentVisibilityConfig.findMany({
      where: {
        OR: [
          { user_id: params.userId },
          { role_id: { in: roleIds } },
          { user_category_id: { in: categoryIds } },
        ],
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
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' },
      ],
    });

    // Group by component_id and pick the highest priority config
    // Priority order: user > role > category
    const componentMap = new Map<string, typeof userConfigs[0]>();
    
    for (const config of userConfigs) {
      const existing = componentMap.get(config.component_id);
      
      if (!existing) {
        componentMap.set(config.component_id, config);
      } else {
        // Determine priority: user > role > category
        const existingPriority = existing.user_id ? 3 : (existing.role_id ? 2 : 1);
        const configPriority = config.user_id ? 3 : (config.role_id ? 2 : 1);
        
        if (configPriority > existingPriority || 
            (configPriority === existingPriority && config.priority > existing.priority)) {
          componentMap.set(config.component_id, config);
        }
      }
    }

    const visibleComponents = Array.from(componentMap.values())
      .filter(config => config.visible)
      .map(config => ({
        component_id: config.component_id,
        visible: config.visible,
        enabled: config.enabled,
        priority: config.priority,
        source: config.user_id ? 'user' : (config.role_id ? 'role' : 'category'),
        role: config.role,
        category: config.category,
      }));

    return successResponse({
      user_id: params.userId,
      roles: userRoles.map(ur => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
      categories: categoryAssignments.map(ca => ({
        id: ca.category.id,
        name: ca.category.name,
        color: ca.category.color,
      })),
      visible_components: visibleComponents,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return errorResponse('Validation error: ' + error.errors[0].message, 400);
    }
    console.error('Error getting user visible components:', error);
    return errorResponse(error.message || 'Failed to get user visible components', 500);
  }
}
