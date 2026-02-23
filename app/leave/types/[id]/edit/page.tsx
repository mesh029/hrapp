'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter, useParams } from 'next/navigation';
import { leaveService, LeaveType } from '@/ui/src/services/leave';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

const COMPONENT_ID_EDIT_FORM = 'leave.types.edit.form';

export default function EditLeaveTypePage() {
  const router = useRouter();
  const params = useParams();
  const { isVisible: canAccess } = useComponentVisibility(COMPONENT_ID_EDIT_FORM, {
    fallbackPermission: 'leave.types.update',
    fallbackCheck: (features) => features.isAdmin || features.canManageConfig,
  });

  const typeId = params.id as string;
  const [leaveType, setLeaveType] = React.useState<LeaveType | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    max_days_per_year: '',
    carry_forward_allowed: false,
    carry_forward_days: '',
    is_paid: true,
    status: 'active' as 'active' | 'inactive',
  });

  React.useEffect(() => {
    if (typeId && canAccess) {
      loadLeaveType();
    }
  }, [typeId, canAccess]);

  React.useEffect(() => {
    if (!canAccess && !isLoading) {
      router.push('/leave/types');
    }
  }, [canAccess, isLoading, router]);

  const loadLeaveType = async () => {
    try {
      setIsLoading(true);
      const response = await leaveService.getLeaveTypes();
      if (response.success && response.data) {
        const type = response.data.find(t => t.id === typeId);
        if (type) {
          setLeaveType(type);
          setFormData({
            name: type.name,
            description: type.description || '',
            max_days_per_year: type.max_days_per_year.toString(),
            carry_forward_allowed: type.carry_forward_allowed,
            carry_forward_days: type.carry_forward_days?.toString() || '',
            is_paid: true, // API doesn't return is_paid, defaulting to true
            status: type.status,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load leave type:', error);
      setError('Failed to load leave type');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.max_days_per_year) {
      setError('Please fill in all required fields');
      return;
    }

    const maxDays = parseInt(formData.max_days_per_year);
    if (isNaN(maxDays) || maxDays <= 0) {
      setError('Max days per year must be a positive number');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await leaveService.updateLeaveType(typeId, {
        name: formData.name,
        description: formData.description || undefined,
        max_days_per_year: maxDays,
        carry_forward_allowed: formData.carry_forward_allowed,
        carry_forward_days: formData.carry_forward_allowed && formData.carry_forward_days
          ? parseInt(formData.carry_forward_days)
          : undefined,
        is_paid: formData.is_paid,
        status: formData.status,
      });

      if (response.success) {
        router.push('/leave/types');
      } else {
        setError('Failed to update leave type');
      }
    } catch (err: any) {
      console.error('Update leave type error:', err);
      setError(err.message || 'Failed to update leave type');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!leaveType || !canAccess) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            {error || 'Leave type not found or cannot be edited'}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/leave/types')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Leave Type</h1>
            <p className="text-muted-foreground mt-1">
              Update leave type configuration
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Type Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                />
              </div>

              {/* Max Days Per Year */}
              <div className="space-y-2">
                <Label htmlFor="max_days_per_year">
                  Max Days Per Year <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="max_days_per_year"
                  type="number"
                  min="1"
                  value={formData.max_days_per_year}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_days_per_year: e.target.value }))}
                  required
                />
              </div>

              {/* Is Paid */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_paid"
                  checked={formData.is_paid}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_paid: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_paid" className="font-normal">
                  Paid Leave
                </Label>
              </div>

              {/* Carry Forward Allowed */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="carry_forward_allowed"
                  checked={formData.carry_forward_allowed}
                  onChange={(e) => setFormData(prev => ({ ...prev, carry_forward_allowed: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="carry_forward_allowed" className="font-normal">
                  Allow Carry Forward
                </Label>
              </div>

              {/* Carry Forward Days */}
              {formData.carry_forward_allowed && (
                <div className="space-y-2">
                  <Label htmlFor="carry_forward_days">Max Carry Forward Days</Label>
                  <Input
                    id="carry_forward_days"
                    type="number"
                    min="0"
                    value={formData.carry_forward_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, carry_forward_days: e.target.value }))}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              )}

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/leave/types')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Leave Type'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
