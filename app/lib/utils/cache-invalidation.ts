import { redis } from '@/lib/redis';

/**
 * Invalidate cache keys matching a pattern
 * @param pattern - Redis key pattern (e.g., 'leave:requests:*', 'dashboard:*')
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    // Don't fail if cache invalidation fails
    console.error(`Failed to invalidate cache for pattern ${pattern}:`, error);
  }
}

/**
 * Invalidate permission cache for a specific user
 * This should be called when:
 * - User roles are assigned/removed
 * - User status changes
 * - User is deleted
 */
export async function invalidateUserPermissionCache(userId: string): Promise<void> {
  try {
    // Invalidate user permission set cache
    await redis.del(`user:perms:${userId}`);
    
    // Invalidate all location-specific permission caches for this user
    // Pattern: perms:${userId}:${locationId}
    const keys = await redis.keys(`perms:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    // Don't fail if cache invalidation fails
    console.error(`Failed to invalidate permission cache for user ${userId}:`, error);
  }
}

/**
 * Invalidate permission cache for all users with a specific role
 * This should be called when:
 * - Role permissions are assigned/removed
 * - Role status changes
 */
export async function invalidateRolePermissionCache(roleId: string): Promise<void> {
  try {
    // Get all users with this role
    const { prisma } = await import('@/lib/db');
    const usersWithRole = await prisma.userRole.findMany({
      where: {
        role_id: roleId,
        deleted_at: null,
      },
      select: {
        user_id: true,
      },
    });

    // Invalidate cache for each user
    const userIds = usersWithRole.map(ur => ur.user_id);
    await Promise.all(userIds.map(userId => invalidateUserPermissionCache(userId)));
  } catch (error) {
    console.error(`Failed to invalidate permission cache for role ${roleId}:`, error);
  }
}
