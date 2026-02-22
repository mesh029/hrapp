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
  async getDashboardStats(): Promise<DashboardResponse> {
    return api.get<DashboardResponse>('/api/reports/dashboard');
  },

  async getPendingApprovals(): Promise<{
    success: boolean;
    data: {
      leaveRequests: any[];
      timesheets: any[];
      total: number;
    };
  }> {
    return api.get('/api/reports/approvals/pending');
  },
};
