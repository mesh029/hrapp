/**
 * Utility to sync UserPermissionScope entries based on workflow template steps
 * 
 * When a workflow step is configured with:
 * - required_roles: Which roles can approve
 * - location_scope: Where approvers should come from (same, parent, descendants, all)
 * - template.location_id: The template's base location
 * 
 * We should create UserPermissionScope entries for users with those roles
 * at the appropriate locations based on the location_scope setting.
 */

import { prisma } from '@/lib/db';

/**
 * Sync scopes for users based on a workflow step configuration
 * This ensures users with required roles have scopes at the correct locations
 */
export async function syncScopesForWorkflowStep(
  stepId: string,
  templateId: string
): Promise<{ created: number; skipped: number; errors: number }> {
  // Get the workflow step and template
  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    include: {
      template: {
        select: {
          id: true,
          location_id: true,
        },
      },
    },
  });

  if (!step) {
    throw new Error(`Workflow step ${stepId} not found`);
  }

  // Parse required roles
  const requiredRoles = typeof step.required_roles === 'string'
    ? JSON.parse(step.required_roles)
    : (step.required_roles || []);

  if (requiredRoles.length === 0) {
    // No roles specified, nothing to sync
    return { created: 0, skipped: 0, errors: 0 };
  }

  const locationScope = step.location_scope || 'all';
  const templateLocationId = step.template.location_id;
  const permissionId = await prisma.permission.findFirst({
    where: { name: step.required_permission },
    select: { id: true },
  });

  if (!permissionId) {
    throw new Error(`Permission ${step.required_permission} not found`);
  }

  // Get all users with the required roles
  const usersWithRoles = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
      user_roles: {
        some: {
          role_id: { in: requiredRoles },
          deleted_at: null,
          role: {
            status: 'active',
            role_permissions: {
              some: {
                permission_id: permissionId.id,
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      primary_location_id: true,
    },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const now = new Date();

  // Determine target locations based on location_scope
  let targetLocationIds: string[] = [];

  if (locationScope === 'all') {
    // For 'all', we need to create global scopes or scopes at user's location
    // We'll use user's primary location if they have one, otherwise global
    for (const user of usersWithRoles) {
      const scopeLocationId = user.primary_location_id || null;
      const isGlobal = !scopeLocationId;

      // Check if scope already exists
      const existingScope = await prisma.userPermissionScope.findFirst({
        where: {
          user_id: user.id,
          permission_id: permissionId.id,
          status: 'active',
          ...(isGlobal
            ? { is_global: true }
            : { location_id: scopeLocationId, is_global: false }
          ),
        },
      });

      if (existingScope) {
        skipped++;
        continue;
      }

      try {
        await prisma.userPermissionScope.create({
          data: {
            user_id: user.id,
            permission_id: permissionId.id,
            location_id: scopeLocationId,
            is_global: isGlobal,
            include_descendants: false,
            valid_from: now,
            valid_until: null,
            status: 'active',
          },
        });
        created++;
      } catch (error: any) {
        console.error(`Failed to create scope for user ${user.id}:`, error.message);
        errors++;
      }
    }
  } else {
    // For 'same', 'parent', or 'descendants', we need to find matching locations
    if (locationScope === 'same') {
      targetLocationIds = [templateLocationId];
    } else if (locationScope === 'parent') {
      // Get parent locations (locations that contain template location as descendant)
      const templateLocation = await prisma.location.findUnique({
        where: { id: templateLocationId },
        select: { path: true },
      });

      if (templateLocation) {
        const parentLocations = await prisma.location.findMany({
          where: {
            status: 'active',
            path: {
              startsWith: templateLocation.path.split('.').slice(0, -1).join('.'),
            },
          },
          select: { id: true },
        });
        targetLocationIds = parentLocations.map(l => l.id);
      }
    } else if (locationScope === 'descendants') {
      // Get descendant locations
      const templateLocation = await prisma.location.findUnique({
        where: { id: templateLocationId },
        select: { path: true },
      });

      if (templateLocation) {
        const descendantLocations = await prisma.location.findMany({
          where: {
            status: 'active',
            path: {
              startsWith: templateLocation.path + '.',
            },
          },
          select: { id: true },
        });
        targetLocationIds = [templateLocationId, ...descendantLocations.map(l => l.id)];
      }
    }

    // Create scopes for users at target locations
    for (const user of usersWithRoles) {
      const userLocationId = user.primary_location_id;

      // Check if user's location matches any target location
      const shouldHaveScope = !userLocationId || targetLocationIds.includes(userLocationId);

      if (!shouldHaveScope) {
        // User is not at a matching location, skip
        continue;
      }

      const scopeLocationId = userLocationId || templateLocationId;
      const isGlobal = false;

      // Check if scope already exists
      const existingScope = await prisma.userPermissionScope.findFirst({
        where: {
          user_id: user.id,
          permission_id: permissionId.id,
          status: 'active',
          location_id: scopeLocationId,
          is_global: false,
        },
      });

      if (existingScope) {
        skipped++;
        continue;
      }

      try {
        await prisma.userPermissionScope.create({
          data: {
            user_id: user.id,
            permission_id: permissionId.id,
            location_id: scopeLocationId,
            is_global: isGlobal,
            include_descendants: locationScope === 'descendants',
            valid_from: now,
            valid_until: null,
            status: 'active',
          },
        });
        created++;
      } catch (error: any) {
        console.error(`Failed to create scope for user ${user.id}:`, error.message);
        errors++;
      }
    }
  }

  return { created, skipped, errors };
}
