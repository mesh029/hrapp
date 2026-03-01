import { api } from './api';

export interface EmployeeOverview {
  user: {
    id: string;
    name: string;
    email: string;
    primary_location: {
      id: string;
      name: string;
    } | null;
    manager: {
      id: string;
      name: string;
      email: string;
    } | null;
    staff_type: {
      id: string;
      name: string;
      code: string;
    } | null;
    contract: {
      start_date: string | null;
      end_date: string | null;
      status: string | null;
      period_days: number | null;
      period_months: number | null;
    };
  };
  leave_balances: Array<{
    leave_type: {
      id: string;
      name: string;
    };
    year: number;
    allocated: number;
    used: number;
    pending: number;
    available: number;
    explanation: string;
    max_days_per_year: number | null;
  }>;
  recent_leave_requests: Array<{
    id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    status: string;
    workflow_instance_id: string | null;
    created_at: string;
    updated_at: string;
    leave_type: {
      id: string;
      name: string;
    };
    workflow_timeline: {
      leave_request_id: string;
      workflow_instance_id: string;
      workflow_status: string;
      current_step_order: number | null;
      timeline: Array<{
        step_order: number;
        required_permission: string;
        status: string;
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
        assigned_approvers?: Array<{ id: string; name: string; email: string }>;
      }>;
    } | null;
  }>;
  recent_timesheets: Array<{
    id: string;
    period_start: string;
    period_end: string;
    status: string;
    workflow_instance_id: string | null;
    created_at: string;
    updated_at: string;
    workflow_timeline: {
      timesheet_id: string;
      workflow_instance_id: string;
      workflow_status: string;
      current_step_order: number | null;
      timeline: Array<{
        step_order: number;
        required_permission: string;
        status: string;
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
        assigned_approvers?: Array<{ id: string; name: string; email: string }>;
      }>;
    } | null;
  }>;
  active_workflow_templates: Array<{
    id: string;
    name: string;
    resource_type: 'leave' | 'timesheet';
          steps: Array<{
            step_order: number;
            required_permission: string;
            allow_decline: boolean;
            allow_adjust: boolean;
            approvers: Array<{ id: string; name: string; email: string; roles?: string[] }>;
            error?: string;
            warnings?: string[];
          }>;
  }>;
  timesheet_submission_window: {
    is_open: boolean;
    current_period: {
      id: string;
      period_start: string;
      period_end: string;
      submission_enabled: boolean;
    } | null;
  };
}

export const employeesService = {
  /**
   * Get comprehensive employee overview
   */
  async getOverview(): Promise<{
    success: boolean;
    data: EmployeeOverview;
  }> {
    return api.get('/api/employees/overview');
  },
};
