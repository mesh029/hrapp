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
import { Plus, Edit, Trash2, Users, Settings } from 'lucide-react';
import { adminService, UserCategory } from '@/ui/src/services/admin';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

const COMPONENT_ID_VIEW = 'admin.user-categories.view';

export default function UserCategoriesPage() {
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'system.admin',
    fallbackCheck: (features) => features.isAdmin,
  });

  const [categories, setCategories] = React.useState<UserCategory[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<UserCategory | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    color: '#3B82F6',
    priority: 0,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!uiLoading && canView) {
      loadCategories();
    }
  }, [uiLoading, canView]);

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const response = await adminService.getUserCategories();
      console.log('[UserCategories] Full API Response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        // Handle nested data structure (API might return { success: true, data: { data: [...] } })
        let categoriesData = response.data;
        if (categoriesData && typeof categoriesData === 'object' && 'data' in categoriesData && Array.isArray((categoriesData as any).data)) {
          console.log('[UserCategories] Found nested data structure, extracting...');
          categoriesData = (categoriesData as any).data;
        }
        
        // Ensure it's an array
        if (Array.isArray(categoriesData)) {
          console.log(`[UserCategories] Loaded ${categoriesData.length} categories:`, categoriesData);
          setCategories(categoriesData);
        } else {
          console.error('[UserCategories] Data is not an array:', categoriesData);
          setCategories([]);
        }
      } else {
        console.error('[UserCategories] API returned success: false:', response);
        setCategories([]);
      }
    } catch (error) {
      console.error('[UserCategories] Exception loading categories:', error);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (category?: UserCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        color: category.color || '#3B82F6',
        priority: category.priority,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6',
        priority: 0,
      });
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      priority: 0,
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
      if (editingCategory) {
        await adminService.updateUserCategory(editingCategory.id, formData);
      } else {
        await adminService.createUserCategory(formData);
      }
      handleCloseDialog();
      loadCategories();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: UserCategory) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      await adminService.deleteUserCategory(category.id);
      loadCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category');
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

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Categories</h1>
            <p className="text-muted-foreground mt-1">
              Manage user categories for component visibility configuration
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </Button>
        </div>

        {/* Categories List */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No categories found. Create one to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {category.color && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{category.name}</h3>
                          <Badge variant="outline">Priority: {category.priority}</Badge>
                        </div>
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {category.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {category._count?.assignments || 0} users
                          </span>
                          <span className="flex items-center gap-1">
                            <Settings className="h-4 w-4" />
                            {category._count?.visibility_configs || 0} configs
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(category)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Update the category details below.'
                  : 'Create a new user category for organizing component visibility.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
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
                    Higher = more specific
                  </p>
                </div>
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
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
