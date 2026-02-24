/**
 * Roles & Permissions Service
 */

import { api } from './api';

export interface Role {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  _count?: {
    role_permissions: number;
    user_roles: number;
  };
}

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  permission: Permission;
}

export const rolesService = {
  /**
   * Get all roles
   */
  async getRoles(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{
    success: boolean;
    data: {
      roles: Role[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return api.get(`/api/roles${query ? `?${query}` : ''}`);
  },

  /**
   * Get a single role
   */
  async getRole(id: string): Promise<{
    success: boolean;
    data: Role;
  }> {
    return api.get(`/api/roles/${id}`);
  },

  /**
   * Create a new role
   */
  async createRole(data: {
    name: string;
    description?: string;
  }): Promise<{
    success: boolean;
    data: Role;
  }> {
    return api.post('/api/roles', data);
  },

  /**
   * Update a role
   */
  async updateRole(id: string, data: {
    name?: string;
    description?: string;
    status?: 'active' | 'inactive';
  }): Promise<{
    success: boolean;
    data: Role;
  }> {
    return api.patch(`/api/roles/${id}`, data);
  },

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.delete(`/api/roles/${id}`);
  },

  /**
   * Get role permissions
   */
  async getRolePermissions(roleId: string): Promise<{
    success: boolean;
    data: {
      roleId: string;
      roleName: string;
      permissions: Permission[];
    } | RolePermission[];
  }> {
    return api.get(`/api/roles/${roleId}/permissions`);
  },

  /**
   * Assign permission to role
   */
  async assignPermission(roleId: string, permissionId: string): Promise<{
    success: boolean;
    data: RolePermission;
  }> {
    return api.post(`/api/roles/${roleId}/permissions`, { permissionId: permissionId });
  },

  /**
   * Remove permission from role
   */
  async removePermission(roleId: string, permissionId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.delete(`/api/roles/${roleId}/permissions/${permissionId}`);
  },
};

export const permissionsService = {
  /**
   * Get all permissions
   */
  async getPermissions(): Promise<{
    success: boolean;
    data: Permission[];
  }> {
    return api.get('/api/permissions');
  },

  /**
   * Get a single permission
   */
  async getPermission(id: string): Promise<{
    success: boolean;
    data: Permission;
  }> {
    return api.get(`/api/permissions/${id}`);
  },
};
