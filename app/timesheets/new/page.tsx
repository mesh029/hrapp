'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { timesheetService } from '@/ui/src/services/timesheets';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { AlertCircle, Loader2, ArrowLeft, Calendar } from 'lucide-react';

const COMPONENT_ID_CREATE_FORM = 'timesheet.create.form';

export default function CreateTimesheetPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isVisible: canAccess } = useComponentVisibility(COMPONENT_ID_CREATE_FORM, {
    fallbackPermission: 'timesheet.create',
    fallbackCheck: (features) => features.canCreateTimesheet && !features.isAdmin,
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  
  // Default to current month
  const getCurrentMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  const getCurrentMonthEnd = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  };

  const [formData, setFormData] = React.useState({
    period_start: getCurrentMonthStart(),
    period_end: getCurrentMonthEnd(),
  });

  React.useEffect(() => {
    if (!canAccess) {
      router.push('/timesheets');
    }
  }, [canAccess, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.period_start || !formData.period_end) {
      setError('Please select a period');
      return;
    }

    const start = new Date(formData.period_start);
    const end = new Date(formData.period_end);

    if (end < start) {
      setError('End date must be after start date');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await timesheetService.createTimesheet({
        period_start: formData.period_start,
        period_end: formData.period_end,
      });

      if (response.success && response.data) {
        router.push(`/timesheets/${response.data.id}`);
      } else {
        setError('Failed to create timesheet');
      }
    } catch (err: any) {
      console.error('Create timesheet error:', err);
      setError(err.message || 'Failed to create timesheet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateDays = () => {
    if (!formData.period_start || !formData.period_end) return 0;
    const start = new Date(formData.period_start);
    const end = new Date(formData.period_end);
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (!canAccess) {
    return null; // Will redirect
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/timesheets')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Timesheet</h1>
            <p className="text-muted-foreground mt-1">
              Create a new timesheet for a specific period
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timesheet Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period_start">
                    Period Start <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="period_start"
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, period_start: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period_end">
                    Period End <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="period_end"
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, period_end: e.target.value }))}
                    min={formData.period_start}
                    required
                  />
                </div>
              </div>

              {/* Days Calculation */}
              {formData.period_start && formData.period_end && (
                <div className="p-3 bg-muted rounded-md space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Period Duration:</span> {calculateDays()} day(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A timesheet entry will be created for each day in this period
                  </p>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      📝 After creating the timesheet, you'll be able to enter work hours for each day
                    </p>
                  </div>
                </div>
              )}

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setFormData({
                      period_start: start.toISOString().split('T')[0],
                      period_end: end.toISOString().split('T')[0],
                    });
                  }}
                >
                  Current Month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const end = new Date(now.getFullYear(), now.getMonth(), 0);
                    setFormData({
                      period_start: start.toISOString().split('T')[0],
                      period_end: end.toISOString().split('T')[0],
                    });
                  }}
                >
                  Last Month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setFormData({
                      period_start: start.toISOString().split('T')[0],
                      period_end: end.toISOString().split('T')[0],
                    });
                  }}
                >
                  Next Month
                </Button>
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
                  onClick={() => router.push('/timesheets')}
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
                    'Create Timesheet'
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
