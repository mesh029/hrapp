import { prisma } from '@/lib/db';
import { isDescendantOf } from './location';

/**
 * Check if a delegation is valid (time, status)
 */
export function isDelegationValid(delegation: {
  status: string;
  valid_from: Date;
  valid_until: Date;
  revoked_at: Date | null;
}): boolean {
  const now = new Date();
  
  // Check status
  if (delegation.status !== 'active') {
    return false;
  }
  
  // Check if revoked
  if (delegation.revoked_at) {
    return false;
  }
  
  // Check time bounds
  if (now < delegation.valid_from || now > delegation.valid_until) {
    return false;
  }
  
  return true;
}

/**
 * Check for overlapping delegations
 * Returns true if there's an overlap with an active delegation
 */
export async function hasOverlappingDelegation(params: {
  delegator_user_id: string;
  delegate_user_id: string;
  permission_id: string;
  location_id: string | null;
  include_descendants: boolean;
  valid_from: Date;
  valid_until: Date;
  exclude_id?: string; // For updates, exclude the current delegation
}): Promise<boolean> {
  const {
    delegator_user_id,
    delegate_user_id,
    permission_id,
    location_id,
    include_descendants,
    valid_from,
    valid_until,
    exclude_id,
  } = params;

  // Find all active delegations for this combination
  const existingDelegations = await prisma.delegation.findMany({
    where: {
      delegator_user_id,
      delegate_user_id,
      permission_id,
      status: 'active',
      revoked_at: null,
      id: exclude_id ? { not: exclude_id } : undefined,
    },
    include: {
      location: true,
    },
  });

  // Check for time overlap
  for (const existing of existingDelegations) {
    // Check if time ranges overlap
    const timeOverlap =
      (valid_from <= existing.valid_until && valid_until >= existing.valid_from);

    if (!timeOverlap) {
      continue;
    }

    // Check location overlap
    if (!location_id && !existing.location_id) {
      // Both are global - overlap
      return true;
    }

    if (!location_id && existing.location_id) {
      // New is global, existing is location-specific - overlap
      return true;
    }

    if (location_id && !existing.location_id) {
      // New is location-specific, existing is global - overlap
      return true;
    }

    if (location_id && existing.location_id) {
      // Both are location-specific
      if (location_id === existing.location_id) {
        // Same location - overlap
        return true;
      }

      // Check if one includes the other as descendant
      if (include_descendants) {
        const isDescendant = await isDescendantOf(existing.location_id, location_id);
        if (isDescendant) {
          return true;
        }
      }

      if (existing.include_descendants) {
        const isDescendant = await isDescendantOf(location_id, existing.location_id);
        if (isDescendant) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Auto-expire delegations that have passed their valid_until date
 */
export async function expireDelegations(): Promise<number> {
  const now = new Date();
  
  const result = await prisma.delegation.updateMany({
    where: {
      status: 'active',
      valid_until: { lt: now },
    },
    data: {
      status: 'expired',
    },
  });

  return result.count;
}

/**
 * Get active delegations for a user
 */
export async function getActiveDelegationsForUser(
  userId: string,
  options?: {
    permission?: string;
    locationId?: string;
  }
) {
  const now = new Date();
  
  const delegations = await prisma.delegation.findMany({
    where: {
      delegate_user_id: userId,
      status: 'active',
      revoked_at: null,
      valid_from: { lte: now },
      valid_until: { gte: now },
      ...(options?.permission && {
        permission: {
          name: options.permission,
        },
      }),
    },
    include: {
      delegator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      delegate: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      permission: {
        select: {
          id: true,
          name: true,
          module: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      valid_until: 'asc',
    },
  });

  // Filter by location if specified
  if (options?.locationId) {
    return delegations.filter((del) => {
      if (!del.location_id) {
        return true; // Global delegation
      }
      if (del.location_id === options.locationId) {
        return true; // Exact match
      }
      if (del.include_descendants) {
        // Check if locationId is a descendant
        return isDescendantOf(options.locationId, del.location_id);
      }
      return false;
    });
  }

  return delegations;
}

/**
 * Get delegations created by a user
 */
export async function getDelegationsByDelegator(
  delegatorId: string,
  options?: {
    status?: 'active' | 'revoked' | 'expired';
    includeExpired?: boolean;
  }
) {
  const now = new Date();
  
  const where: any = {
    delegator_user_id: delegatorId,
  };

  if (options?.status) {
    where.status = options.status;
  } else if (!options?.includeExpired) {
    // Only active and revoked, exclude expired
    where.status = { in: ['active', 'revoked'] };
  }

  return await prisma.delegation.findMany({
    where,
    include: {
      delegator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      delegate: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      permission: {
        select: {
          id: true,
          name: true,
          module: true,
        },
      },
      location: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}
