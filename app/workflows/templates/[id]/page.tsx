'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Settings, Eye, AlertTriangle, User } from 'lucide-react';
import { workflowService, WorkflowTemplate, UpdateWorkflowTemplateData, WorkflowStep } from '@/ui/src/services/workflows';
import { permissionsService } from '@/ui/src/services/permissions';
import { rolesService } from '@/ui/src/services/roles';
import { locationsService } from '@/ui/src/services/locations';
import { api } from '@/ui/src/services/api';
import { useRouter, useParams } from 'next/navigation';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { usePermissions } from '@/ui/src/hooks/use-permissions';
import { StepConfigurationDialog } from '@/components/workflows/StepConfigurationDialog';
import { ApproverPreviewDialog } from '@/components/workflows/ApproverPreviewDialog';

const COMPONENT_ID_VIEW = 'workflows.templates.view';
const COMPONENT_ID_UPDATE = 'workflows.templates.update';
const COMPONENT_ID_DELETE = 'workflows.templates.delete';

export default function EditWorkflowTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { hasPermission } = usePermissions();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'workflows.templates.read',
    fallbackCheck: (features) => features.isAdmin,
  });
  const { isVisible: canUpdate } = useComponentVisibility(COMPONENT_ID_UPDATE, {
    fallbackPermission: 'workflows.templates.update',
    fallbackCheck: (features) => features.isAdmin,
  });
  // For delete, check both isAdmin and workflows.templates.delete permission
  const canDelete = features.isAdmin || hasPermission('workflows.templates.delete');

  const templateId = params.id as string;
  const [template, setTemplate] = React.useState<WorkflowTemplate | null>(null);
  const [permissions, setPermissions] = React.useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [roles, setRoles] = React.useState<Array<{ id: string; name: string }>>([]);
  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [staffTypes, setStaffTypes] = React.useState<Array<{ id: string; code: string; name: string }>>([]);
  const [leaveTypes, setLeaveTypes] = React.useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = React.useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [editingStepId, setEditingStepId] = React.useState<string | null>(null);
  const [previewStep, setPreviewStep] = React.useState<WorkflowStep | null>(null);

  const [formData, setFormData] = React.useState<UpdateWorkflowTemplateData & { steps: WorkflowStep[] }>({
    name: '',
    status: 'active',
    staff_type_id: null,
    leave_type_id: null,
    steps: [],
  });

  React.useEffect(() => {
    if (!uiLoading && canView && templateId) {
      loadData();
    }
  }, [uiLoading, canView, templateId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [templateRes, permissionsRes, rolesRes, staffTypesRes, locationsRes] = await Promise.all([
        workflowService.getTemplate(templateId),
        permissionsService.getAllPermissions(),
        rolesService.getRoles({ limit: 100, status: 'active' }),
        api.get('/api/staff-types'),
        locationsService.getLocations(),
      ]);

      if (templateRes.success && templateRes.data) {
        setTemplate(templateRes.data);
        setFormData({
          name: templateRes.data.name,
          status: templateRes.data.status,
          is_area_wide: templateRes.data.is_area_wide ?? false,
          staff_type_id: templateRes.data.staff_type_id || null,
          leave_type_id: templateRes.data.leave_type_id || null,
          steps: templateRes.data.steps || [],
        });

        // Load leave types if this is a leave workflow
        if (templateRes.data.resource_type === 'leave') {
          const leaveTypesRes = await api.get('/api/leave/types');
          if (leaveTypesRes.success && leaveTypesRes.data) {
            const leaveTypesData = leaveTypesRes.data as any;
            const leaveTypesArray = leaveTypesData.data || leaveTypesData || [];
            setLeaveTypes(Array.isArray(leaveTypesArray) ? leaveTypesArray : []);
          }
        }
      } else {
        setError('Template not found');
      }
      if (permissionsRes.success) {
        const permissionsData = permissionsRes.data as any;
        setPermissions(permissionsData.permissions || permissionsData || []);
      }
      if (rolesRes.success && rolesRes.data) {
        const rolesData = rolesRes.data as any;
        const rolesArray = rolesData.roles || rolesData.data || (Array.isArray(rolesData) ? rolesData : []);
        setRoles(rolesArray);
        console.log('[Edit Template] Loaded roles:', rolesArray.length);
      } else {
        console.error('[Edit Template] Failed to load roles:', rolesRes);
        setRoles([]);
      }
      if (staffTypesRes.success && staffTypesRes.data) {
        const staffTypesData = staffTypesRes.data as any;
        const staffTypesArray = staffTypesData.staffTypes || staffTypesData.data || staffTypesData || [];
        setStaffTypes(Array.isArray(staffTypesArray) ? staffTypesArray : []);
      }
      if (locationsRes.success) {
        const locationsData = locationsRes.data as any;
        const locs = locationsData.locations || locationsData.flat || locationsData.tree || [];
        setLocations(Array.isArray(locs) ? locs : []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStep = () => {
    setEditingStepId(null);
    setConfigDialogOpen(true);
  };

  const handleEditStep = (stepId: string) => {
    setEditingStepId(stepId);
    setConfigDialogOpen(true);
  };

  const handleSaveStep = async (stepConfig: WorkflowStep) => {
    if (!template) return;

    try {
      // Ensure step_order is set correctly
      const stepData = { ...stepConfig };
      if (!editingStepId) {
        // For new steps, calculate the next order
        const nextOrder = formData.steps.length > 0 
          ? Math.max(...formData.steps.map(s => s.step_order)) + 1
          : 1;
        stepData.step_order = nextOrder;
      }

      if (editingStepId) {
        // Update existing step
        const response = await workflowService.updateStep(template.id, editingStepId, stepData);
        if (response.success) {
          loadData();
          setConfigDialogOpen(false);
          setEditingStepId(null);
        } else {
          const errorMsg = (response as any).error || (response as any).message || 'Failed to update step';
          console.error('Update step error:', response);
          alert(errorMsg);
        }
      } else {
        // Add new step
        const response = await workflowService.addStep(template.id, stepData);
        if (response.success) {
          loadData();
          setConfigDialogOpen(false);
        } else {
          const errorMsg = (response as any).error || (response as any).message || 'Failed to add step';
          console.error('Add step error:', response);
          alert(errorMsg);
        }
      }
    } catch (err: any) {
      console.error('Failed to save step:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save step';
      alert(errorMsg);
    }
  };

  const handleRemoveStep = async (stepId: string) => {
    if (!template) return;
    if (formData.steps.length <= 1) {
      alert('At least one step is required');
      return;
    }

    if (!confirm('Are you sure you want to remove this step?')) {
      return;
    }

    try {
      const response = await workflowService.deleteStep(template.id, stepId);
      if (response.success) {
        loadData(); // Reload to get updated template
      }
    } catch (err: any) {
      console.error('Failed to remove step:', err);
      alert('Failed to remove step');
    }
  };

  const handlePreviewApprovers = (step: WorkflowStep) => {
    setPreviewStep(step);
    setPreviewDialogOpen(true);
  };

  const handleStepChange = async (stepId: string, field: keyof WorkflowStep, value: any) => {
    if (!template) return;

    try {
      const step = formData.steps.find(s => s.id === stepId);
      if (!step) return;

      await workflowService.updateStep(template.id, stepId, {
        [field]: value,
      });
      loadData(); // Reload to get updated template
    } catch (err: any) {
      console.error('Failed to update step:', err);
      alert('Failed to update step');
    }
  };

  const handleDelete = async () => {
    if (!template) return;

    const confirmMessage = `Are you sure you want to delete "${template.name}"?\n\n` +
      `This action cannot be undone. ` +
      (template._count && template._count.instances > 0
        ? `\n⚠️ Warning: This template has ${template._count.instances} active instance(s). You cannot delete templates with active instances.`
        : '');

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await workflowService.deleteTemplate(template.id);
      if (response.success) {
        router.push('/workflows/templates');
      } else {
        const errorMsg = (response as any).error || (response as any).message || 'Failed to delete template';
        alert(errorMsg);
      }
    } catch (err: any) {
      console.error('Failed to delete template:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to delete template';
      alert(errorMsg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;

    setError(null);

    // Validation
    if (!formData.name?.trim()) {
      setError('Template name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await workflowService.updateTemplate(template.id, {
        name: formData.name,
        status: formData.status,
        is_area_wide: formData.is_area_wide,
      });
      if (response.success) {
        router.push('/workflows/templates');
      } else {
        setError('Failed to update template');
      }
    } catch (err: any) {
      console.error('Failed to update template:', err);
      setError(err.message || 'Failed to update template');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to view this page
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!template || error) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            {error || 'Template not found'}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/workflows/templates')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Edit Workflow Template</h1>
            <p className="text-muted-foreground mt-1">
              {template.name}
            </p>
          </div>
          <Badge variant={template.status === 'active' ? 'default' : 'secondary'}>
            {template.status}
          </Badge>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  disabled={!canUpdate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resource_type">Resource Type</Label>
                <Input
                  id="resource_type"
                  value={template.resource_type}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={template.location?.name || template.location_id}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {template.is_area_wide 
                    ? 'Area-wide template: This template applies to all locations' 
                    : 'Location-specific template: This template only applies to the selected location'}
                </p>
              </div>

              {canUpdate && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_area_wide">Area-Wide Template</Label>
                      <Switch
                        id="is_area_wide"
                        checked={formData.is_area_wide ?? template.is_area_wide ?? false}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_area_wide: checked }))}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When enabled, this template applies to all locations (area-wide). 
                      When disabled, it only applies to the selected location (location-specific).
                    </p>
                  </div>
                </>
              )}

              {canUpdate && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="staff_type">Employee Type (Optional)</Label>
                    <Select
                      value={formData.staff_type_id || '__none__'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, staff_type_id: value === '__none__' ? null : value }))}
                    >
                      <SelectTrigger id="staff_type">
                        <SelectValue placeholder="All employee types (no filter)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">All Employee Types</SelectItem>
                        {staffTypes.map(st => (
                          <SelectItem key={st.id} value={st.id}>{st.name} ({st.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      If selected, this template will only apply to employees of this type
                    </p>
                  </div>

                  {template.resource_type === 'leave' && (
                    <div className="space-y-2">
                      <Label htmlFor="leave_type">Leave Type (Optional)</Label>
                      <Select
                        value={formData.leave_type_id || '__none__'}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, leave_type_id: value === '__none__' ? null : value }))}
                      >
                        <SelectTrigger id="leave_type">
                          <SelectValue placeholder="All leave types (no filter)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">All Leave Types</SelectItem>
                          {leaveTypes.map(lt => (
                            <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        If selected, this template will only apply to this specific leave type
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status || 'active'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as 'active' | 'deprecated' }))}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="deprecated">Deprecated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="text-sm text-muted-foreground">
                <p>Version: {template.version}</p>
                {template._count && (
                  <p>Active Instances: {template._count.instances}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Workflow Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Workflow Steps</CardTitle>
                {canUpdate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddStep}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Step
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.steps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No steps configured
                </div>
              ) : (
                formData.steps
                  .sort((a, b) => a.step_order - b.step_order)
                  .map((step, index) => (
                    <div
                      key={step.id || index}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                          <span className="font-semibold">Step {step.step_order}</span>
                        </div>
                        {canUpdate && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handlePreviewApprovers(step)}
                              title="Preview Approvers"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => step.id && handleEditStep(step.id)}
                              title="Edit Step"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            {formData.steps.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => step.id && handleRemoveStep(step.id)}
                                title="Remove Step"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`permission-${index}`}>Required Permission *</Label>
                        <Select
                          value={step.required_permission}
                          onValueChange={(value) => step.id && handleStepChange(step.id, 'required_permission', value)}
                          disabled={!canUpdate}
                        >
                          <SelectTrigger id={`permission-${index}`}>
                            <SelectValue placeholder="Select a permission" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(permissions) && permissions
                              .filter(p => {
                                if (template.resource_type === 'leave') {
                                  return p.name.includes('leave');
                                } else {
                                  return p.name.includes('timesheet') || p.name.includes('timesheets');
                                }
                              })
                              .map(perm => (
                                <SelectItem key={perm.id} value={perm.name}>
                                  {perm.name}
                                  {perm.description && ` - ${perm.description}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Required Roles Display */}
                      {(() => {
                        // Handle both string (JSON) and array formats
                        let roleIds: string[] = [];
                        if (step.required_roles) {
                          if (Array.isArray(step.required_roles)) {
                            roleIds = step.required_roles;
                          } else if (typeof step.required_roles === 'string') {
                            try {
                              roleIds = JSON.parse(step.required_roles);
                            } catch {
                              roleIds = [];
                            }
                          }
                        }
                        
                        return roleIds.length > 0 ? (
                          <div className="space-y-2">
                            <Label>Required Roles</Label>
                            <div className="flex flex-wrap gap-2">
                              {roleIds.map((roleId: string) => {
                                const role = roles.find(r => r.id === roleId);
                                return (
                                  <Badge key={roleId} variant="secondary" className="text-sm">
                                    {role ? role.name : roleId}
                                  </Badge>
                                );
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Only users with these specific roles (who also have the required permission) can approve this step.
                            </p>
                          </div>
                        ) : null;
                      })()}

                      {/* Include Manager Display */}
                      {step.include_manager && (
                        <div className="space-y-2">
                          <Label>Manager Approval</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <User className="h-3 w-3 mr-1" />
                              Manager Included
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              The employee's manager will approve this step (if they have the required permission).
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`decline-${index}`}
                            checked={step.allow_decline}
                            onCheckedChange={(checked) => step.id && handleStepChange(step.id, 'allow_decline', checked)}
                            disabled={!canUpdate}
                          />
                          <Label htmlFor={`decline-${index}`} className="cursor-pointer">
                            Allow Decline
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`adjust-${index}`}
                            checked={step.allow_adjust}
                            onCheckedChange={(checked) => step.id && handleStepChange(step.id, 'allow_adjust', checked)}
                            disabled={!canUpdate}
                          />
                          <Label htmlFor={`adjust-${index}`} className="cursor-pointer">
                            Allow Adjust
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {/* Actions */}
          {canUpdate && (
            <div className="flex items-center justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/workflows/templates')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </form>

        {/* Step Configuration Dialog */}
        {configDialogOpen && template && (
          <StepConfigurationDialog
            open={configDialogOpen}
            onClose={() => {
              setConfigDialogOpen(false);
              setEditingStepId(null);
            }}
            step={
              editingStepId
                ? formData.steps.find(s => s.id === editingStepId) || null
                : null
            }
            stepIndex={editingStepId ? formData.steps.findIndex(s => s.id === editingStepId) : formData.steps.length}
            resourceType={template.resource_type}
            permissions={permissions}
            roles={roles}
            locations={locations}
            onSave={handleSaveStep}
            onPreviewApprovers={handlePreviewApprovers}
          />
        )}

        {/* Approver Preview Dialog */}
        {previewStep && template && (
          <ApproverPreviewDialog
            open={previewDialogOpen}
            step={previewStep}
            locationId={template.location_id || ''}
            resourceType={template.resource_type}
            onClose={() => {
              setPreviewDialogOpen(false);
              setPreviewStep(null);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}
