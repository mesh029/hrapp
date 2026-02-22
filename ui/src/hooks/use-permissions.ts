'use client';

import * as React from 'react';
import { useAuth } from '../contexts/auth-context';
import { permissionsService, Permission } from '../services/permissions';

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [allPermissions, setAllPermissions] = React.useState<Permission[]>([]);

  React.useEffect(() => {
    if (user?.id) {
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
      const response = await permissionsService.getUserPermissions(user.id);
      console.log('[usePermissions] Raw response:', response);
      
      if (response.success && response.data) {
        const permNames = response.data.permissions.map(p => p.permission.name);
        console.log('[usePermissions] Loaded permissions:', permNames);
        setPermissions(permNames);
      } else {
        console.warn('[usePermissions] Failed to load permissions:', response);
      }
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
      console.log(`[Permissions] system.admin detected - granting ${permissionName}`);
      return true;
    }
    const hasPerm = permissions.includes(permissionName);
    console.log(`[Permissions] Checking ${permissionName}:`, hasPerm, 'Available permissions:', permissions);
    return hasPerm;
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
