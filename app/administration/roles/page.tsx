'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Key, Shield, Users, Search } from 'lucide-react';
import { rolesService, permissionsService, Role, Permission } from '@/ui/src/services/roles';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

const COMPONENT_ID_VIEW = 'admin.roles.view';

export default function RolesPage() {
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'system.admin',
    fallbackCheck: (features) => features.isAdmin,
  });

  const [roles, setRoles] = React.useState<Role[]>([]);
  const [permissions, setPermissions] = React.useState<Permission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [selectedRole, setSelectedRole] = React.useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = React.useState<string[]>([]);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [searchTerm, setSearchTerm] = React.useState('');
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
      const [rolesRes, permissionsRes] = await Promise.all([
        rolesService.getRoles(),
        permissionsService.getPermissions(),
      ]);

      if (rolesRes.success && rolesRes.data) {
        setRoles(rolesRes.data.roles || []);
      }
      if (permissionsRes.success && permissionsRes.data) {
        // API returns { permissions: [...], pagination: {...} }
        const permissionsData = permissionsRes.data as any;
        setPermissions(permissionsData.permissions || permissionsData || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    try {
      const response = await rolesService.getRolePermissions(roleId);
      if (response.success && response.data) {
        setRolePermissions(response.data.map(rp => rp.permission_id));
      }
    } catch (error) {
      console.error('Failed to load role permissions:', error);
    }
  };

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description || '',
        status: role.status,
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        description: '',
        status: 'active',
      });
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      status: 'active',
    });
    setError(null);
  };

  const handleOpenPermissionsDialog = async (role: Role) => {
    setSelectedRole(role);
    await loadRolePermissions(role.id);
    setPermissionsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingRole) {
        await rolesService.updateRole(editingRole.id, formData);
      } else {
        await rolesService.createRole({
          name: formData.name,
          description: formData.description,
        });
      }
      handleCloseDialog();
      loadData();
    } catch (error: any) {
      setError(error.message || 'Failed to save role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete role "${role.name}"?`)) {
      return;
    }

    try {
      await rolesService.deleteRole(role.id);
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to delete role');
    }
  };

  const handleTogglePermission = async (permissionId: string) => {
    if (!selectedRole) return;

    const isAssigned = rolePermissions.includes(permissionId);
    try {
      if (isAssigned) {
        await rolesService.removePermission(selectedRole.id, permissionId);
        setRolePermissions(prev => prev.filter(id => id !== permissionId));
      } else {
        await rolesService.assignPermission(selectedRole.id, permissionId);
        setRolePermissions(prev => [...prev, permissionId]);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to update permission');
    }
  };

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Key className="h-8 w-8" />
              Roles & Permissions
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage system roles and their permissions
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            New Role
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Roles List */}
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredRoles.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchTerm ? 'No roles found matching your search' : 'No roles found. Create your first role to get started.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRoles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        {role.name}
                      </CardTitle>
                      {role.description && (
                        <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                      )}
                    </div>
                    <Badge variant={role.status === 'active' ? 'default' : 'secondary'}>
                      {role.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Permissions</span>
                      <span className="font-medium">{role._count?.role_permissions || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Users</span>
                      <span className="font-medium">{role._count?.user_roles || 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenPermissionsDialog(role)}
                      className="flex-1"
                    >
                      <Key className="mr-2 h-4 w-4" />
                      Permissions
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(role)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Role Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
              <DialogDescription>
                {editingRole ? 'Update role information' : 'Create a new role for the system'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                {editingRole && (
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'active' | 'inactive') =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingRole ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Permissions: {selectedRole?.name}</DialogTitle>
              <DialogDescription>
                Select permissions to assign to this role
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {Array.isArray(permissions) && permissions.length > 0 ? (
                permissions.map((permission) => {
                  const isAssigned = rolePermissions.includes(permission.id);
                  return (
                    <div
                      key={permission.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{permission.name}</div>
                        {permission.description && (
                          <div className="text-sm text-muted-foreground">{permission.description}</div>
                        )}
                        {permission.category && (
                          <Badge variant="outline" className="mt-1">{permission.category}</Badge>
                        )}
                      </div>
                      <Button
                        variant={isAssigned ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleTogglePermission(permission.id)}
                      >
                        {isAssigned ? 'Remove' : 'Assign'}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {permissions ? 'No permissions available' : 'Loading permissions...'}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setPermissionsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
