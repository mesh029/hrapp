/**
 * Leave Management Service
 */

import { api } from './api';

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: 'Draft' | 'Submitted' | 'UnderReview' | 'Approved' | 'Declined' | 'Adjusted' | 'Cancelled';
  location_id: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  leave_type?: {
    id: string;
    name: string;
    max_days_per_year: number;
  };
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  allocated: number;
  used: number;
  pending: number;
  year: number;
  leave_type?: {
    id: string;
    name: string;
    max_days_per_year: number;
  };
}

export interface LeaveType {
  id: string;
  name: string;
  description?: string;
  max_days_per_year: number;
  carry_forward_allowed: boolean;
  carry_forward_days?: number;
  status: 'active' | 'inactive';
}

export interface CreateLeaveRequestData {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  location_id?: string;
}

export interface LeaveRequestsListResponse {
  success: boolean;
  data: {
    requests: LeaveRequest[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export const leaveService = {
  /**
   * Get leave requests
   */
  async getLeaveRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
    user_id?: string;
    leave_type_id?: string;
  }): Promise<LeaveRequestsListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.leave_type_id) queryParams.append('leave_type_id', params.leave_type_id);

    const query = queryParams.toString();
    const response = await api.get(`/api/leave/requests${query ? `?${query}` : ''}`);
    
    // Debug logging
    console.log('[Leave Service] getLeaveRequests raw response:', response);
    
    // Handle different response structures
    if (response.success) {
      // Check if data is nested
      const data = response.data as any;
      if (data?.data) {
        // Response is nested: { success: true, data: { requests: [], pagination: {} } }
        return {
          success: true,
          data: data.data,
        } as LeaveRequestsListResponse;
      } else if (data?.requests) {
        // Response is direct: { success: true, data: { requests: [], pagination: {} } }
        return {
          success: true,
          data: data,
        } as LeaveRequestsListResponse;
      }
    }
    
    return response as LeaveRequestsListResponse;
  },

  /**
   * Get a single leave request
   */
  async getLeaveRequest(id: string): Promise<{
    success: boolean;
    data: LeaveRequest;
  }> {
    return api.get(`/api/leave/requests/${id}`);
  },

  /**
   * Create a leave request
   */
  async createLeaveRequest(data: CreateLeaveRequestData): Promise<{
    success: boolean;
    data: LeaveRequest;
  }> {
    return api.post('/api/leave/requests', data);
  },

  /**
   * Update a leave request
   */
  async updateLeaveRequest(id: string, data: Partial<CreateLeaveRequestData>): Promise<{
    success: boolean;
    data: LeaveRequest;
  }> {
    return api.patch(`/api/leave/requests/${id}`, data);
  },

  /**
   * Cancel a leave request
   */
  async cancelLeaveRequest(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.post(`/api/leave/requests/${id}/cancel`);
  },

  /**
   * Get leave balances for a user
   */
  async getLeaveBalances(userId?: string): Promise<{
    success: boolean;
    data: LeaveBalance[];
  }> {
    if (userId) {
      return api.get(`/api/leave/balances/user/${userId}`);
    }
    return api.get('/api/leave/balances');
  },

  /**
   * Get leave types
   */
  async getLeaveTypes(): Promise<{
    success: boolean;
    data: LeaveType[];
  }> {
    return api.get('/api/leave/types');
  },
};
