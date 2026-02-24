'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Workflow, Plus, Edit, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { locationsService, Location } from '@/ui/src/services/locations';
import { workflowService, WorkflowTemplate } from '@/ui/src/services/workflows';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { api } from '@/ui/src/services/api';

const COMPONENT_ID_VIEW = 'admin.workflow-assignments.view';

interface TemplateAssignment {
  id: string;
  location_id: string;
  resource_type: 'leave' | 'timesheet';
  workflow_template_id: string;
  status: 'active' | 'inactive';
  assigned_at: string;
  notes?: string;
  location?: Location;
  workflow_template?: WorkflowTemplate;
}

export default function WorkflowAssignmentsPage() {
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'system.admin',
    fallbackCheck: (features) => features.isAdmin,
  });

  const [locations, setLocations] = React.useState<Location[]>([]);
  const [templates, setTemplates] = React.useState<WorkflowTemplate[]>([]);
  const [assignments, setAssignments] = React.useState<TemplateAssignment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingAssignment, setEditingAssignment] = React.useState<TemplateAssignment | null>(null);
  const [viewResourceType, setViewResourceType] = React.useState<'leave' | 'timesheet'>('leave');
  
  // Form state - resource type selected in dialog
  const [formData, setFormData] = React.useState({
    resource_type: '' as '' | 'leave' | 'timesheet',
    location_id: '',
    workflow_template_id: '',
    notes: '',
    apply_to_all_locations: false,
  });
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false);

  // Load assignments when view changes
  React.useEffect(() => {
    if (!uiLoading && canView) {
      loadAssignments();
    }
  }, [uiLoading, canView, viewResourceType]);

  // Load locations when dialog opens
  React.useEffect(() => {
    if (dialogOpen && !editingAssignment) {
      loadLocations();
    }
  }, [dialogOpen, editingAssignment]);

  // Load templates when resource type is selected
  React.useEffect(() => {
    if (formData.resource_type && dialogOpen) {
      loadTemplates(formData.resource_type);
    }
  }, [formData.resource_type, dialogOpen]);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 Loading assignments for resource type:', viewResourceType);
      const response = await api.get(`/api/admin/workflow-assignments?resource_type=${viewResourceType}`);
      console.log('📋 Assignments API response:', response);
      
      if (response && response.success && response.data) {
        const assignmentsList = response.data.assignments || [];
        setAssignments(assignmentsList);
        console.log(`✅ Loaded ${assignmentsList.length} assignment(s) for ${viewResourceType}:`, assignmentsList);
      } else {
        console.error('❌ Failed to load assignments - response:', response);
        setAssignments([]);
        setError('Failed to load assignments');
      }
    } catch (error: any) {
      console.error('❌ Error loading assignments:', error);
      setAssignments([]);
      setError(`Failed to load assignments: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocations = async () => {
    setIsLoadingLocations(true);
    try {
      const response = await locationsService.getLocations({ tree: false, status: 'active' });
      console.log('📍 Locations response:', response);
      
      if (response && response.success && response.data) {
        let locationData: Location[] = [];
        if (Array.isArray(response.data)) {
          locationData = response.data;
        } else if (response.data.locations && Array.isArray(response.data.locations)) {
          locationData = response.data.locations;
        } else if (response.data.flat && Array.isArray(response.data.flat)) {
          locationData = response.data.flat;
        }
        setLocations(locationData);
        console.log('✅ Loaded locations:', locationData.length);
      } else {
        console.error('❌ Failed to load locations:', response);
        setError('Failed to load locations');
      }
    } catch (error: any) {
      console.error('❌ Error loading locations:', error);
      setError(`Error loading locations: ${error.message}`);
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const loadTemplates = async (resourceType: 'leave' | 'timesheet') => {
    setIsLoadingTemplates(true);
    setTemplates([]); // Clear previous templates
    setError(null);
    
    try {
      console.log('🔄 Loading templates for resource type:', resourceType);
      const response = await workflowService.getTemplates({ 
        resource_type: resourceType, 
        status: 'active',
        limit: 100 
      });
      console.log('📋 Templates API response:', response);
      
      if (response && response.success && response.data) {
        let templateData: WorkflowTemplate[] = [];
        if (Array.isArray(response.data)) {
          templateData = response.data;
        } else if (response.data.templates && Array.isArray(response.data.templates)) {
          templateData = response.data.templates;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          templateData = response.data.data;
        }
        setTemplates(templateData);
        console.log(`✅ Loaded ${resourceType} templates:`, templateData.length, templateData);
        
        if (templateData.length === 0) {
          console.warn(`⚠️ No ${resourceType} templates found in response`);
        }
      } else {
        console.error('❌ Failed to load templates - response:', response);
        const errorMsg = response?.message || `Failed to load ${resourceType} templates`;
        setError(errorMsg);
      }
    } catch (error: any) {
      console.error(`❌ Error loading ${resourceType} templates:`, error);
      setError(`Error loading templates: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleOpenDialog = (assignment?: TemplateAssignment) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setFormData({
        resource_type: assignment.resource_type,
        location_id: assignment.location_id,
        workflow_template_id: assignment.workflow_template_id,
        notes: assignment.notes || '',
        apply_to_all_locations: false,
      });
      // Load templates for this resource type
      loadTemplates(assignment.resource_type);
    } else {
      setEditingAssignment(null);
      setFormData({
        resource_type: '',
        location_id: '',
        workflow_template_id: '',
        notes: '',
        apply_to_all_locations: false,
      });
      setTemplates([]);
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAssignment(null);
    setFormData({
      resource_type: '',
      location_id: '',
      workflow_template_id: '',
      notes: '',
      apply_to_all_locations: false,
    });
    setTemplates([]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validation
    if (!formData.resource_type) {
      setError('Resource type is required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.workflow_template_id) {
      setError('Workflow template is required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.apply_to_all_locations && !formData.location_id) {
      setError('Location is required (or select "Apply to All Locations")');
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingAssignment) {
        // Editing existing assignment
        const data = {
          location_id: formData.location_id,
          resource_type: formData.resource_type,
          workflow_template_id: formData.workflow_template_id,
          notes: formData.notes || null,
        };
        await api.patch(`/api/admin/workflow-assignments/${editingAssignment.id}`, data);
      } else {
        // Creating new assignment
        const data: any = {
          workflow_template_id: formData.workflow_template_id,
          resource_type: formData.resource_type,
          notes: formData.notes || null,
          apply_to_all_locations: formData.apply_to_all_locations,
        };
        
        // Only include location_id if not applying to all locations
        if (!formData.apply_to_all_locations && formData.location_id) {
          data.location_id = formData.location_id;
        }

        await api.post('/api/admin/workflow-assignments', data);
      }

      handleCloseDialog();
      
      // Switch to the correct tab if needed
      if (formData.resource_type && formData.resource_type !== viewResourceType) {
        setViewResourceType(formData.resource_type);
      }
      
      // Reload assignments after a short delay to ensure API has processed
      setTimeout(() => {
        loadAssignments();
      }, 500);
    } catch (error: any) {
      console.error('Assignment error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to save assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (assignment: TemplateAssignment) => {
    if (!confirm(`Are you sure you want to remove the template assignment for ${assignment.location?.name || 'this location'}?`)) {
      return;
    }

    try {
      await api.delete(`/api/admin/workflow-assignments/${assignment.id}`);
      loadAssignments();
    } catch (error: any) {
      alert(error.response?.data?.error || error.message || 'Failed to delete assignment');
    }
  };

  const getLocationName = (locationId: string) => {
    const assignment = assignments.find(a => a.location_id === locationId);
    return locations.find(l => l.id === locationId)?.name || assignment?.location?.name || locationId;
  };

  const getTemplateName = (templateId: string) => {
    const assignment = assignments.find(a => a.workflow_template_id === templateId);
    return templates.find(t => t.id === templateId)?.name || assignment?.workflow_template?.name || templateId;
  };

  if (uiLoading || !canView) {
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
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workflow Template Assignments</h1>
            <p className="text-muted-foreground mt-2">
              Assign workflow templates to locations for leave requests and timesheets
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Assign Template
          </Button>
        </div>

        <Tabs value={viewResourceType} onValueChange={(v) => setViewResourceType(v as 'leave' | 'timesheet')}>
          <TabsList>
            <TabsTrigger value="leave">Leave Requests</TabsTrigger>
            <TabsTrigger value="timesheet">Timesheets</TabsTrigger>
          </TabsList>

          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Leave Request Template Assignments</CardTitle>
                {!isLoading && assignments.filter(a => a.resource_type === 'leave').length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {assignments.filter(a => a.resource_type === 'leave').length} assignment(s) found
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading assignments...</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No template assignments for leave requests</p>
                    <p className="text-sm mt-2">Click "Assign Template" to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{getLocationName(assignment.location_id)}</div>
                            <div className="text-sm text-muted-foreground">
                              Template: {getTemplateName(assignment.workflow_template_id)}
                            </div>
                            {assignment.notes && (
                              <div className="text-xs text-muted-foreground mt-1">{assignment.notes}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                            {assignment.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(assignment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(assignment)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timesheet" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Timesheet Template Assignments</CardTitle>
                {assignments.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {assignments.length} assignment(s) found
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading assignments...</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No template assignments for timesheets</p>
                    <p className="text-sm mt-2">Click "Assign Template" to get started</p>
                    {error && (
                      <p className="text-xs text-destructive mt-2">{error}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments.filter(a => a.resource_type === 'timesheet').map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{getLocationName(assignment.location_id)}</div>
                            <div className="text-sm text-muted-foreground">
                              Template: {getTemplateName(assignment.workflow_template_id)}
                            </div>
                            {assignment.notes && (
                              <div className="text-xs text-muted-foreground mt-1">{assignment.notes}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                            {assignment.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(assignment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(assignment)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Assignment Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAssignment ? 'Edit Template Assignment' : 'Assign Template'}
              </DialogTitle>
              <DialogDescription>
                {editingAssignment 
                  ? 'Update the template assignment for this location'
                  : 'Select resource type, location, and workflow template to assign'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Step 1: Resource Type */}
                <div className="space-y-2">
                  <Label htmlFor="resource_type">Resource Type *</Label>
                  <Select
                    value={formData.resource_type}
                    onValueChange={(value) => {
                      setFormData(prev => ({
                        ...prev,
                        resource_type: value as 'leave' | 'timesheet',
                        workflow_template_id: '', // Reset template when resource type changes
                      }));
                    }}
                    disabled={!!editingAssignment}
                  >
                    <SelectTrigger id="resource_type">
                      <SelectValue placeholder="Select resource type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leave">Leave Requests</SelectItem>
                      <SelectItem value="timesheet">Timesheets</SelectItem>
                    </SelectContent>
                  </Select>
                  {!formData.resource_type && (
                    <p className="text-xs text-muted-foreground">First, select whether this is for leave requests or timesheets</p>
                  )}
                </div>

                {/* Step 2: Location or All Locations */}
                {formData.resource_type && (
                  <>
                    {!editingAssignment && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="apply_to_all"
                            checked={formData.apply_to_all_locations}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                apply_to_all_locations: e.target.checked,
                                location_id: e.target.checked ? '' : prev.location_id,
                              }));
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="apply_to_all" className="font-normal cursor-pointer">
                            Apply to All Locations
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          When enabled, this template will be used for all locations
                        </p>
                      </div>
                    )}

                    {!formData.apply_to_all_locations && (
                      <div className="space-y-2">
                        <Label htmlFor="location">Location *</Label>
                        <Select
                          value={formData.location_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, location_id: value }))}
                          disabled={locations.length === 0 || isLoadingLocations}
                        >
                          <SelectTrigger id="location">
                            <SelectValue placeholder={isLoadingLocations ? "Loading locations..." : locations.length === 0 ? "No locations found" : "Select a location"} />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingLocations ? (
                              <SelectItem value="__loading__" disabled>
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading locations...
                                </div>
                              </SelectItem>
                            ) : locations.length === 0 ? (
                              <SelectItem value="__empty__" disabled>No locations available</SelectItem>
                            ) : (
                              locations.map(location => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {locations.length === 0 && !isLoadingLocations && (
                          <p className="text-xs text-muted-foreground">No locations found. Please ensure locations exist in the system.</p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Step 3: Workflow Template - Show as soon as resource type is selected */}
                {formData.resource_type && (
                  <div className="space-y-2">
                    <Label htmlFor="template">Workflow Template *</Label>
                    <Select
                      value={formData.workflow_template_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, workflow_template_id: value }))}
                      disabled={templates.length === 0 || isLoadingTemplates}
                    >
                      <SelectTrigger id="template">
                        <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : templates.length === 0 ? `No ${formData.resource_type} templates found` : "Select a template"} />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingTemplates ? (
                          <SelectItem value="__loading__" disabled>
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading templates...
                            </div>
                          </SelectItem>
                        ) : templates.length === 0 ? (
                          <SelectItem value="__empty__" disabled>No templates available for {formData.resource_type}</SelectItem>
                        ) : (
                          templates.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} {template.is_area_wide && '(Area-Wide)'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {templates.length === 0 && !isLoadingTemplates && (
                      <p className="text-xs text-muted-foreground">No {formData.resource_type} templates found. Please create a template first.</p>
                    )}
                    {isLoadingTemplates && (
                      <p className="text-xs text-muted-foreground">Loading {formData.resource_type} templates...</p>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <textarea
                    id="notes"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes about this assignment..."
                  />
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    {error}
                  </div>
                )}
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !formData.resource_type || !formData.workflow_template_id || (!formData.apply_to_all_locations && !formData.location_id)}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : editingAssignment ? (
                    'Update'
                  ) : (
                    'Assign'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
