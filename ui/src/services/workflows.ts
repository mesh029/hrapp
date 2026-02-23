import { api } from './api';

export interface WorkflowStep {
  id?: string;
  step_order: number;
  required_permission: string;
  allow_decline: boolean;
  allow_adjust: boolean;
  // Approver Resolution Configuration
  approver_strategy?: 'permission' | 'manager' | 'role' | 'combined';
  include_manager?: boolean;
  required_roles?: string[]; // Role IDs
  location_scope?: 'same' | 'parent' | 'descendants' | 'all';
  conditional_rules?: Array<{
    condition: string;
    approver_strategy: string;
  }>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  resource_type: 'leave' | 'timesheet';
  location_id: string;
  location?: {
    id: string;
    name: string;
  };
  version: number;
  status: 'active' | 'deprecated';
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
  _count?: {
    instances: number;
  };
}

export interface CreateWorkflowTemplateData {
  name: string;
  resource_type: 'leave' | 'timesheet';
  location_id: string;
  steps: Omit<WorkflowStep, 'id'>[];
}

export interface UpdateWorkflowTemplateData {
  name?: string;
  status?: 'active' | 'deprecated';
}

export const workflowService = {
  /**
   * List workflow templates
   */
  async getTemplates(params?: {
    page?: number;
    limit?: number;
    resource_type?: 'leave' | 'timesheet';
    location_id?: string;
    status?: 'active' | 'deprecated';
    search?: string;
  }): Promise<{
    success: boolean;
    data: {
      templates: WorkflowTemplate[];
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
    if (params?.resource_type) queryParams.append('resource_type', params.resource_type);
    if (params?.location_id) queryParams.append('location_id', params.location_id);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.search) queryParams.append('search', params.search);

    const query = queryParams.toString();
    return api.get(`/api/workflows/templates${query ? `?${query}` : ''}`);
  },

  /**
   * Get a single workflow template
   */
  async getTemplate(id: string): Promise<{
    success: boolean;
    data: WorkflowTemplate;
  }> {
    return api.get(`/api/workflows/templates/${id}`);
  },

  /**
   * Create a workflow template
   */
  async createTemplate(data: CreateWorkflowTemplateData): Promise<{
    success: boolean;
    data: WorkflowTemplate;
  }> {
    return api.post('/api/workflows/templates', data);
  },

  /**
   * Update a workflow template
   */
  async updateTemplate(id: string, data: UpdateWorkflowTemplateData): Promise<{
    success: boolean;
    data: WorkflowTemplate;
  }> {
    return api.patch(`/api/workflows/templates/${id}`, data);
  },

  /**
   * Delete a workflow template
   */
  async deleteTemplate(id: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    return api.delete(`/api/workflows/templates/${id}`);
  },

  /**
   * Add a step to a workflow template
   */
  async addStep(templateId: string, step: Omit<WorkflowStep, 'id'>): Promise<{
    success: boolean;
    data: WorkflowStep;
  }> {
    return api.post(`/api/workflows/templates/${templateId}/steps`, step);
  },

  /**
   * Update a workflow step
   */
  async updateStep(templateId: string, stepId: string, step: Partial<Omit<WorkflowStep, 'id'>>): Promise<{
    success: boolean;
    data: WorkflowStep;
  }> {
    return api.patch(`/api/workflows/templates/${templateId}/steps/${stepId}`, step);
  },

  /**
   * Delete a workflow step
   */
  async deleteStep(templateId: string, stepId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    return api.delete(`/api/workflows/templates/${templateId}/steps/${stepId}`);
  },
};
