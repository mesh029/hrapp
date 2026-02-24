/**
 * Utility to sync UserPermissionScope entries when permissions are assigned to roles
 * 
 * When a permission is assigned to a role, all users with that role should automatically
 * get UserPermissionScope entries so they can actually use the permission.
 * 
 * Similarly, when a role is assigned to a user, they should get scopes for all permissions
 * that role has.
 */

import { prisma } from '@/lib/db';

/**
 * Create UserPermissionScope entries for all users who have a specific role
 * when a permission is assigned to that role
 */
export async function syncScopesForRolePermission(
  roleId: string,
  permissionId: string
): Promise<{ created: number; skipped: number }> {
  // Get all active users with this role
  const usersWithRole = await prisma.userRole.findMany({
    where: {
      role_id: roleId,
      deleted_at: null,
      user: {
        status: 'active',
        deleted_at: null,
      },
      role: {
        status: 'active',
      },
    },
    include: {
      user: {
        select: {
          id: true,
          primary_location_id: true,
        },
      },
    },
  });

  const permission = await prisma.permission.findUnique({
    where: { id: permissionId },
    select: { id: true, name: true },
  });

  if (!permission) {
    throw new Error(`Permission ${permissionId} not found`);
  }

  let created = 0;
  let skipped = 0;
  const now = new Date();

  for (const userRole of usersWithRole) {
    const userId = userRole.user.id;
    const userLocationId = userRole.user.primary_location_id;

    // Check if scope already exists
    const existingScope = await prisma.userPermissionScope.findFirst({
      where: {
        user_id: userId,
        permission_id: permissionId,
        status: 'active',
      },
    });

    if (existingScope) {
      skipped++;
      continue;
    }

    // Create scope - use user's primary location, or make it global if no location
    await prisma.userPermissionScope.create({
      data: {
        user_id: userId,
        permission_id: permissionId,
        location_id: userLocationId || null,
        is_global: !userLocationId, // Global if user has no location
        include_descendants: false,
        valid_from: now,
        valid_until: null, // No expiration
        status: 'active',
      },
    });

    created++;
  }

  return { created, skipped };
}

/**
 * Create UserPermissionScope entries for a user when they are assigned a role
 * that has permissions
 */
export async function syncScopesForUserRole(
  userId: string,
  roleId: string
): Promise<{ created: number; skipped: number }> {
  // Get all permissions for this role
  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      role_id: roleId,
      role: {
        status: 'active',
      },
    },
    include: {
      permission: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      primary_location_id: true,
      status: true,
      deleted_at: true,
    },
  });

  if (!user || user.status !== 'active' || user.deleted_at) {
    throw new Error(`User ${userId} not found or inactive`);
  }

  let created = 0;
  let skipped = 0;
  const now = new Date();
  const userLocationId = user.primary_location_id;

  for (const rolePermission of rolePermissions) {
    const permissionId = rolePermission.permission_id;

    // Check if scope already exists
    const existingScope = await prisma.userPermissionScope.findFirst({
      where: {
        user_id: userId,
        permission_id: permissionId,
        status: 'active',
      },
    });

    if (existingScope) {
      skipped++;
      continue;
    }

    // Create scope - use user's primary location, or make it global if no location
    await prisma.userPermissionScope.create({
      data: {
        user_id: userId,
        permission_id: permissionId,
        location_id: userLocationId || null,
        is_global: !userLocationId, // Global if user has no location
        include_descendants: false,
        valid_from: now,
        valid_until: null, // No expiration
        status: 'active',
      },
    });

    created++;
  }

  return { created, skipped };
}

/**
 * Remove UserPermissionScope entries for a user when they lose a role
 * (only if they don't have the permission through another role)
 */
export async function cleanupScopesForUserRole(
  userId: string,
  roleId: string
): Promise<{ removed: number }> {
  // Get all permissions that were in this role
  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      role_id: roleId,
    },
    select: {
      permission_id: true,
    },
  });

  let removed = 0;

  for (const rolePermission of rolePermissions) {
    const permissionId = rolePermission.permission_id;

    // Check if user still has this permission through another role
    const hasPermissionThroughOtherRole = await prisma.userRole.findFirst({
      where: {
        user_id: userId,
        deleted_at: null,
        role_id: { not: roleId },
        role: {
          status: 'active',
          role_permissions: {
            some: {
              permission_id: permissionId,
            },
          },
        },
      },
    });

    // Only remove scope if user doesn't have permission through another role
    if (!hasPermissionThroughOtherRole) {
      const deleted = await prisma.userPermissionScope.deleteMany({
        where: {
          user_id: userId,
          permission_id: permissionId,
        },
      });

      removed += deleted.count;
    }
  }

  return { removed };
}
