/**
 * User Management Service
 */

import { api } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'suspended';
  staff_number?: string;
  charge_code?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  contract_status?: string | null;
  primary_location_id?: string;
  manager_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  status?: 'active' | 'suspended';
  staff_number?: string;
  charge_code?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  primary_location_id?: string;
  manager_id?: string;
  roleIds?: string[];
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  status?: 'active' | 'suspended';
  staff_number?: string;
  charge_code?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  primary_location_id?: string;
  manager_id?: string;
}

export interface UsersListResponse {
  success: boolean;
  data: {
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface UserResponse {
  success: boolean;
  data: User;
}

export const usersService = {
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    location_id?: string;
    role_id?: string; // ENHANCED: Role filter
  }): Promise<UsersListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.location_id) queryParams.append('location_id', params.location_id);
    if (params?.role_id) queryParams.append('role_id', params.role_id); // ENHANCED: Role filter

    const query = queryParams.toString();
    return api.get<UsersListResponse>(`/api/users${query ? `?${query}` : ''}`);
  },

  async getUser(id: string): Promise<UserResponse> {
    return api.get<UserResponse>(`/api/users/${id}`);
  },

  async createUser(data: CreateUserData): Promise<UserResponse> {
    return api.post<UserResponse>('/api/users', data);
  },

  async updateUser(id: string, data: UpdateUserData): Promise<UserResponse> {
    return api.patch<UserResponse>(`/api/users/${id}`, data);
  },

  async deleteUser(id: string): Promise<void> {
    return api.delete(`/api/users/${id}`);
  },

  async bulkUpload(file: File): Promise<{
    success: boolean;
    data: {
      success: any[];
      errors: any[];
      total: number;
    };
  }> {
    const formData = new FormData();
    formData.append('file', file);

    // Use proxy route (removes double /api)
    const token = localStorage.getItem('accessToken');
    const url = '/api/proxy/users/bulk-upload';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        // Don't set Content-Type - let browser set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  async downloadTemplate(): Promise<Blob> {
    const token = localStorage.getItem('accessToken');
    // Use proxy route (removes double /api)
    const url = '/api/proxy/users/bulk-upload/template';

    const response = await fetch(url, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to download template: ${response.status} ${errorText}`);
    }

    return response.blob();
  },
};
