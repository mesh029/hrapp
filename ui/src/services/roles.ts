/**
 * Roles and Permissions Service
 */

import { api } from './api';

export interface Role {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  role: Role;
}

export interface UserPermissions {
  isAdmin: boolean;
  roles: Role[];
  permissions: string[];
}

export const rolesService = {
  async getUserRoles(userId: string): Promise<{
    success: boolean;
    data: UserRole[];
  }> {
    return api.get(`/api/users/${userId}/roles`);
  },

  async checkIsAdmin(userId: string): Promise<boolean> {
    try {
      const response = await rolesService.getUserRoles(userId);
      if (response.success && response.data) {
        return response.data.some(
          (userRole) => 
            userRole.role.status === 'active' && 
            userRole.role.name.toLowerCase().includes('admin')
        );
      }
      return false;
    } catch {
      return false;
    }
  },
};
