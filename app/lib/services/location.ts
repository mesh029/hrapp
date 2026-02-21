import { prisma } from '@/lib/db';
import { redis } from '@/lib/redis';

/**
 * Check if locationId is a descendant of ancestorId
 */
export async function isDescendantOf(locationId: string, ancestorId: string): Promise<boolean> {
  // Check cache
  const cacheKey = `location:tree:${ancestorId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    const tree = JSON.parse(cached);
    return tree.descendants.includes(locationId);
  }

  // Get location path
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { path: true },
  });

  const ancestor = await prisma.location.findUnique({
    where: { id: ancestorId },
    select: { path: true },
  });

  if (!location || !ancestor) {
    return false;
  }

  // Check if location path starts with ancestor path
  const isDescendant = location.path.startsWith(ancestor.path + '.') || location.path === ancestor.path;

  // Cache tree structure
  const tree = await buildLocationTree(ancestorId);
  await redis.setex(cacheKey, 3600, JSON.stringify(tree)); // 1 hour TTL

  return isDescendant;
}

/**
 * Build location tree structure for caching
 */
async function buildLocationTree(locationId: string) {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    return { ancestors: [], descendants: [], path: '' };
  }

  // Get all descendants
  const descendants = await prisma.location.findMany({
    where: {
      path: {
        startsWith: location.path + '.',
      },
    },
    select: { id: true },
  });

  // Get all ancestors
  const pathParts = location.path.split('.');
  const ancestorIds: string[] = [];
  for (let i = 1; i < pathParts.length; i++) {
    const ancestorPath = pathParts.slice(0, i).join('.');
    const ancestor = await prisma.location.findFirst({
      where: { path: ancestorPath },
      select: { id: true },
    });
    if (ancestor) {
      ancestorIds.push(ancestor.id);
    }
  }

  return {
    ancestors: ancestorIds,
    descendants: descendants.map((d) => d.id),
    path: location.path,
  };
}

/**
 * Get all descendants of a location
 */
export async function getDescendants(locationId: string): Promise<string[]> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { path: true },
  });

  if (!location) {
    return [];
  }

  const descendants = await prisma.location.findMany({
    where: {
      path: {
        startsWith: location.path + '.',
      },
    },
    select: { id: true },
  });

  return descendants.map((d) => d.id);
}

/**
 * Get all ancestors of a location
 */
export async function getAncestors(locationId: string): Promise<string[]> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { path: true },
  });

  if (!location) {
    return [];
  }

  const pathParts = location.path.split('.');
  const ancestorIds: string[] = [];
  
  for (let i = 1; i < pathParts.length; i++) {
    const ancestorPath = pathParts.slice(0, i).join('.');
    const ancestor = await prisma.location.findFirst({
      where: { path: ancestorPath },
      select: { id: true },
    });
    if (ancestor) {
      ancestorIds.push(ancestor.id);
    }
  }

  return ancestorIds;
}

/**
 * Calculate path for a new location based on parent
 */
export async function calculatePath(parentId: string | null): Promise<string> {
  if (!parentId) {
    // Root level - find max path number
    const roots = await prisma.location.findMany({
      where: { parent_id: null },
      orderBy: { path: 'desc' },
      take: 1,
    });

    if (roots.length === 0) {
      return '1';
    }

    const maxPath = parseInt(roots[0].path);
    return `${maxPath + 1}`;
  }

  const parent = await prisma.location.findUnique({
    where: { id: parentId },
    select: { path: true },
  });

  if (!parent) {
    throw new Error('Parent location not found');
  }

  // Find max child path number
  const children = await prisma.location.findMany({
    where: {
      path: {
        startsWith: parent.path + '.',
      },
    },
    orderBy: { path: 'desc' },
    take: 1,
  });

  if (children.length === 0) {
    return `${parent.path}.1`;
  }

  const lastChildPath = children[0].path;
  const pathParts = lastChildPath.split('.');
  const lastNumber = parseInt(pathParts[pathParts.length - 1]);
  return `${parent.path}.${lastNumber + 1}`;
}

/**
 * Calculate level for a location based on path
 */
export function calculateLevel(path: string): number {
  return path.split('.').length - 1;
}

/**
 * Validate location tree integrity
 */
export async function validateTreeIntegrity(locationId: string): Promise<boolean> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { parent: true },
  });

  if (!location) {
    return false;
  }

  // Check path matches parent
  if (location.parent_id) {
    if (!location.parent) {
      return false;
    }
    if (!location.path.startsWith(location.parent.path + '.')) {
      return false;
    }
  } else {
    // Root location should have simple numeric path
    if (!/^\d+$/.test(location.path)) {
      return false;
    }
  }

  // Check level matches path depth
  const expectedLevel = calculateLevel(location.path);
  if (location.level !== expectedLevel) {
    return false;
  }

  return true;
}
