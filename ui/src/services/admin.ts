/**
 * Admin UI Configuration Service
 */

import { api } from './api';

export interface UserCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  priority: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  _count?: {
    assignments: number;
    visibility_configs: number;
  };
}

export interface ComponentVisibilityConfig {
  id: string;
  component_id: string;
  role_id?: string; // Role-based (primary)
  user_category_id?: string; // Legacy/optional
  user_id?: string;
  visible: boolean;
  enabled: boolean;
  priority: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
  role?: {
    id: string;
    name: string;
    description?: string;
  };
  category?: {
    id: string;
    name: string;
    color?: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface UserCategoryAssignment {
  id: string;
  user_id: string;
  user_category_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at?: string;
  notes?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  category?: {
    id: string;
    name: string;
    color?: string;
  };
}

export interface ComponentVisibilityBaselinePreview {
  role_id: string;
  role_name: string;
  profile: string;
  total_components: number;
  visible_components: number;
  hidden_components: number;
}

export const adminService = {
  // User Categories
  async getUserCategories(): Promise<{
    success: boolean;
    data: UserCategory[];
  }> {
    return api.get('/api/admin/user-categories');
  },

  async getUserCategory(id: string): Promise<{
    success: boolean;
    data: UserCategory;
  }> {
    return api.get(`/api/admin/user-categories/${id}`);
  },

  async createUserCategory(data: {
    name: string;
    description?: string;
    color?: string;
    priority?: number;
  }): Promise<{
    success: boolean;
    data: UserCategory;
  }> {
    return api.post('/api/admin/user-categories', data);
  },

  async updateUserCategory(id: string, data: {
    name?: string;
    description?: string;
    color?: string;
    priority?: number;
  }): Promise<{
    success: boolean;
    data: UserCategory;
  }> {
    return api.patch(`/api/admin/user-categories/${id}`, data);
  },

  async deleteUserCategory(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.delete(`/api/admin/user-categories/${id}`);
  },

  async getCategoryUsers(categoryId: string): Promise<{
    success: boolean;
    data: {
      category: UserCategory;
      assignments: UserCategoryAssignment[];
    };
  }> {
    return api.get(`/api/admin/user-categories/${categoryId}/users`);
  },

  async assignCategoryToUser(categoryId: string, data: {
    user_id: string;
    expires_at?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    data: UserCategoryAssignment;
  }> {
    return api.post(`/api/admin/user-categories/${categoryId}/assign`, data);
  },

  // Component Visibility
  async getComponentVisibilityConfigs(params?: {
    component_id?: string;
    role_id?: string;
    category_id?: string;
    user_id?: string;
  }): Promise<{
    success: boolean;
    data: ComponentVisibilityConfig[];
  }> {
    const queryParams = new URLSearchParams();
    if (params?.component_id) queryParams.append('component_id', params.component_id);
    if (params?.role_id) queryParams.append('role_id', params.role_id);
    if (params?.category_id) queryParams.append('category_id', params.category_id);
    if (params?.user_id) queryParams.append('user_id', params.user_id);

    const query = queryParams.toString();
    return api.get(`/api/admin/component-visibility${query ? `?${query}` : ''}`);
  },

  async getComponentVisibilityConfig(id: string): Promise<{
    success: boolean;
    data: ComponentVisibilityConfig;
  }> {
    return api.get(`/api/admin/component-visibility/${id}`);
  },

  async createComponentVisibilityConfig(data: {
    component_id: string;
    role_id?: string;
    user_category_id?: string;
    user_id?: string;
    visible?: boolean;
    enabled?: boolean;
    priority?: number;
    metadata?: any;
  }): Promise<{
    success: boolean;
    data: ComponentVisibilityConfig;
  }> {
    return api.post('/api/admin/component-visibility', data);
  },

  async updateComponentVisibilityConfig(id: string, data: {
    visible?: boolean;
    enabled?: boolean;
    priority?: number;
    metadata?: any;
  }): Promise<{
    success: boolean;
    data: ComponentVisibilityConfig;
  }> {
    return api.patch(`/api/admin/component-visibility/${id}`, data);
  },

  async deleteComponentVisibilityConfig(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.delete(`/api/admin/component-visibility/${id}`);
  },

  async getUserVisibleComponents(userId: string): Promise<{
    success: boolean;
    data: {
      user_id: string;
      categories: Array<{
        id: string;
        name: string;
        color?: string;
      }>;
      visible_components: Array<{
        component_id: string;
        visible: boolean;
        enabled: boolean;
        priority: number;
        source: 'user' | 'category';
        category?: {
          id: string;
          name: string;
          color?: string;
        };
      }>;
    };
  }> {
    return api.get(`/api/admin/component-visibility/user/${userId}`);
  },

  async previewComponentVisibilityBaseline(): Promise<{
    success: boolean;
    data: {
      total_known_components: number;
      total_roles: number;
      preview: ComponentVisibilityBaselinePreview[];
    };
  }> {
    return api.get('/api/admin/component-visibility/baseline');
  },

  async applyComponentVisibilityBaseline(data?: {
    mode?: 'apply' | 'reset';
    dry_run?: boolean;
  }): Promise<{
    success: boolean;
    data: {
      mode: 'apply' | 'reset';
      dry_run: boolean;
      total_roles: number;
      total_components: number;
      total_records: number;
      created: number;
      updated: number;
    };
    message?: string;
  }> {
    return api.post('/api/admin/component-visibility/baseline', data || {});
  },
};
