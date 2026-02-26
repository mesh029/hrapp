/**
 * Permissions Service
 * Dynamic permission checking for UI adaptation
 */

import { api } from './api';

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface UserPermission {
  permission: Permission;
  locationId?: string;
  isGlobal?: boolean;
}

export interface UserPermissionsResponse {
  success: boolean;
  data: {
    permissions: UserPermission[];
    roles: Array<{
      id: string;
      name: string;
      permissions: Permission[];
    }>;
  };
}

export const permissionsService = {
  /**
   * Get all permissions for the current user
   */
  async getUserPermissions(userId: string): Promise<UserPermissionsResponse> {
    // Get user with roles and permissions
    const userResponse = await api.get<any>(`/api/users/${userId}`);
    if (!userResponse.success) {
      return { success: false, data: { permissions: [], roles: [] } };
    }

    const user = (userResponse.data as any);
    const roles = user.user_roles || [];
    
    // Extract permissions from roles
    const allPermissions = new Map<string, Permission>();
    const rolePermissions: Array<{ id: string; name: string; permissions: Permission[] }> = [];

    for (const userRole of roles) {
      if (userRole.role?.status !== 'active') continue;

      const rolePerms: Permission[] = [];
      const rolePermissionsFromUser = Array.isArray(userRole.role?.role_permissions)
        ? userRole.role.role_permissions
        : [];

      for (const rp of rolePermissionsFromUser) {
        const perm = rp?.permission;
        if (!perm?.name) continue;

        const mapped: Permission = {
          id: perm.id,
          name: perm.name,
          description: perm.description,
          category: perm.module,
        };
        rolePerms.push(mapped);
        allPermissions.set(mapped.name, mapped);
      }

      // Fallback: check if role name suggests admin when permission relations are missing
      if (rolePerms.length === 0 && userRole.role.name.toLowerCase().includes('admin')) {
        const adminPerm: Permission = {
          id: 'system.admin',
          name: 'system.admin',
          description: 'System administrator - full access',
          category: 'system',
        };
        rolePerms.push(adminPerm);
        allPermissions.set('system.admin', adminPerm);
      }

      rolePermissions.push({
        id: userRole.role.id,
        name: userRole.role.name,
        permissions: rolePerms,
      });
    }

    return {
      success: true,
      data: {
        permissions: Array.from(allPermissions.values()).map(p => ({
          permission: p,
          isGlobal: p.name === 'system.admin',
        })),
        roles: rolePermissions,
      },
    };
  },

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    const response = await permissionsService.getUserPermissions(userId);
    if (!response.success) return false;

    // Check for system.admin (grants all)
    const hasSystemAdmin = response.data.permissions.some(
      p => p.permission.name === 'system.admin'
    );
    if (hasSystemAdmin) return true;

    // Check for specific permission
    return response.data.permissions.some(
      p => p.permission.name === permissionName
    );
  },

  /**
   * Get all available permissions in the system
   */
  async getAllPermissions(): Promise<{
    success: boolean;
    data: Permission[];
  }> {
    return api.get('/api/permissions');
  },
};
