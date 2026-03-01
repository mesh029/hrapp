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
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [availableBalance, setAvailableBalance] = React.useState<number | null>(null);
  const [leaveBalances, setLeaveBalances] = React.useState<any[]>([]);
  
  const [formData, setFormData] = React.useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    location_id: '', // Optional - API will use user's primary location from database if not provided
  });

  // Note: location_id is optional - API will use user's primary location if not provided
  // Since primary_location_id is now required in the database, the API will always have it

  React.useEffect(() => {
    // Check if user can access the create form (admin-configured or permission-based)
    if (!uiLoading && !canAccessForm) {
      console.log('[Create Leave Request] Access denied - redirecting. canAccessForm:', canAccessForm);
      router.push('/leave/requests');
      return;
    }

    if (canAccessForm) {
      loadLeaveTypes();
      // Note: location_id is optional - API will use user's primary location if not provided
    }
  }, [uiLoading, canAccessForm, router, user?.primary_location_id]);

  const loadLeaveTypes = async () => {
    try {
      setIsLoading(true);
      const [typesResponse, balancesResponse] = await Promise.all([
        leaveService.getLeaveTypes(),
        user?.id ? leaveService.getLeaveBalances(user.id).catch(() => ({ success: false, data: [] })) : Promise.resolve({ success: false, data: [] }),
      ]);
      
      if (typesResponse.success && typesResponse.data) {
        // Response.data is now always an array after service transformation
        const types = Array.isArray(typesResponse.data) ? typesResponse.data : [];
        // Filter to only active leave types
        const activeTypes = types.filter((lt: any) => lt.status === 'active');
        setLeaveTypes(activeTypes);
        if (activeTypes.length === 0) {
          setError('No active leave types available');
        }
      } else {
        console.error('Failed to load leave types:', typesResponse);
        setError(typesResponse.message || 'Failed to load leave types');
      }

      // Load leave balances
      if (balancesResponse.success && balancesResponse.data) {
        const balances = Array.isArray(balancesResponse.data) ? balancesResponse.data : [];
        setLeaveBalances(balances);
      }
    } catch (error: any) {
      console.error('Failed to load leave types:', error);
      setError(error.message || 'Failed to load leave types');
    } finally {
      setIsLoading(false);
    }
  };

  // Update available balance when leave type changes
  React.useEffect(() => {
    if (formData.leave_type_id && leaveBalances.length > 0) {
      const balance = leaveBalances.find((b: any) => b.leave_type_id === formData.leave_type_id);
      if (balance) {
        const available = balance.allocated - balance.used - balance.pending;
        setAvailableBalance(available);
      } else {
        setAvailableBalance(0);
      }
    } else {
      setAvailableBalance(null);
    }
  }, [formData.leave_type_id, leaveBalances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      setError('Please fill in all required fields');
      return;
    }

    // ENHANCED: Ensure location_id is set before submission
    // Use provided location_id if it's a valid UUID, otherwise use user's primary location
    // Since all users now have primary_location_id required, we can trust it exists
    // If formData.location_id is empty, the API will use the user's primary location
    const locationId = (formData.location_id && formData.location_id.trim() !== '') 
      ? formData.location_id 
      : undefined; // Let the API handle it - it will use user's primary location
    
    // Note: We don't need to validate locationId here anymore since:
    // 1. All users have primary_location_id (required in DB)
    // 2. The API will use user's primary location if location_id is not provided
    // 3. The API will validate the location exists and is active

    try {
      setIsSubmitting(true);
      setError('');
      setValidationErrors([]);
      
      const response = await leaveService.createLeaveRequest({
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        reason: formData.reason || undefined,
        location_id: locationId || undefined, // Optional - API will use user's primary location if not provided
      });

      if (response.success) {
        router.push('/leave/requests');
      } else {
        // ENHANCED: Extract detailed error messages from response
        const errorData = (response as any).errors || {};
        const errorMessages = (response as any).message || 'Failed to create leave request';
        
        // Handle different error response structures
        if (errorData.errors && Array.isArray(errorData.errors)) {
          setValidationErrors(errorData.errors);
          setError(errorMessages);
        } else if (errorData.fieldErrors && typeof errorData.fieldErrors === 'object') {
          // Handle field-level errors from schema validation
          const fieldErrors = Object.entries(errorData.fieldErrors)
            .map(([field, messages]: [string, any]) => {
              if (Array.isArray(messages)) {
                return messages.map((msg: string) => `${field}: ${msg}`);
              }
              return [`${field}: ${messages}`];
            })
            .flat();
          setValidationErrors(fieldErrors);
          setError(errorMessages);
        } else if (errorData.errors && typeof errorData.errors === 'object') {
          // Handle other object error structures
          const fieldErrors = Object.values(errorData.errors).flat() as string[];
          setValidationErrors(fieldErrors);
          setError(errorMessages);
        } else if (errorMessages.includes('Validation failed')) {
          // If message contains validation info, try to extract it
          setError(errorMessages);
          setValidationErrors([errorMessages]);
        } else {
          setError(errorMessages);
          setValidationErrors([]);
        }
      }
    } catch (err: any) {
      console.error('Create leave request error:', err);
      // ENHANCED: Parse error response for detailed messages
      if (err.response?.data?.errors) {
        const errors = Array.isArray(err.response.data.errors) 
          ? err.response.data.errors 
          : [err.response.data.message || 'Failed to create leave request'];
        setValidationErrors(errors);
        setError(err.response.data.message || 'Failed to create leave request');
      } else {
        setError(err.message || 'Failed to create leave request');
      }
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
                  {leaveTypes.map((type) => {
                    const balance = leaveBalances.find((b: any) => b.leave_type_id === type.id);
                    const available = balance ? (balance.allocated - balance.used - balance.pending) : 0;
                    return (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.max_days_per_year} days/year) - {available.toFixed(1)} days available
                      </option>
                    );
                  })}
                </select>
                {/* ENHANCED: Show available balance */}
                {formData.leave_type_id && availableBalance !== null && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <p className="text-sm">
                      <span className="font-medium">Available Balance:</span>{' '}
                      <span className={availableBalance < calculateDays() ? 'text-destructive font-bold' : 'text-emerald-600 dark:text-emerald-400'}>
                        {availableBalance.toFixed(1)} days
                      </span>
                      {availableBalance < calculateDays() && (
                        <span className="text-destructive text-xs block mt-1">
                          ⚠️ You are requesting {calculateDays()} days but only have {availableBalance.toFixed(1)} days available
                        </span>
                      )}
                    </p>
                  </div>
                )}
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

              {/* ENHANCED: Detailed Error Messages */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">{error}</span>
                  </div>
                  {validationErrors.length > 0 && (
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {validationErrors.map((err, idx) => (
                        <li key={idx} className="text-xs">{err}</li>
                      ))}
                    </ul>
                  )}
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
