import { AuthenticatedUser } from './auth';
import { checkAuthority } from '@/lib/services/authority';
import { prisma } from '@/lib/db';

export interface PermissionCheckOptions {
  locationId?: string;
  workflowStepOrder?: number;
  workflowInstanceId?: string;
}

/**
 * Require permission for a user
 */
export async function requirePermission(
  user: AuthenticatedUser,
  permission: string,
  options: PermissionCheckOptions = {}
): Promise<void> {
  const { locationId, workflowStepOrder, workflowInstanceId } = options;

  // OPTIMIZED: Removed duplicate system.admin check - checkAuthority already handles it
  // This eliminates one unnecessary database query per permission check

  // If location is required but not provided, throw error
  if (!locationId) {
    // Some permissions might not require location (like system.admin)
    // But most do, so we'll require it by default
    // For permissions that don't need location, pass a dummy locationId
    throw new Error('Location ID required for permission check');
  }

  const authority = await checkAuthority({
    userId: user.id,
    permission,
    locationId,
    workflowStepOrder,
    workflowInstanceId,
  });

  if (!authority.authorized) {
    throw new Error(`Forbidden - User does not have permission: ${permission}`);
  }
}

/**
 * Check if user has permission (returns boolean instead of throwing)
 */
export async function hasPermission(
  user: AuthenticatedUser,
  permission: string,
  options: PermissionCheckOptions = {}
): Promise<boolean> {
  try {
    await requirePermission(user, permission, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Alias for hasPermission (for backward compatibility)
 */
export const checkPermission = hasPermission;
