import { api } from './api';

export interface LeaveAccrualConfig {
  id: string;
  leave_type_id: string;
  location_id: string | null;
  staff_type_id: string | null;
  accrual_rate: number | string;
  accrual_period: 'monthly' | 'quarterly' | 'annual';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  leave_type?: { id: string; name: string };
  location?: { id: string; name: string } | null;
  staff_type?: { id: string; code: string; name: string } | null;
}

export const leaveAccrualService = {
  async getConfigs(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const res = await api.get<any>(`/api/leave/accrual/configs${query.toString() ? `?${query.toString()}` : ''}`);
    return res;
  },

  async createConfig(payload: {
    leave_type_id: string;
    location_id?: string | null;
    staff_type_id?: string | null;
    accrual_rate: number;
    accrual_period: 'monthly' | 'quarterly' | 'annual';
    is_active?: boolean;
  }) {
    return api.post<any>('/api/leave/accrual/configs', payload);
  },

  async updateConfig(
    id: string,
    payload: Partial<{
      accrual_rate: number;
      accrual_period: 'monthly' | 'quarterly' | 'annual';
      is_active: boolean;
    }>
  ) {
    return api.patch<any>(`/api/leave/accrual/configs/${id}`, payload);
  },

  async deleteConfig(id: string) {
    return api.delete<any>(`/api/leave/accrual/configs/${id}`);
  },

  async applyAccrual(payload: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    role_ids?: string[];
    user_category_ids?: string[];
    user_ids?: string[];
    location_id?: string | null;
    staff_type_id?: string | null;
    dry_run?: boolean;
  }) {
    return api.post<any>('/api/leave/accrual/apply', payload);
  },
};
