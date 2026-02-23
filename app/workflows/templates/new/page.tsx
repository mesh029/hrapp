'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Plus, Trash2, GripVertical, Settings, Eye } from 'lucide-react';
import { workflowService, CreateWorkflowTemplateData, WorkflowStep } from '@/ui/src/services/workflows';
import { locationsService } from '@/ui/src/services/locations';
import { permissionsService } from '@/ui/src/services/permissions';
import { rolesService, Role, Permission } from '@/ui/src/services/roles';
import { useRouter } from 'next/navigation';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { StepConfigurationDialog } from '@/components/workflows/StepConfigurationDialog';
import { ApproverPreviewDialog } from '@/components/workflows/ApproverPreviewDialog';
import { SortableStepItem } from './SortableStepItem';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

const COMPONENT_ID_CREATE = 'workflows.templates.create';

export default function NewWorkflowTemplatePage() {
  const router = useRouter();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canCreate } = useComponentVisibility(COMPONENT_ID_CREATE, {
    fallbackPermission: 'workflows.templates.create',
    fallbackCheck: (features) => features.isAdmin,
  });

  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = React.useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(null);
  const [previewStep, setPreviewStep] = React.useState<WorkflowStep | null>(null);

  const [formData, setFormData] = React.useState<CreateWorkflowTemplateData>({
    name: '',
    resource_type: 'leave',
    location_id: '',
    steps: [
      {
        step_order: 1,
        required_permission: '',
        allow_decline: true,
        allow_adjust: false,
      },
    ],
  });

  React.useEffect(() => {
    if (!uiLoading && canCreate) {
      loadData();
    }
  }, [uiLoading, canCreate]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [locationsRes, permissionsRes, rolesRes] = await Promise.all([
        locationsService.getLocations(),
        permissionsService.getAllPermissions(),
        rolesService.getRoles(),
      ]);

      if (locationsRes.success) {
        const locationsData = locationsRes.data as any;
        const locs = locationsData.locations || locationsData.flat || locationsData.tree || [];
        setLocations(Array.isArray(locs) ? locs : []);
        if (Array.isArray(locs) && locs.length > 0 && !formData.location_id) {
          setFormData(prev => ({ ...prev, location_id: locs[0].id }));
        }
      }
      if (permissionsRes.success) {
        const permissionsData = permissionsRes.data as any;
        setPermissions(permissionsData.permissions || permissionsData || []);
      }
      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data.roles || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddStep = () => {
    const nextOrder = formData.steps.length + 1;
    setEditingStepIndex(formData.steps.length);
    setConfigDialogOpen(true);
  };

  const handleEditStep = (index: number) => {
    setEditingStepIndex(index);
    setConfigDialogOpen(true);
  };

  const handleSaveStep = (stepConfig: WorkflowStep) => {
    if (editingStepIndex !== null) {
      if (editingStepIndex < formData.steps.length) {
        // Update existing step
        setFormData(prev => ({
          ...prev,
          steps: prev.steps.map((s, i) =>
            i === editingStepIndex
              ? { ...stepConfig, step_order: i + 1 }
              : { ...s, step_order: i + 1 }
          ),
        }));
      } else {
        // Add new step
        setFormData(prev => ({
          ...prev,
          steps: [...prev.steps, { ...stepConfig, step_order: prev.steps.length + 1 }],
        }));
      }
    }
    setEditingStepIndex(null);
    setConfigDialogOpen(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFormData(prev => {
        const oldIndex = prev.steps.findIndex(s => s.step_order.toString() === active.id);
        const newIndex = prev.steps.findIndex(s => s.step_order.toString() === over.id);

        const newSteps = arrayMove(prev.steps, oldIndex, newIndex);
        // Reorder step_order values
        return {
          ...prev,
          steps: newSteps.map((s, i) => ({ ...s, step_order: i + 1 })),
        };
      });
    }
  };

  const handlePreviewApprovers = (step: WorkflowStep) => {
    setPreviewStep(step);
    setPreviewDialogOpen(true);
  };

  const handleRemoveStep = (index: number) => {
    if (formData.steps.length <= 1) {
      alert('At least one step is required');
      return;
    }
    setFormData(prev => {
      const newSteps = prev.steps.filter((_, i) => i !== index);
      // Reorder steps
      return {
        ...prev,
        steps: newSteps.map((step, i) => ({
          ...step,
          step_order: i + 1,
        })),
      };
    });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!formData.location_id) {
      setError('Location is required');
      return;
    }
    if (formData.steps.some(s => !s.required_permission)) {
      setError('All steps must have a required permission configured');
      return;
    }
    // Validate role-based steps have roles selected
    if (formData.steps.some(s => 
      (s.approver_strategy === 'role' || s.approver_strategy === 'combined') && 
      (!s.required_roles || s.required_roles.length === 0)
    )) {
      setError('Role-based steps must have at least one role selected');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await workflowService.createTemplate(formData);
      if (response.success) {
        router.push('/workflows/templates');
      } else {
        setError('Failed to create template');
      }
    } catch (err: any) {
      console.error('Failed to create template:', err);
      setError(err.message || 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to create workflow templates
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
          <div>
            <h1 className="text-3xl font-bold">New Workflow Template</h1>
            <p className="text-muted-foreground mt-1">
              Create a new approval workflow template
            </p>
          </div>
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
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Nairobi Leave Approval"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resource_type">Resource Type *</Label>
                <Select
                  value={formData.resource_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, resource_type: value as 'leave' | 'timesheet' }))}
                >
                  <SelectTrigger id="resource_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leave">Leave Request</SelectItem>
                    <SelectItem value="timesheet">Timesheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Select
                  value={formData.location_id || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Workflow Steps</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStep}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.steps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No steps configured. Click "Add Step" to get started.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={formData.steps.map(s => s.step_order.toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    {formData.steps.map((step, index) => (
                      <SortableStepItem
                        key={step.step_order}
                        step={step}
                        index={index}
                        onEdit={() => handleEditStep(index)}
                        onRemove={() => handleRemoveStep(index)}
                        onPreview={() => handlePreviewApprovers(step)}
                        canRemove={formData.steps.length > 1}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/workflows/templates')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Template'}
            </Button>
          </div>
        </form>

        {/* Step Configuration Dialog */}
        <StepConfigurationDialog
          open={configDialogOpen}
          step={editingStepIndex !== null ? formData.steps[editingStepIndex] : null}
          stepIndex={editingStepIndex || 0}
          permissions={permissions}
          roles={roles}
          resourceType={formData.resource_type}
          onClose={() => {
            setConfigDialogOpen(false);
            setEditingStepIndex(null);
          }}
          onSave={handleSaveStep}
          onPreviewApprovers={handlePreviewApprovers}
        />

        {/* Approver Preview Dialog */}
        {previewStep && (
          <ApproverPreviewDialog
            open={previewDialogOpen}
            step={previewStep}
            locationId={formData.location_id}
            resourceType={formData.resource_type}
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
