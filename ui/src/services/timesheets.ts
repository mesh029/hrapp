/**
 * Timesheet Management Service
 */

import { api } from './api';

export interface Timesheet {
  id: string;
  user_id: string;
  location_id: string;
  period_start: string;
  period_end: string;
  status: 'Draft' | 'Submitted' | 'UnderReview' | 'Approved' | 'Declined' | 'Locked';
  total_hours?: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  location?: {
    id: string;
    name: string;
  };
  entries?: TimesheetEntry[];
}

export interface TimesheetEntry {
  id: string;
  timesheet_id: string;
  date: string;
  work_hours: number;
  leave_hours: number;
  holiday_hours: number;
  weekend_extra_hours: number;
  overtime_hours: number;
  notes?: string;
}

export interface CreateTimesheetData {
  period_start: string;
  period_end: string;
  location_id?: string;
}

export interface UpdateTimesheetEntriesData {
  entries: Array<{
    date: string;
    work_hours?: number;
    leave_hours?: number;
    holiday_hours?: number;
    weekend_extra_hours?: number;
    overtime_hours?: number;
    notes?: string;
  }>;
}

export interface TimesheetsListResponse {
  success: boolean;
  data: {
    timesheets: Timesheet[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export const timesheetService = {
  /**
   * Get timesheets
   */
  async getTimesheets(params?: {
    page?: number;
    limit?: number;
    status?: string;
    user_id?: string;
  }): Promise<TimesheetsListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.user_id) queryParams.append('user_id', params.user_id);

    const query = queryParams.toString();
    const response = await api.get(`/api/timesheets${query ? `?${query}` : ''}`);
    
    // Handle nested response structure
    if (response.success) {
      const data = (response.data as any)?.data || response.data;
      if (data?.timesheets) {
        return {
          success: true,
          data: {
            timesheets: data.timesheets,
            pagination: data.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 },
          },
        };
      }
    }
    
    return response as TimesheetsListResponse;
  },

  /**
   * Get a single timesheet
   */
  async getTimesheet(id: string): Promise<{
    success: boolean;
    data: Timesheet;
  }> {
    return api.get(`/api/timesheets/${id}`);
  },

  /**
   * Create a timesheet
   */
  async createTimesheet(data: CreateTimesheetData): Promise<{
    success: boolean;
    data: Timesheet;
  }> {
    return api.post('/api/timesheets', data);
  },

  /**
   * Update timesheet entries
   */
  async updateTimesheetEntries(id: string, data: UpdateTimesheetEntriesData): Promise<{
    success: boolean;
    data: Timesheet;
  }> {
    return api.patch(`/api/timesheets/${id}/entries`, data);
  },

  /**
   * Submit a timesheet
   */
  async submitTimesheet(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.post(`/api/timesheets/${id}/submit`);
  },

  /**
   * Delete a timesheet (admin only)
   */
  async deleteTimesheet(id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return api.delete(`/api/timesheets/${id}`);
  },

  /**
   * Validate a timesheet
   */
  async validateTimesheet(id: string): Promise<{
    success: boolean;
    data: {
      canSubmit: boolean;
      validation: {
        valid: boolean;
        notes: string[];
      };
    };
  }> {
    return api.get(`/api/timesheets/${id}/validate`);
  },

  /**
   * Request weekend extra hours
   */
  async requestWeekendExtra(timesheetId: string, data: {
    entry_date: string;
    requested_hours: number;
    reason: string;
  }): Promise<{
    success: boolean;
    data: WeekendExtraRequest;
  }> {
    return api.post(`/api/timesheets/${timesheetId}/weekend-extra`, data);
  },

  /**
   * Request overtime hours
   */
  async requestOvertime(data: {
    timesheet_id: string;
    entry_date: string;
    requested_hours: number;
    reason: string;
  }): Promise<{
    success: boolean;
    data: OvertimeRequest;
  }> {
    return api.post('/api/timesheets/overtime', data);
  },

  /**
   * Approve weekend extra request
   */
  async approveWeekendExtra(requestId: string, data?: {
    notes?: string;
  }): Promise<{
    success: boolean;
    data: WeekendExtraRequest;
  }> {
    return api.post(`/api/timesheets/weekend-extra/${requestId}/approve`, data || {});
  },

  /**
   * Decline weekend extra request
   */
  async declineWeekendExtra(requestId: string, data: {
    reason: string;
  }): Promise<{
    success: boolean;
    data: WeekendExtraRequest;
  }> {
    return api.post(`/api/timesheets/weekend-extra/${requestId}/decline`, data);
  },

  /**
   * Approve overtime request
   */
  async approveOvertime(requestId: string, data?: {
    notes?: string;
  }): Promise<{
    success: boolean;
    data: OvertimeRequest;
  }> {
    return api.post(`/api/timesheets/overtime/${requestId}/approve`, data || {});
  },

  /**
   * Decline overtime request
   */
  async declineOvertime(requestId: string, data: {
    reason: string;
  }): Promise<{
    success: boolean;
    data: OvertimeRequest;
  }> {
    return api.post(`/api/timesheets/overtime/${requestId}/decline`, data);
  },

  /**
   * Get pending requests (weekend extra and overtime)
   */
  async getPendingRequests(): Promise<{
    success: boolean;
    data: {
      weekend_extra: WeekendExtraRequest[];
      overtime: OvertimeRequest[];
    };
  }> {
    return api.get('/api/timesheets/requests/pending');
  },

  /**
   * Get workflow timeline for a timesheet
   */
  async getTimesheetWorkflow(id: string): Promise<{
    success: boolean;
    data: {
      has_workflow: boolean;
      workflow_instance_id?: string;
      workflow_status?: string;
      current_step_order?: number;
      created_at?: string;
      updated_at?: string;
      creator?: {
        id: string;
        name: string;
        email: string;
      };
      timeline: Array<{
        step_order: number;
        required_permission: string;
        allow_decline: boolean;
        allow_adjust: boolean;
        status: 'pending' | 'approved' | 'declined' | 'adjusted';
        actor: {
          id: string;
          name: string;
          email: string;
        } | null;
        acted_at: string | null;
        comment: string | null;
        is_current: boolean;
        is_completed: boolean;
        is_pending: boolean;
        is_upcoming: boolean;
      }>;
    };
  }> {
    return api.get(`/api/timesheets/${id}/workflow`);
  },
};

export interface WeekendExtraRequest {
  id: string;
  timesheet_id: string;
  entry_date: string;
  requested_hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  declined_by?: string;
  declined_at?: string;
  timesheet?: Timesheet;
}

export interface OvertimeRequest {
  id: string;
  timesheet_id: string;
  entry_date: string;
  requested_hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  declined_by?: string;
  declined_at?: string;
  timesheet?: Timesheet;
}
