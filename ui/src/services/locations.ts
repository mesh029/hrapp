/**
 * Locations Service
 */

import { api } from './api';

export interface Location {
  id: string;
  name: string;
  parent_id?: string;
  path: string;
  level: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  parent?: {
    id: string;
    name: string;
  };
  children?: Location[];
  _count?: {
    children: number;
    users_primary: number;
  };
}

export const locationsService = {
  /**
   * Get all locations
   */
  async getLocations(params?: {
    status?: string;
    tree?: boolean;
  }): Promise<{
    success: boolean;
    data: {
      locations?: Location[];
      tree?: Location[];
      flat?: Location[];
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.tree) queryParams.append('tree', 'true');

    const query = queryParams.toString();
    return api.get(`/api/locations${query ? `?${query}` : ''}`);
  },

  /**
   * Get a single location
   */
  async getLocation(id: string): Promise<{
    success: boolean;
    data: Location;
  }> {
    return api.get(`/api/locations/${id}`);
  },

  /**
   * Create a new location
   */
  async createLocation(data: {
    name: string;
    parent_id?: string;
    status?: 'active' | 'inactive';
  }): Promise<{
    success: boolean;
    data: Location;
  }> {
    return api.post('/api/locations', data);
  },

  /**
   * Update a location
   */
  async updateLocation(id: string, data: {
    name?: string;
    parent_id?: string;
    status?: 'active' | 'inactive';
  }): Promise<{
    success: boolean;
    data: Location;
  }> {
    return api.patch(`/api/locations/${id}`, data);
  },

  /**
   * Delete a location (soft delete)
   */
  async deleteLocation(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.delete(`/api/locations/${id}`);
  },

  /**
   * Move location in tree
   */
  async moveLocation(id: string, newParentId: string | null): Promise<{
    success: boolean;
    data: Location;
  }> {
    return api.patch(`/api/locations/${id}/move`, { parent_id: newParentId });
  },

  /**
   * Get location ancestors
   */
  async getAncestors(id: string): Promise<{
    success: boolean;
    data: Location[];
  }> {
    return api.get(`/api/locations/${id}/ancestors`);
  },

  /**
   * Get location descendants
   */
  async getDescendants(id: string): Promise<{
    success: boolean;
    data: Location[];
  }> {
    return api.get(`/api/locations/${id}/descendants`);
  },
};
