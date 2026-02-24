/**
 * Utility functions for automatically managing the "Manager" role
 * 
 * The "Manager" role is automatically assigned to users who have direct reports
 * and removed when they no longer have direct reports.
 */

import { prisma } from '@/lib/db';

/**
 * Sync Manager role for a user based on whether they have direct reports
 * @param userId - The user ID to sync
 */
export async function syncManagerRole(userId: string): Promise<void> {
  // Find or create Manager role
  let managerRole = await prisma.role.findFirst({
    where: {
      name: { equals: 'Manager', mode: 'insensitive' },
      status: 'active',
    },
  });

  if (!managerRole) {
    // Create Manager role if it doesn't exist
    managerRole = await prisma.role.create({
      data: {
        name: 'Manager',
        description: 'Automatically assigned to users who have direct reports (people who manage others)',
        status: 'active',
      },
    });
  }

  // Check if user has direct reports
  const directReportsCount = await prisma.user.count({
    where: {
      manager_id: userId,
      status: 'active',
      deleted_at: null,
    },
  });

  // Check if user currently has Manager role
  const hasManagerRole = await prisma.userRole.findFirst({
    where: {
      user_id: userId,
      role_id: managerRole.id,
      deleted_at: null,
    },
  });

  if (directReportsCount > 0 && !hasManagerRole) {
    // User has direct reports but no Manager role - assign it
    await prisma.userRole.upsert({
      where: {
        user_id_role_id: {
          user_id: userId,
          role_id: managerRole.id,
        },
      },
      update: {
        deleted_at: null, // Restore if soft-deleted
      },
      create: {
        user_id: userId,
        role_id: managerRole.id,
      },
    });
  } else if (directReportsCount === 0 && hasManagerRole) {
    // User has no direct reports but has Manager role - remove it
    await prisma.userRole.updateMany({
      where: {
        user_id: userId,
        role_id: managerRole.id,
      },
      data: {
        deleted_at: new Date(),
      },
    });
  }
}

/**
 * Sync Manager role for all users (useful for maintenance)
 */
export async function syncAllManagerRoles(): Promise<{
  assigned: number;
  removed: number;
}> {
  // Find or create Manager role
  let managerRole = await prisma.role.findFirst({
    where: {
      name: { equals: 'Manager', mode: 'insensitive' },
      status: 'active',
    },
  });

  if (!managerRole) {
    managerRole = await prisma.role.create({
      data: {
        name: 'Manager',
        description: 'Automatically assigned to users who have direct reports (people who manage others)',
        status: 'active',
      },
    });
  }

  // Get all active users
  const allUsers = await prisma.user.findMany({
    where: {
      status: 'active',
      deleted_at: null,
    },
    select: {
      id: true,
    },
  });

  let assigned = 0;
  let removed = 0;

  for (const user of allUsers) {
    const directReportsCount = await prisma.user.count({
      where: {
        manager_id: user.id,
        status: 'active',
        deleted_at: null,
      },
    });

    const hasManagerRole = await prisma.userRole.findFirst({
      where: {
        user_id: user.id,
        role_id: managerRole.id,
        deleted_at: null,
      },
    });

    if (directReportsCount > 0 && !hasManagerRole) {
      await prisma.userRole.upsert({
        where: {
          user_id_role_id: {
            user_id: user.id,
            role_id: managerRole.id,
          },
        },
        update: {
          deleted_at: null,
        },
        create: {
          user_id: user.id,
          role_id: managerRole.id,
        },
      });
      assigned++;
    } else if (directReportsCount === 0 && hasManagerRole) {
      await prisma.userRole.updateMany({
        where: {
          user_id: user.id,
          role_id: managerRole.id,
        },
        data: {
          deleted_at: new Date(),
        },
      });
      removed++;
    }
  }

  return { assigned, removed };
}
