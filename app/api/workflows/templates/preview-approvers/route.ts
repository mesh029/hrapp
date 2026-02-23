import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const previewSchema = z.object({
  step: z.object({
    step_order: z.number(),
    required_permission: z.string(),
    approver_strategy: z.enum(['permission', 'manager', 'role', 'combined']).optional(),
    include_manager: z.boolean().optional(),
    required_roles: z.array(z.string().uuid()).optional(),
    location_scope: z.enum(['same', 'parent', 'descendants', 'all']).optional(),
  }),
  test_employee_id: z.string().uuid(),
  location_id: z.string().uuid(),
  resource_type: z.enum(['leave', 'timesheet']),
});

/**
 * POST /api/workflows/templates/preview-approvers
 * Preview who would be approvers for a workflow step
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

    await requirePermission(user, 'workflows.templates.read', { locationId });

    const body = await request.json();
    const validation = previewSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { step, test_employee_id, location_id, resource_type } = validation.data;

    // Get test employee
    const testEmployee = await prisma.user.findUnique({
      where: { id: test_employee_id },
      select: {
        id: true,
        name: true,
        email: true,
        manager_id: true,
        primary_location_id: true,
      },
    });

    if (!testEmployee) {
      return errorResponse('Test employee not found', 404);
    }

    const approvers: Array<{
      id: string;
      name: string;
      email: string;
      source: 'manager' | 'role' | 'permission';
      role?: string;
      location?: string;
    }> = [];

    const approverStrategy = step.approver_strategy || 'permission';

    // Strategy 1: Manager-based
    if (approverStrategy === 'manager' || approverStrategy === 'combined' || step.include_manager) {
      if (testEmployee.manager_id) {
        const manager = await prisma.user.findUnique({
          where: { id: testEmployee.manager_id },
          include: {
            primary_location: {
              select: { id: true, name: true },
            },
            user_roles: {
              where: { deleted_at: null },
              include: {
                role: {
                  include: {
                    role_permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (manager && manager.status === 'active' && !manager.deleted_at) {
          // Check if manager has the required permission
          const hasPermission = manager.user_roles.some(ur =>
            ur.role.status === 'active' &&
            ur.role.role_permissions.some(rp =>
              rp.permission.name === step.required_permission || rp.permission.id === step.required_permission
            )
          );

          if (hasPermission) {
            approvers.push({
              id: manager.id,
              name: manager.name,
              email: manager.email,
              source: 'manager',
              location: manager.primary_location?.name,
            });
          }
        }
      }
    }

    // Strategy 2: Role-based
    if ((approverStrategy === 'role' || approverStrategy === 'combined') && step.required_roles && step.required_roles.length > 0) {
      const roleUsers = await prisma.user.findMany({
        where: {
          status: 'active',
          deleted_at: null,
          user_roles: {
            some: {
              role_id: { in: step.required_roles },
              deleted_at: null,
              role: {
                status: 'active',
                role_permissions: {
                  some: {
                    permission: {
                      OR: [
                        { name: step.required_permission },
                        { id: step.required_permission },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        include: {
          primary_location: {
            select: { id: true, name: true },
          },
          user_roles: {
            where: {
              role_id: { in: step.required_roles },
              deleted_at: null,
            },
            include: {
              role: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      for (const roleUser of roleUsers) {
        // Filter by location scope
        let includeUser = false;
        if (step.location_scope === 'all') {
          includeUser = true;
        } else if (step.location_scope === 'same') {
          includeUser = roleUser.primary_location_id === location_id;
        } else if (step.location_scope === 'parent') {
          // TODO: Implement parent location check
          includeUser = roleUser.primary_location_id === location_id;
        } else if (step.location_scope === 'descendants') {
          // TODO: Implement descendants check
          includeUser = roleUser.primary_location_id === location_id;
        }

        if (includeUser && !approvers.find(a => a.id === roleUser.id)) {
          const role = roleUser.user_roles[0]?.role;
          approvers.push({
            id: roleUser.id,
            name: roleUser.name,
            email: roleUser.email,
            source: 'role',
            role: role?.name,
            location: roleUser.primary_location?.name,
          });
        }
      }
    }

    // Strategy 3: Permission-based (fallback or primary)
    if (approverStrategy === 'permission' || approverStrategy === 'combined') {
      const permissionUsers = await prisma.user.findMany({
        where: {
          status: 'active',
          deleted_at: null,
          user_roles: {
            some: {
              deleted_at: null,
              role: {
                status: 'active',
                role_permissions: {
                  some: {
                    permission: {
                      OR: [
                        { name: step.required_permission },
                        { id: step.required_permission },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        include: {
          primary_location: {
            select: { id: true, name: true },
          },
        },
      });

      for (const permUser of permissionUsers) {
        // Filter by location scope
        let includeUser = false;
        if (step.location_scope === 'all') {
          includeUser = true;
        } else if (step.location_scope === 'same') {
          includeUser = permUser.primary_location_id === location_id;
        }

        if (includeUser && !approvers.find(a => a.id === permUser.id)) {
          approvers.push({
            id: permUser.id,
            name: permUser.name,
            email: permUser.email,
            source: 'permission',
            location: permUser.primary_location?.name,
          });
        }
      }
    }

    return successResponse({
      approvers,
      test_employee: {
        id: testEmployee.id,
        name: testEmployee.name,
        email: testEmployee.email,
        manager_id: testEmployee.manager_id,
      },
      step_config: step,
    });
  } catch (error: any) {
    console.error('Error previewing approvers:', error);
    return errorResponse(error.message || 'Failed to preview approvers', 500);
  }
}
