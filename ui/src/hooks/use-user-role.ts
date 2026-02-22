'use client';

import * as React from 'react';
import { useAuth } from '../contexts/auth-context';
import { rolesService } from '../services/roles';

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [roles, setRoles] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (user?.id) {
      loadUserRoles();
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadUserRoles = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await rolesService.getUserRoles(user.id);
      if (response.success && response.data) {
        const userRoles = response.data;
        setRoles(userRoles.map(ur => ur.role));
        
        // Check if user has admin role
        // Check for role name containing "admin" or check for system.admin permission
        const hasAdmin = userRoles.some((ur) => {
          if (ur.role.status !== 'active') return false;
          const roleName = ur.role.name.toLowerCase();
          return roleName.includes('admin') || roleName === 'system admin';
        });
        
        // Also check if user has system.admin permission (via role permissions)
        // This is a fallback check - we'll need to fetch full user details for this
        setIsAdmin(hasAdmin);
      }
    } catch (error) {
      console.error('Failed to load user roles:', error);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAdmin,
    roles,
    isLoading,
    refreshRoles: loadUserRoles,
  };
}
