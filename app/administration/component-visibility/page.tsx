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
import { Search, Settings, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { adminService, ComponentVisibilityConfig, UserCategory } from '@/ui/src/services/admin';
import { rolesService, Role } from '@/ui/src/services/roles';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

const COMPONENT_ID_VIEW = 'admin.component-visibility.view';

// Known component IDs (can be expanded)
const KNOWN_COMPONENTS = [
  { id: 'leave.create.button', name: 'Create Leave Request Button', module: 'Leave' },
  { id: 'leave.create.form', name: 'Create Leave Request Form', module: 'Leave' },
  { id: 'leave.list.view', name: 'Leave Requests List', module: 'Leave' },
  { id: 'leave.edit.action', name: 'Edit Leave Request', module: 'Leave' },
  { id: 'leave.approve.action', name: 'Approve Leave Request', module: 'Leave' },
  { id: 'timesheet.create.button', name: 'Create Timesheet Button', module: 'Timesheet' },
  { id: 'timesheet.create.form', name: 'Create Timesheet Form', module: 'Timesheet' },
  { id: 'timesheet.list.view', name: 'Timesheets List', module: 'Timesheet' },
  { id: 'timesheet.edit.action', name: 'Edit Timesheet', module: 'Timesheet' },
  { id: 'timesheet.submit.action', name: 'Submit Timesheet', module: 'Timesheet' },
  { id: 'timesheet.weekend-extra.button', name: 'Request Weekend Extra Button', module: 'Timesheet' },
  { id: 'timesheet.overtime.button', name: 'Request Overtime Button', module: 'Timesheet' },
  { id: 'users.create.button', name: 'Create User Button', module: 'Users' },
  { id: 'users.bulk.upload', name: 'Bulk User Upload', module: 'Users' },
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

      console.log('[ComponentVisibility] Roles response:', JSON.stringify(rolesRes, null, 2));
      console.log('[ComponentVisibility] Categories response:', JSON.stringify(categoriesRes, null, 2));
      console.log('[ComponentVisibility] Configs response:', JSON.stringify(configsRes, null, 2));

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data.roles || []);
      }

      if (categoriesRes.success) {
        // Handle nested data structure
        let categoriesData = categoriesRes.data;
        if (categoriesData && typeof categoriesData === 'object' && 'data' in categoriesData && Array.isArray((categoriesData as any).data)) {
          console.log('[ComponentVisibility] Found nested data structure, extracting...');
          categoriesData = (categoriesData as any).data;
        }
        
        if (Array.isArray(categoriesData)) {
          console.log(`[ComponentVisibility] Loaded ${categoriesData.length} categories`);
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
        <div>
          <h1 className="text-3xl font-bold">Component Visibility</h1>
          <p className="text-muted-foreground mt-1">
            Configure which UI components are visible for different roles
          </p>
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
                <Label htmlFor="category">User Category *</Label>
                <select
                  id="category"
                  value={formData.user_category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, user_category_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.length === 0 ? (
                    <option value="" disabled>No categories found. Create categories first.</option>
                  ) : (
                    categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))
                  )}
                </select>
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <a href="/administration/user-categories" className="text-blue-600 hover:underline">
                      Create user categories
                    </a> first to configure component visibility.
                  </p>
                )}
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
