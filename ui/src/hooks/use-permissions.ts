'use client';

import * as React from 'react';
import { useAuth } from '../contexts/auth-context';
import { permissionsService } from '../services/permissions';

const permissionsCache = new Map<string, string[]>();
const permissionsInFlight = new Map<string, Promise<string[]>>();

async function fetchPermissionsForUser(userId: string): Promise<string[]> {
  if (permissionsCache.has(userId)) {
    return permissionsCache.get(userId)!;
  }

  const existingPromise = permissionsInFlight.get(userId);
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = (async () => {
    const response = await permissionsService.getUserPermissions(userId);
    if (response.success && response.data) {
      const permissionNames = response.data.permissions.map((p) => p.permission.name);
      permissionsCache.set(userId, permissionNames);
      return permissionNames;
    }
    return [];
  })();

  permissionsInFlight.set(userId, requestPromise);
  try {
    return await requestPromise;
  } finally {
    permissionsInFlight.delete(userId);
  }
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (user?.id) {
      if (permissionsCache.has(user.id)) {
        setPermissions(permissionsCache.get(user.id)!);
      }
      loadPermissions();
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadPermissions = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const permissionNames = await fetchPermissionsForUser(user.id);
      setPermissions(permissionNames);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = React.useCallback((permissionName: string): boolean => {
    // system.admin grants all permissions
    if (permissions.includes('system.admin')) {
      return true;
    }
    return permissions.includes(permissionName);
  }, [permissions]);

  const hasAnyPermission = React.useCallback((permissionNames: string[]): boolean => {
    if (permissions.includes('system.admin')) {
      return true;
    }
    return permissionNames.some(name => permissions.includes(name));
  }, [permissions]);

  const hasAllPermissions = React.useCallback((permissionNames: string[]): boolean => {
    if (permissions.includes('system.admin')) {
      return true;
    }
    return permissionNames.every(name => permissions.includes(name));
  }, [permissions]);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading,
    refreshPermissions: loadPermissions,
  };
}
