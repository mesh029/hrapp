'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { timesheetService } from '@/ui/src/services/timesheets';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useAuth } from '@/ui/src/contexts/auth-context';

const COMPONENT_ID_FORM = 'timesheet.overtime.create.form';

export default function CreateOvertimeRequestPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const timesheetId = params.id as string;

  const [formData, setFormData] = React.useState({
    entry_date: '',
    requested_hours: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { isVisible: canAccessForm } = useComponentVisibility(COMPONENT_ID_FORM, {
    fallbackPermission: 'timesheet.create',
    fallbackCheck: (features) => features.canCreateTimesheet && !features.isAdmin,
  });

  React.useEffect(() => {
    if (!uiLoading && !canAccessForm) {
      router.push(`/timesheets/${timesheetId}`);
      return;
    }
  }, [uiLoading, canAccessForm, router, timesheetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.entry_date || !formData.requested_hours || !formData.reason) {
      setError('Please fill in all required fields');
      return;
    }

    const hours = parseFloat(formData.requested_hours);
    if (isNaN(hours) || hours <= 0) {
      setError('Requested hours must be a positive number');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await timesheetService.requestOvertime({
        timesheet_id: timesheetId,
        entry_date: formData.entry_date,
        requested_hours: hours,
        reason: formData.reason,
      });

      if (response.success) {
        router.push(`/timesheets/${timesheetId}`);
      } else {
        setError('Failed to create overtime request');
      }
    } catch (err: any) {
      console.error('Failed to create overtime request:', err);
      setError(err.message || 'Failed to create overtime request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canAccessForm) {
    return null;
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/timesheets/${timesheetId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Request Overtime Hours</h1>
            <p className="text-muted-foreground mt-1">
              Request overtime hours for additional work
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Overtime Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="entry_date">Entry Date *</Label>
                <Input
                  id="entry_date"
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Select the date for overtime work
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requested_hours">Requested Hours *</Label>
                <Input
                  id="requested_hours"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={formData.requested_hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, requested_hours: e.target.value }))}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Number of overtime hours requested
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={4}
                  required
                  placeholder="Explain why you need overtime hours..."
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/timesheets/${timesheetId}`)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
