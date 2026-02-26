/**
 * Dashboard Service
 */

import { api } from './api';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingLeaveRequests: number;
  pendingTimesheets: number;
  pendingApprovals: number;
  recentActivity?: any[];
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardStats;
}

export const dashboardService = {
  async getDashboardStats(filters?: {
    location_id?: string;
    user_id?: string;
    staff_type_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<DashboardResponse> {
    const params = new URLSearchParams();
    if (filters?.location_id) params.append('location_id', filters.location_id);
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.staff_type_id) params.append('staff_type_id', filters.staff_type_id);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const queryString = params.toString();
    return api.get<DashboardResponse>(`/api/reports/dashboard${queryString ? `?${queryString}` : ''}`);
  },

  async getPendingApprovals(filters?: {
    location_id?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{
    success: boolean;
    data: {
      leaveRequests: any[];
      timesheets: any[];
      total: number;
    };
  }> {
    const params = new URLSearchParams();
    if (filters?.location_id) params.append('location_id', filters.location_id);
    if (filters?.user_id) params.append('user_id', filters.user_id);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    
    const queryString = params.toString();
    return api.get(`/api/reports/approvals/pending${queryString ? `?${queryString}` : ''}`);
  },
};
