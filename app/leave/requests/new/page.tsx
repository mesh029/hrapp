'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { leaveService, LeaveType } from '@/ui/src/services/leave';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { AlertCircle, Loader2 } from 'lucide-react';

const COMPONENT_ID_CREATE_FORM = 'leave.create.form';

export default function CreateLeaveRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canAccessForm } = useComponentVisibility(
    COMPONENT_ID_CREATE_FORM,
    {
      fallbackPermission: 'leave.create',
      fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
    }
  );
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  
  const [formData, setFormData] = React.useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    location_id: user?.primary_location_id || '',
  });

  React.useEffect(() => {
    // Check if user can access the create form (admin-configured or permission-based)
    if (!uiLoading && !canAccessForm) {
      console.log('[Create Leave Request] Access denied - redirecting. canAccessForm:', canAccessForm);
      router.push('/leave/requests');
      return;
    }

    if (canAccessForm) {
      loadLeaveTypes();
    }
  }, [uiLoading, canAccessForm, router]);

  const loadLeaveTypes = async () => {
    try {
      setIsLoading(true);
      const response = await leaveService.getLeaveTypes();
      if (response.success && response.data) {
        // Response.data is now always an array after service transformation
        const types = Array.isArray(response.data) ? response.data : [];
        // Filter to only active leave types
        const activeTypes = types.filter((lt: any) => lt.status === 'active');
        setLeaveTypes(activeTypes);
        if (activeTypes.length === 0) {
          setError('No active leave types available');
        }
      } else {
        console.error('Failed to load leave types:', response);
        setError(response.message || 'Failed to load leave types');
      }
    } catch (error: any) {
      console.error('Failed to load leave types:', error);
      setError(error.message || 'Failed to load leave types');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await leaveService.createLeaveRequest({
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || undefined,
        location_id: formData.location_id || undefined,
      });

      if (response.success) {
        router.push('/leave/requests');
      } else {
        setError('Failed to create leave request');
      }
    } catch (err: any) {
      console.error('Create leave request error:', err);
      setError(err.message || 'Failed to create leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (uiLoading || isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!canAccessForm) {
    return null; // Will redirect
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Create Leave Request</h1>
          <p className="text-muted-foreground mt-1">
            Submit a new leave request for approval
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Leave Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Leave Type */}
              <div className="space-y-2">
                <Label htmlFor="leave_type_id">
                  Leave Type <span className="text-destructive">*</span>
                </Label>
                <select
                  id="leave_type_id"
                  value={formData.leave_type_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, leave_type_id: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                  disabled={isLoading || leaveTypes.length === 0}
                >
                  <option value="">{isLoading ? 'Loading leave types...' : leaveTypes.length === 0 ? 'No leave types available' : 'Select leave type'}</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.max_days_per_year} days/year)
                    </option>
                  ))}
                </select>
                {error && error.includes('leave types') && (
                  <p className="text-sm text-destructive mt-1">{error}</p>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">
                    End Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    min={formData.start_date}
                    required
                  />
                </div>
              </div>

              {/* Days Calculation */}
              {formData.start_date && formData.end_date && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    <span className="font-medium">Days Requested:</span> {calculateDays()} day(s)
                  </p>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                  placeholder="Enter reason for leave request..."
                />
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
                  onClick={() => router.push('/leave/requests')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Leave Request'
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
