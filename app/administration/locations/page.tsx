'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Building2, MapPin, ChevronRight, Users } from 'lucide-react';
import { locationsService, Location } from '@/ui/src/services/locations';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

const COMPONENT_ID_VIEW = 'admin.locations.view';

export default function LocationsPage() {
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'system.admin',
    fallbackCheck: (features) => features.isAdmin,
  });

  const [locations, setLocations] = React.useState<Location[]>([]);
  const [locationTree, setLocationTree] = React.useState<Location[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<Location | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    parent_id: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'tree' | 'list'>('tree');

  React.useEffect(() => {
    if (!uiLoading && canView) {
      loadLocations();
    }
  }, [uiLoading, canView]);

  const loadLocations = async () => {
    try {
      setIsLoading(true);
      const response = await locationsService.getLocations({ tree: true });
      if (response.success && response.data) {
        if (response.data.tree) {
          setLocationTree(response.data.tree);
        }
        if (response.data.flat || response.data.locations) {
          setLocations(response.data.flat || response.data.locations || []);
        }
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        name: location.name,
        parent_id: location.parent_id || '',
        status: location.status,
      });
    } else {
      setEditingLocation(null);
      setFormData({
        name: '',
        parent_id: '',
        status: 'active',
      });
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLocation(null);
    setFormData({
      name: '',
      parent_id: '',
      status: 'active',
    });
    setError(null);
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
      const data: any = {
        name: formData.name,
        status: formData.status,
      };
      if (formData.parent_id && formData.parent_id !== '__none__') {
        data.parent_id = formData.parent_id;
      } else {
        data.parent_id = null;
      }

      if (editingLocation) {
        await locationsService.updateLocation(editingLocation.id, data);
      } else {
        await locationsService.createLocation(data);
      }
      handleCloseDialog();
      loadLocations();
    } catch (error: any) {
      setError(error.message || 'Failed to save location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (location: Location) => {
    if (!confirm(`Are you sure you want to delete location "${location.name}"?`)) {
      return;
    }

    try {
      await locationsService.deleteLocation(location.id);
      loadLocations();
    } catch (error: any) {
      alert(error.message || 'Failed to delete location');
    }
  };

  const renderLocationTree = (nodes: Location[], level = 0): React.ReactNode => {
    return nodes.map((location) => (
      <div key={location.id} className="space-y-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div style={{ marginLeft: `${level * 24}px` }} className="flex items-center gap-2">
                  {level > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <MapPin className="h-5 w-5" />
                  <div>
                    <div className="font-semibold">{location.name}</div>
                    {location.path && (
                      <div className="text-xs text-muted-foreground">Path: {location.path}</div>
                    )}
                  </div>
                </div>
                <Badge variant={location.status === 'active' ? 'default' : 'secondary'}>
                  {location.status}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {location._count?.users_primary || 0} users
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDialog(location)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(location)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        {location.children && location.children.length > 0 && (
          <div className="ml-4">
            {renderLocationTree(location.children, level + 1)}
          </div>
        )}
      </div>
    ));
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

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="h-8 w-8" />
              Locations
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage organizational locations and hierarchy
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'outline'}
              onClick={() => setViewMode('tree')}
            >
              Tree View
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
            >
              List View
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Location
            </Button>
          </div>
        </div>

        {/* Locations */}
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : viewMode === 'tree' ? (
          <div className="space-y-2">
            {locationTree.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No locations found. Create your first location to get started.
                </CardContent>
              </Card>
            ) : (
              renderLocationTree(locationTree)
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No locations found. Create your first location to get started.
                </CardContent>
              </Card>
            ) : (
              locations.map((location) => (
                <Card key={location.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {location.name}
                    </CardTitle>
                    {location.parent && (
                      <p className="text-sm text-muted-foreground">
                        Parent: {location.parent.name}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={location.status === 'active' ? 'default' : 'secondary'}>
                          {location.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Users</span>
                        <span className="font-medium">{location._count?.users_primary || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Children</span>
                        <span className="font-medium">{location._count?.children || 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(location)}
                        className="flex-1"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(location)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLocation ? 'Edit Location' : 'Create New Location'}</DialogTitle>
              <DialogDescription>
                {editingLocation ? 'Update location information' : 'Create a new location'}
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
                  <Label htmlFor="parent_id">Parent Location</Label>
                  <Select
                    value={formData.parent_id || '__none__'}
                    onValueChange={(value) => setFormData({ ...formData, parent_id: value === '__none__' ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent location (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (Root Location)</SelectItem>
                      {locations
                        .filter(loc => !editingLocation || loc.id !== editingLocation.id)
                        .map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
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
                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingLocation ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
