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
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { workflowService, WorkflowTemplate, UpdateWorkflowTemplateData, WorkflowStep } from '@/ui/src/services/workflows';
import { permissionsService } from '@/ui/src/services/permissions';
import { useRouter, useParams } from 'next/navigation';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

const COMPONENT_ID_VIEW = 'workflows.templates.view';
const COMPONENT_ID_UPDATE = 'workflows.templates.update';

export default function EditWorkflowTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'workflows.templates.read',
    fallbackCheck: (features) => features.isAdmin,
  });
  const { isVisible: canUpdate } = useComponentVisibility(COMPONENT_ID_UPDATE, {
    fallbackPermission: 'workflows.templates.update',
    fallbackCheck: (features) => features.isAdmin,
  });

  const templateId = params.id as string;
  const [template, setTemplate] = React.useState<WorkflowTemplate | null>(null);
  const [permissions, setPermissions] = React.useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState<UpdateWorkflowTemplateData & { steps: WorkflowStep[] }>({
    name: '',
    status: 'active',
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
      const [templateRes, permissionsRes] = await Promise.all([
        workflowService.getTemplate(templateId),
        permissionsService.getAllPermissions(),
      ]);

      if (templateRes.success && templateRes.data) {
        setTemplate(templateRes.data);
        setFormData({
          name: templateRes.data.name,
          status: templateRes.data.status,
          steps: templateRes.data.steps || [],
        });
      } else {
        setError('Template not found');
      }
      if (permissionsRes.success) {
        const permissionsData = permissionsRes.data as any;
        setPermissions(permissionsData.permissions || permissionsData || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStep = async () => {
    if (!template) return;

    const nextOrder = formData.steps.length + 1;
    try {
      const response = await workflowService.addStep(template.id, {
        step_order: nextOrder,
        required_permission: '',
        allow_decline: true,
        allow_adjust: false,
      });
      if (response.success) {
        loadData(); // Reload to get updated template
      }
    } catch (err: any) {
      console.error('Failed to add step:', err);
      alert('Failed to add step');
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
              </div>

              {canUpdate && (
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
                        {canUpdate && formData.steps.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => step.id && handleRemoveStep(step.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
      </div>
    </MainLayout>
  );
}
