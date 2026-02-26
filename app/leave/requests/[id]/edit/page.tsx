'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter, useParams } from 'next/navigation';
import { leaveService, LeaveRequest, LeaveType } from '@/ui/src/services/leave';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

const COMPONENT_ID_EDIT_FORM = 'leave.edit.form';

export default function EditLeaveRequestPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { isVisible: canEdit } = useComponentVisibility(
    COMPONENT_ID_EDIT_FORM,
    {
      fallbackPermission: 'leave.update',
      fallbackCheck: (features) => features.canCreateLeave && !features.isAdmin,
    }
  );

  const requestId = params.id as string;
  const [request, setRequest] = React.useState<LeaveRequest | null>(null);
  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const [formData, setFormData] = React.useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  React.useEffect(() => {
    if (requestId) {
      loadData();
    }
  }, [requestId]);

  React.useEffect(() => {
    if (!canEdit && !isLoading) {
      router.push(`/leave/requests/${requestId}`);
    }
  }, [canEdit, isLoading, router, requestId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load leave request and leave types in parallel
      const [requestResponse, typesResponse] = await Promise.all([
        leaveService.getLeaveRequest(requestId),
        leaveService.getLeaveTypes(),
      ]);

      if (requestResponse.success && requestResponse.data) {
        const req = requestResponse.data;
        
        // Only allow editing if status is Draft
        if (req.status !== 'Draft') {
          setError('Only draft leave requests can be edited');
          setTimeout(() => router.push(`/leave/requests/${requestId}`), 2000);
          return;
        }

        setRequest(req);
        setFormData({
          leave_type_id: req.leave_type_id,
          start_date: req.start_date.split('T')[0], // Extract date part
          end_date: req.end_date.split('T')[0],
          reason: req.reason || '',
        });
      }

      if (typesResponse.success && typesResponse.data) {
        // Handle nested response structure: response.data.leaveTypes or direct array
        const types = (typesResponse.data as any)?.leaveTypes || typesResponse.data;
        const activeTypes = Array.isArray(types) ? types.filter((lt: any) => lt.status === 'active') : [];
        setLeaveTypes(activeTypes);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load leave request');
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
      const response = await leaveService.updateLeaveRequest(requestId, {
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || undefined,
      });

      if (response.success) {
        router.push(`/leave/requests/${requestId}`);
      } else {
        setError('Failed to update leave request');
      }
    } catch (err: any) {
      console.error('Update leave request error:', err);
      setError(err.message || 'Failed to update leave request');
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!request || !canEdit) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            {error || 'Leave request not found or cannot be edited'}
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
            onClick={() => router.push(`/leave/requests/${requestId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Edit Leave Request</h1>
            <p className="text-muted-foreground mt-1">
              Update your leave request details
            </p>
          </div>
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
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.max_days_per_year} days/year)
                    </option>
                  ))}
                </select>
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
                  onClick={() => router.push(`/leave/requests/${requestId}`)}
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
                    'Update Leave Request'
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
