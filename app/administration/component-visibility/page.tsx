'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Search, Settings, Eye, EyeOff, CheckCircle, XCircle, Sparkles, RotateCcw } from 'lucide-react';
import { adminService, ComponentVisibilityConfig, UserCategory } from '@/ui/src/services/admin';
import { rolesService, Role } from '@/ui/src/services/roles';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

const COMPONENT_ID_VIEW = 'admin.component-visibility.view';

// Known component IDs (can be expanded)
const KNOWN_COMPONENTS = [
  // Dashboard Components
  { id: 'dashboard.stats.total-users', name: 'Total Users Card', module: 'Dashboard' },
  { id: 'dashboard.stats.active-users', name: 'Active Users Card', module: 'Dashboard' },
  { id: 'dashboard.stats.pending-leave', name: 'Pending Leave Requests Card', module: 'Dashboard' },
  { id: 'dashboard.stats.pending-timesheets', name: 'Pending Timesheets Card', module: 'Dashboard' },
  { id: 'dashboard.stats.pending-approvals', name: 'Pending Approvals Card', module: 'Dashboard' },
  { id: 'dashboard.actions.create-user', name: 'Create New User Button', module: 'Dashboard' },
  { id: 'dashboard.actions.manage-users', name: 'Manage Users Button', module: 'Dashboard' },
  { id: 'dashboard.actions.create-leave', name: 'Create Leave Request Button', module: 'Dashboard' },
  { id: 'dashboard.actions.approve-leave', name: 'Approve Leave Requests Button', module: 'Dashboard' },
  { id: 'dashboard.actions.create-timesheet', name: 'Create Timesheet Button', module: 'Dashboard' },
  { id: 'dashboard.actions.approve-timesheets', name: 'Approve Timesheets Button', module: 'Dashboard' },
  { id: 'dashboard.actions.view-reports', name: 'View Reports Button', module: 'Dashboard' },
  { id: 'dashboard.overview.system', name: 'System Overview Section', module: 'Dashboard' },
  { id: 'dashboard.overview.location', name: 'Location Overview Section', module: 'Dashboard' },
  { id: 'dashboard.overview.team', name: 'Team Overview Section', module: 'Dashboard' },
  { id: 'dashboard.overview.personal', name: 'Personal Overview Section', module: 'Dashboard' },
  { id: 'dashboard.quick-links', name: 'Quick Links Section', module: 'Dashboard' },
  
  // Navigation Components
  { id: 'nav.dashboard', name: 'Dashboard Link', module: 'Navigation' },
  { id: 'nav.users', name: 'Users Link', module: 'Navigation' },
  { id: 'nav.leave', name: 'Leave Link', module: 'Navigation' },
  { id: 'nav.timesheets', name: 'Timesheets Link', module: 'Navigation' },
  { id: 'nav.workflows', name: 'Workflows Link', module: 'Navigation' },
  { id: 'nav.approvals', name: 'Pending Approvals Link', module: 'Navigation' },
  { id: 'nav.reports', name: 'Reports Link', module: 'Navigation' },
  { id: 'nav.administration', name: 'Administration Link', module: 'Navigation' },
  { id: 'nav.profile', name: 'Profile Link', module: 'Navigation' },
  
  // Leave Components
  { id: 'leave.create.button', name: 'Create Leave Request Button', module: 'Leave' },
  { id: 'leave.create.form', name: 'Create Leave Request Form', module: 'Leave' },
  { id: 'leave.list.view', name: 'Leave Requests List', module: 'Leave' },
  { id: 'leave.edit.action', name: 'Edit Leave Request', module: 'Leave' },
  { id: 'leave.approve.action', name: 'Approve Leave Request', module: 'Leave' },
  { id: 'leave.decline.action', name: 'Decline Leave Request', module: 'Leave' },
  { id: 'leave.balances.view', name: 'Leave Balances View', module: 'Leave' },
  { id: 'leave.types.view', name: 'Leave Types View', module: 'Leave' },
  
  // Timesheet Components
  { id: 'timesheet.create.button', name: 'Create Timesheet Button', module: 'Timesheet' },
  { id: 'timesheet.create.form', name: 'Create Timesheet Form', module: 'Timesheet' },
  { id: 'timesheet.list.view', name: 'Timesheets List', module: 'Timesheet' },
  { id: 'timesheet.edit.action', name: 'Edit Timesheet', module: 'Timesheet' },
  { id: 'timesheet.submit.action', name: 'Submit Timesheet', module: 'Timesheet' },
  { id: 'timesheet.delete.action', name: 'Delete Timesheet', module: 'Timesheet' },
  { id: 'timesheet.weekend-extra.button', name: 'Request Weekend Extra Button', module: 'Timesheet' },
  { id: 'timesheet.overtime.button', name: 'Request Overtime Button', module: 'Timesheet' },
  { id: 'timesheet.approve.action', name: 'Approve Timesheet', module: 'Timesheet' },
  { id: 'timesheet.decline.action', name: 'Decline Timesheet', module: 'Timesheet' },
  
  // User Components
  { id: 'users.create.button', name: 'Create User Button', module: 'Users' },
  { id: 'users.bulk.upload', name: 'Bulk User Upload', module: 'Users' },
  { id: 'users.list.view', name: 'Users List', module: 'Users' },
  { id: 'users.edit.action', name: 'Edit User', module: 'Users' },
  { id: 'users.delete.action', name: 'Delete User', module: 'Users' },
  { id: 'users.view.detail', name: 'User Detail View', module: 'Users' },
  { id: 'users.assign.roles', name: 'Assign Roles to User', module: 'Users' },
  
  // Workflow Components
  { id: 'workflows.list.view', name: 'Workflows List', module: 'Workflows' },
  { id: 'workflows.templates.create', name: 'Create Workflow Template', module: 'Workflows' },
  { id: 'workflows.templates.edit', name: 'Edit Workflow Template', module: 'Workflows' },
  { id: 'workflows.templates.delete', name: 'Delete Workflow Template', module: 'Workflows' },
  { id: 'workflows.simulator.view', name: 'Workflow Simulator', module: 'Workflows' },
  { id: 'workflows.approve.action', name: 'Approve Workflow Step', module: 'Workflows' },
  { id: 'workflows.decline.action', name: 'Decline Workflow Step', module: 'Workflows' },
  
  // Reports Components
  { id: 'reports.dashboard.view', name: 'Reports Dashboard', module: 'Reports' },
  { id: 'reports.leave.view', name: 'Leave Reports', module: 'Reports' },
  { id: 'reports.timesheet.view', name: 'Timesheet Reports', module: 'Reports' },
  { id: 'reports.export.action', name: 'Export Reports', module: 'Reports' },
  
  // Administration Components
  { id: 'admin.roles.view', name: 'Roles Management', module: 'Administration' },
  { id: 'admin.roles.create', name: 'Create Role', module: 'Administration' },
  { id: 'admin.roles.edit', name: 'Edit Role', module: 'Administration' },
  { id: 'admin.roles.delete', name: 'Delete Role', module: 'Administration' },
  { id: 'admin.permissions.view', name: 'Permissions View', module: 'Administration' },
  { id: 'admin.locations.view', name: 'Locations Management', module: 'Administration' },
  { id: 'admin.locations.create', name: 'Create Location', module: 'Administration' },
  { id: 'admin.locations.edit', name: 'Edit Location', module: 'Administration' },
  { id: 'admin.locations.delete', name: 'Delete Location', module: 'Administration' },
  { id: 'admin.workflow-assignments.view', name: 'Workflow Assignments', module: 'Administration' },
  { id: 'admin.workflow-assignments.create', name: 'Create Workflow Assignment', module: 'Administration' },
  { id: 'admin.component-visibility.view', name: 'Component Visibility', module: 'Administration' },
  { id: 'admin.user-categories.view', name: 'User Categories', module: 'Administration' },
];

export default function ComponentVisibilityPage() {
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'system.admin',
    fallbackCheck: (features) => features.isAdmin,
  });

  const [roles, setRoles] = React.useState<Role[]>([]);
  const [categories, setCategories] = React.useState<UserCategory[]>([]);
  const [configs, setConfigs] = React.useState<ComponentVisibilityConfig[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedModule, setSelectedModule] = React.useState<string>('all');
  const [selectedRole, setSelectedRole] = React.useState<string>('all');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedComponent, setSelectedComponent] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({
    component_id: '',
    role_id: '',
    user_category_id: '',
    visible: true,
    enabled: true,
    priority: 0,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isApplyingBaseline, setIsApplyingBaseline] = React.useState(false);
  const [baselineMessage, setBaselineMessage] = React.useState<string | null>(null);
  const [baselinePreview, setBaselinePreview] = React.useState<Array<{
    role_name: string;
    profile: string;
    visible_components: number;
    hidden_components: number;
  }> | null>(null);

  React.useEffect(() => {
    if (!uiLoading && canView) {
      loadData();
    }
  }, [uiLoading, canView]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [rolesRes, categoriesRes, configsRes] = await Promise.all([
        rolesService.getRoles(),
        adminService.getUserCategories(),
        adminService.getComponentVisibilityConfigs(),
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data.roles || []);
      }

      if (categoriesRes.success) {
        // Handle nested data structure
        let categoriesData = categoriesRes.data;
        if (categoriesData && typeof categoriesData === 'object' && 'data' in categoriesData && Array.isArray((categoriesData as any).data)) {
          categoriesData = (categoriesData as any).data;
        }
        
        if (Array.isArray(categoriesData)) {
          setCategories(categoriesData);
        } else {
          console.error('[ComponentVisibility] Categories data is not an array:', categoriesData);
          setCategories([]);
        }
      } else {
        console.error('[ComponentVisibility] Failed to load categories:', categoriesRes);
        setCategories([]);
      }
      if (configsRes.success) {
        setConfigs(configsRes.data || []);
      } else {
        console.error('[ComponentVisibility] Failed to load configs:', configsRes);
        setConfigs([]);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setRoles([]);
      setCategories([]);
      setConfigs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (componentId: string) => {
    setSelectedComponent(componentId);
    setFormData({
      component_id: componentId,
      role_id: '',
      user_category_id: '',
      visible: true,
      enabled: true,
      priority: 0,
    });
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedComponent(null);
    setFormData({
      component_id: '',
      role_id: '',
      user_category_id: '',
      visible: true,
      enabled: true,
      priority: 0,
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.role_id && !formData.user_category_id) {
      setError('Please select a role or category');
      return;
    }

    try {
      setIsSubmitting(true);
      await adminService.createComponentVisibilityConfig({
        component_id: formData.component_id,
        role_id: formData.role_id || undefined,
        user_category_id: formData.user_category_id || undefined,
        visible: formData.visible,
        enabled: formData.enabled,
        priority: formData.priority,
      });
      handleCloseDialog();
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleConfig = async (config: ComponentVisibilityConfig) => {
    try {
      await adminService.updateComponentVisibilityConfig(config.id, {
        visible: !config.visible,
      });
      loadData();
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const handleDeleteConfig = async (config: ComponentVisibilityConfig) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      await adminService.deleteComponentVisibilityConfig(config.id);
      loadData();
    } catch (error) {
      console.error('Failed to delete config:', error);
      alert('Failed to delete configuration');
    }
  };

  const handleApplyBaseline = async (mode: 'apply' | 'reset') => {
    const confirmMessage =
      mode === 'reset'
        ? 'This will reset existing role-based visibility configs and re-apply baseline defaults. Continue?'
        : 'Apply baseline defaults for all active roles?';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsApplyingBaseline(true);
      setBaselineMessage(null);
      const response = await adminService.applyComponentVisibilityBaseline({ mode, dry_run: false });

      if (response.success && response.data) {
        setBaselineMessage(
          `Baseline ${mode} complete: created ${response.data.created}, updated ${response.data.updated} records.`
        );
        await loadData();
      } else {
        setBaselineMessage('Baseline operation completed but response was unexpected.');
      }
    } catch (err: any) {
      setBaselineMessage(err.message || 'Failed to apply baseline configuration.');
    } finally {
      setIsApplyingBaseline(false);
    }
  };

  const handlePreviewBaseline = async () => {
    try {
      setIsApplyingBaseline(true);
      setBaselineMessage(null);
      const response = await adminService.previewComponentVisibilityBaseline();
      const payload: any = (response as any)?.data && (response as any).data.preview
        ? (response as any).data
        : (response as any)?.data?.data && (response as any).data.data.preview
          ? (response as any).data.data
          : response?.data;

      if (response.success && Array.isArray(payload?.preview)) {
        setBaselinePreview(payload.preview);
      } else {
        setBaselineMessage('Unable to load baseline preview.');
      }
    } catch (err: any) {
      setBaselineMessage(err.message || 'Failed to preview baseline configuration.');
    } finally {
      setIsApplyingBaseline(false);
    }
  };

  const filteredComponents = KNOWN_COMPONENTS.filter(comp => {
    const matchesSearch = comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comp.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = selectedModule === 'all' || comp.module === selectedModule;
    return matchesSearch && matchesModule;
  });

  const getConfigForComponent = (componentId: string, roleId?: string, categoryId?: string) => {
    return configs.find(c => 
      c.component_id === componentId && 
      (roleId ? c.role_id === roleId : true) &&
      (categoryId ? c.user_category_id === categoryId : true)
    );
  };

  const filteredConfigs = configs.filter(config => {
    const matchesModule = selectedModule === 'all' || 
      KNOWN_COMPONENTS.find(c => c.id === config.component_id)?.module === selectedModule;
    const matchesRole = selectedRole === 'all' || config.role_id === selectedRole;
    const matchesCategory = selectedCategory === 'all' || config.user_category_id === selectedCategory;
    return matchesModule && matchesRole && matchesCategory;
  });

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

  const modules = Array.from(new Set(KNOWN_COMPONENTS.map(c => c.module)));

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Component Visibility</h1>
            <p className="text-muted-foreground mt-1">
              Configure which UI components are visible for different roles
            </p>
            {baselineMessage && (
              <p className="text-sm text-muted-foreground mt-2">{baselineMessage}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handlePreviewBaseline}
              disabled={isApplyingBaseline}
            >
              Preview Baseline
            </Button>
            <Button
              variant="outline"
              onClick={() => handleApplyBaseline('apply')}
              disabled={isApplyingBaseline}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Apply Baseline
            </Button>
            <Button
              variant="outline"
              onClick={() => handleApplyBaseline('reset')}
              disabled={isApplyingBaseline}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset + Reapply
            </Button>
          </div>
        </div>

        {baselinePreview && (
          <Card>
            <CardHeader>
              <CardTitle>Baseline Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {baselinePreview.map((item) => (
                  <div key={item.role_name} className="rounded-md border p-3">
                    <div className="font-medium">{item.role_name}</div>
                    <div className="text-xs text-muted-foreground">Profile: {item.profile}</div>
                    <div className="text-sm mt-2">Visible: {item.visible_components}</div>
                    <div className="text-sm text-muted-foreground">Hidden: {item.hidden_components}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                    placeholder="Search components..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="all">All Modules</option>
                  {modules.map(module => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </select>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="all">All Roles</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Components List */}
        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <div className="space-y-4">
                {filteredComponents.map((component) => {
                  // Get role configs for this component
                  const roleConfigs = roles
                    .filter(role => selectedRole === 'all' || role.id === selectedRole)
                    .map(role => ({
                      role: role,
                      config: getConfigForComponent(component.id, role.id),
                    }));

                  // Get category configs (legacy)
                  const categoryConfigs = categories
                    .filter(cat => selectedCategory === 'all' || cat.id === selectedCategory)
                    .map(cat => ({
                      category: cat,
                      config: getConfigForComponent(component.id, undefined, cat.id),
                    }));

                  return (
                    <div
                      key={component.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{component.name}</h3>
                            <Badge variant="outline">{component.module}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 font-mono">
                            {component.id}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(component.id)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </div>

                      {/* Role Configs */}
                      {roleConfigs.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Role Configurations</p>
                          <div className="grid gap-2">
                            {roleConfigs.map(({ role, config }) => (
                              <div
                                key={role.id}
                                className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-blue-100">{role.name}</Badge>
                                </div>
                                <div className="flex items-center gap-4">
                                  {config ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        {config.visible ? (
                                          <Eye className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <EyeOff className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                          {config.visible ? 'Visible' : 'Hidden'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {config.enabled ? (
                                          <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                          {config.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                      </div>
                                      <Switch
                                        checked={config.visible}
                                        onCheckedChange={() => handleToggleConfig(config)}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteConfig(config)}
                                      >
                                        Remove
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Not configured
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Category Configs (Legacy) */}
                      {categoryConfigs.length > 0 && categoryConfigs.some(c => c.config) && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Category Configurations (Legacy)</p>
                          <div className="grid gap-2">
                            {categoryConfigs.filter(c => c.config).map(({ category, config }) => (
                              <div
                                key={category.id}
                                className="flex items-center justify-between p-2 bg-muted/50 rounded"
                              >
                                <div className="flex items-center gap-2">
                                  {category.color && (
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: category.color }}
                                    />
                                  )}
                                  <span className="text-sm font-medium">{category.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {config && (
                                    <>
                                      <div className="flex items-center gap-2">
                                        {config.visible ? (
                                          <Eye className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <EyeOff className="h-4 w-4 text-gray-400" />
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                          {config.visible ? 'Visible' : 'Hidden'}
                                        </span>
                                      </div>
                                      <Switch
                                        checked={config.visible}
                                        onCheckedChange={() => handleToggleConfig(config)}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteConfig(config)}
                                      >
                                        Remove
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Config Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Component Visibility</DialogTitle>
              <DialogDescription>
                Set visibility and enabled state for a user category
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label>Component</Label>
                <Input
                  value={selectedComponent || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role (Recommended)</Label>
                <select
                  id="role"
                  value={formData.role_id}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      role_id: e.target.value,
                      user_category_id: e.target.value ? '' : prev.user_category_id,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select a role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Role-based visibility is the primary strategy.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">User Category (Legacy / Optional)</Label>
                <select
                  id="category"
                  value={formData.user_category_id}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      user_category_id: e.target.value,
                      role_id: e.target.value ? '' : prev.role_id,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select a category</option>
                  {categories.length === 0 ? (
                    <option value="" disabled>No categories found</option>
                  ) : (
                    categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">
                  Higher priority configs override lower priority ones
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="visible">Visible</Label>
                  <p className="text-xs text-muted-foreground">
                    Component will be shown to users in this category
                  </p>
                </div>
                <Switch
                  id="visible"
                  checked={formData.visible}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, visible: checked }))}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="enabled">Enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Component will be interactive (clickable/usable)
                  </p>
                </div>
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Configuration'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
