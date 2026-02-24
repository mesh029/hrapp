import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';
import { isDescendantOf } from '@/lib/services/location';

export interface AuthorityCheckParams {
  userId: string;
  permission: string;
  locationId: string;
  workflowStepOrder?: number;
  workflowInstanceId?: string;
}

/**
 * Multi-layer authority resolution
 * Authority = Permission ∩ Location Scope ∩ Delegation Overlay ∩ Workflow Step Eligibility ∩ Active Status
 */
export async function checkAuthority(params: AuthorityCheckParams): Promise<{
  authorized: boolean;
  source: 'direct' | 'delegation' | null;
  delegationId?: string;
}> {
  const { userId, permission, locationId, workflowStepOrder, workflowInstanceId } = params;

  // 1. Check user is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, deleted_at: true },
  });

  if (!user || user.status !== 'active' || user.deleted_at) {
    return { authorized: false, source: null };
  }

  // 1.5. Check for system.admin permission (bypasses all other checks)
  const userRoles = await prisma.userRole.findMany({
    where: {
      user_id: userId,
      deleted_at: null,
      role: {
        status: 'active',
      },
    },
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
  });

  const rolePermissions = new Set<string>();
  userRoles.forEach((ur) => {
    if (ur.role && ur.role.status === 'active') {
      ur.role.role_permissions.forEach((rp) => {
        rolePermissions.add(rp.permission.name);
      });
    }
  });

  if (rolePermissions.has('system.admin')) {
    return { authorized: true, source: 'direct' };
  }

  // 2. Check workflow step eligibility (if workflow context provided)
  if (workflowInstanceId && workflowStepOrder !== undefined) {
    const workflowInstance = await prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
      include: {
        template: {
          include: {
            steps: {
              where: { step_order: workflowStepOrder },
              take: 1,
            },
          },
        },
      },
    });

    if (!workflowInstance) {
      return { authorized: false, source: null };
    }

    const step = workflowInstance.template.steps[0];
    if (!step) {
      return { authorized: false, source: null };
    }
    
    // Get permission name - required_permission can be either an ID or a name
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(step.required_permission);
    let stepPermissionName: string;
    
    if (isUUID) {
      const stepPermission = await prisma.permission.findUnique({
        where: { id: step.required_permission },
        select: { name: true },
      });
      if (!stepPermission) {
        return { authorized: false, source: null };
      }
      stepPermissionName = stepPermission.name;
    } else {
      stepPermissionName = step.required_permission;
    }
    
    if (stepPermissionName !== permission) {
      return { authorized: false, source: null };
    }

    // Check if this is the current step (or if we're checking for future steps during simulation/resolution)
    // Allow authority check for current step OR if step order is >= current step (for resolving future approvers)
    // Also allow if current_step_order is null or 0 (workflow just started)
    if (workflowInstance.current_step_order !== null && workflowInstance.current_step_order > workflowStepOrder) {
      // This step has already passed, no need to check authority
      return { authorized: false, source: null };
    }
    // If current_step_order < workflowStepOrder, we're checking a future step - allow it for resolution purposes
    // If current_step_order === workflowStepOrder, we're checking the current step - allow it
    // If current_step_order is null/0, we're at the start - allow it
  }

  // 3. Check cache first
  const cacheKey = `perms:${userId}:${locationId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const cachedPerms = JSON.parse(cached);
    if (cachedPerms.permissions.includes(permission)) {
      return { authorized: true, source: 'direct' };
    }
  }

  // 4. Extract permissions from roles (already done above for system.admin check)

  // 6. Check if user has permission at all
  if (!rolePermissions.has(permission)) {
    // Check delegations as fallback
    const delegationAuth = await checkDelegationAuthority(userId, permission, locationId);
    if (delegationAuth.authorized) {
      return delegationAuth;
    }
    return { authorized: false, source: null };
  }

  // 7. Get active scopes for permission
  const now = new Date();
  const scopes = await prisma.userPermissionScope.findMany({
    where: {
      user_id: userId,
      permission: {
        name: permission,
      },
      status: 'active',
      valid_from: { lte: now },
      OR: [
        { valid_until: null },
        { valid_until: { gte: now } },
      ],
    },
  });

  // 8. Check location scope match
  const locationMatch = scopes.some((scope) => {
    if (scope.is_global) return true;
    if (!scope.location_id) return false;
    if (scope.location_id === locationId) return true;
    if (scope.include_descendants) {
      return isDescendantOf(locationId, scope.location_id);
    }
    return false;
  });

  if (locationMatch) {
    // Cache result
    await redis.setex(
      cacheKey,
      300, // 5 minutes
      JSON.stringify({
        permissions: Array.from(rolePermissions),
        locationId,
      })
    );
    return { authorized: true, source: 'direct' };
  }

  // 9. Check delegations as overlay
  const delegationAuth = await checkDelegationAuthority(userId, permission, locationId);
  return delegationAuth;
}

async function checkDelegationAuthority(
  userId: string,
  permission: string,
  locationId: string
): Promise<{
  authorized: boolean;
  source: 'direct' | 'delegation' | null;
  delegationId?: string;
}> {
  const now = new Date();
  const delegations = await prisma.delegation.findMany({
    where: {
      delegate_user_id: userId,
      permission: {
        name: permission,
      },
      status: 'active',
      valid_from: { lte: now },
      valid_until: { gte: now },
    },
  });

  for (const del of delegations) {
    if (!del.location_id) {
      // Global delegation
      return { authorized: true, source: 'delegation', delegationId: del.id };
    }
    if (del.location_id === locationId) {
      return { authorized: true, source: 'delegation', delegationId: del.id };
    }
    if (del.include_descendants) {
      const isDescendant = await isDescendantOf(locationId, del.location_id);
      if (isDescendant) {
        return { authorized: true, source: 'delegation', delegationId: del.id };
      }
    }
  }

  return { authorized: false, source: null };
}
