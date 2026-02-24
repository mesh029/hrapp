'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search, FileText, Calendar, Building2 } from 'lucide-react';
import { workflowService, WorkflowTemplate } from '@/ui/src/services/workflows';
import { locationsService } from '@/ui/src/services/locations';
import { useRouter } from 'next/navigation';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { usePermissions } from '@/ui/src/hooks/use-permissions';

const COMPONENT_ID_VIEW = 'workflows.templates.view';
const COMPONENT_ID_CREATE = 'workflows.templates.create';

export default function WorkflowTemplatesPage() {
  const router = useRouter();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { hasPermission } = usePermissions();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'workflows.templates.read',
    fallbackCheck: (features) => features.isAdmin,
  });
  const { isVisible: canCreate } = useComponentVisibility(COMPONENT_ID_CREATE, {
    fallbackPermission: 'workflows.templates.create',
    fallbackCheck: (features) => features.isAdmin,
  });
  // For delete, check both isAdmin and workflows.templates.delete permission
  const canDelete = features.isAdmin || hasPermission('workflows.templates.delete');

  const [templates, setTemplates] = React.useState<WorkflowTemplate[]>([]);
  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterResourceType, setFilterResourceType] = React.useState<string>('all');
  const [filterLocation, setFilterLocation] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');

  React.useEffect(() => {
    if (!uiLoading && canView) {
      loadData();
    }
  }, [uiLoading, canView]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [templatesRes, locationsRes] = await Promise.all([
        workflowService.getTemplates({
          resource_type: filterResourceType !== 'all' ? filterResourceType as 'leave' | 'timesheet' : undefined,
          location_id: filterLocation !== 'all' ? filterLocation : undefined,
          status: filterStatus !== 'all' ? filterStatus as 'active' | 'deprecated' : undefined,
          search: searchTerm || undefined,
        }),
        locationsService.getLocations(),
      ]);

      if (templatesRes.success) {
        setTemplates(templatesRes.data.templates || []);
      }
      if (locationsRes.success) {
        // API returns { locations: [...], tree: [...], flat: [...] }
        const locationsData = locationsRes.data as any;
        const locs = locationsData.locations || locationsData.flat || locationsData.tree || [];
        setLocations(Array.isArray(locs) ? locs : []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (!uiLoading && canView) {
      const timeoutId = setTimeout(() => {
        loadData();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, filterResourceType, filterLocation, filterStatus]);

  const handleDelete = async (template: WorkflowTemplate) => {
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
        loadData();
      } else {
        const errorMsg = (response as any).error || (response as any).message || 'Failed to delete template';
        alert(errorMsg);
      }
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to delete template';
      alert(errorMsg);
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

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workflow Templates</h1>
            <p className="text-muted-foreground mt-1">
              Manage approval workflows for leave requests and timesheets
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => router.push('/workflows/templates/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterResourceType} onValueChange={setFilterResourceType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Resource Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="timesheet">Timesheet</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.filter(loc => loc.id && loc.name).map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No workflow templates found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{template.name}</h3>
                          <Badge variant={template.status === 'active' ? 'default' : 'secondary'}>
                            {template.status}
                          </Badge>
                          <Badge variant="outline">
                            {template.resource_type === 'leave' ? (
                              <Calendar className="h-3 w-3 mr-1" />
                            ) : (
                              <FileText className="h-3 w-3 mr-1" />
                            )}
                            {template.resource_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {template.location && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              <span>{template.location.name}</span>
                            </div>
                          )}
                          <span>{template.steps.length} step{template.steps.length !== 1 ? 's' : ''}</span>
                          {template._count && (
                            <span>{template._count.instances} instance{template._count.instances !== 1 ? 's' : ''}</span>
                          )}
                          <span>v{template.version}</span>
                        </div>
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">
                            Steps: {template.steps.map(s => s.step_order).join(' → ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/workflows/templates/${template.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        {canDelete && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(template)}
                            disabled={template._count && template._count.instances > 0}
                            title={template._count && template._count.instances > 0 
                              ? 'Cannot delete template with active instances' 
                              : 'Delete template'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
