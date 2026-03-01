'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, ToggleLeft, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/ui/src/services/api';

interface TimesheetPeriod {
  id: string;
  period_start: string;
  period_end: string;
  submission_enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function TimesheetPeriodsPage() {
  const [periods, setPeriods] = React.useState<TimesheetPeriod[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [newPeriod, setNewPeriod] = React.useState({
    period_start: '',
    period_end: '',
    submission_enabled: true,
  });
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  React.useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get<{ success: boolean; data: { periods: TimesheetPeriod[] } }>('/api/timesheets/periods');
      if (response.success && response.data) {
        setPeriods(response.data.periods || []);
      } else {
        setError('Failed to load timesheet periods');
      }
    } catch (err: any) {
      console.error('Failed to load periods:', err);
      setError(err.message || 'Failed to load timesheet periods');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSubmission = async (period: TimesheetPeriod) => {
    try {
      setIsSaving(period.id);
      setError('');
      
      const response = await api.post<{ success: boolean; message: string }>('/api/timesheets/periods/enable', {
        period_start: period.period_start.split('T')[0],
        period_end: period.period_end.split('T')[0],
        submission_enabled: !period.submission_enabled,
      });

      if (response.success) {
        await loadPeriods(); // Reload to show updated status
      } else {
        setError(response.message || 'Failed to update period');
      }
    } catch (err: any) {
      console.error('Failed to toggle submission:', err);
      setError(err.message || 'Failed to update period');
    } finally {
      setIsSaving(null);
    }
  };

  const createPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriod.period_start || !newPeriod.period_end) {
      setError('Please fill in both start and end dates');
      return;
    }

    try {
      setIsSaving('new');
      setError('');
      
      const response = await api.post<{ success: boolean; message: string }>('/api/timesheets/periods/enable', {
        period_start: newPeriod.period_start,
        period_end: newPeriod.period_end,
        submission_enabled: newPeriod.submission_enabled,
      });

      if (response.success) {
        setNewPeriod({ period_start: '', period_end: '', submission_enabled: true });
        setShowCreateForm(false);
        await loadPeriods();
      } else {
        setError(response.message || 'Failed to create period');
      }
    } catch (err: any) {
      console.error('Failed to create period:', err);
      setError(err.message || 'Failed to create period');
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Timesheet Periods</h1>
            <p className="text-muted-foreground mt-1">
              Manage timesheet submission periods
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Calendar className="h-4 w-4 mr-2" />
            {showCreateForm ? 'Cancel' : 'Create Period'}
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Period</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createPeriod} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="period_start">Start Date</Label>
                    <Input
                      id="period_start"
                      type="date"
                      value={newPeriod.period_start}
                      onChange={(e) => setNewPeriod(prev => ({ ...prev, period_start: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="period_end">End Date</Label>
                    <Input
                      id="period_end"
                      type="date"
                      value={newPeriod.period_end}
                      onChange={(e) => setNewPeriod(prev => ({ ...prev, period_end: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="submission_enabled"
                    checked={newPeriod.submission_enabled}
                    onChange={(e) => setNewPeriod(prev => ({ ...prev, submission_enabled: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="submission_enabled">Enable submission for this period</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isSaving === 'new'}>
                    {isSaving === 'new' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Period'
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Periods List */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading periods...</p>
              </div>
            </CardContent>
          </Card>
        ) : periods.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No timesheet periods found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create a new period to enable timesheet submission
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {periods.map((period) => (
              <Card key={period.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {new Date(period.period_start).toLocaleDateString()} - {new Date(period.period_end).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {period.submission_enabled ? (
                          <span className="text-green-600">Submission Enabled</span>
                        ) : (
                          <span className="text-red-600">Submission Disabled</span>
                        )}
                        {period.enabled_at && (
                          <span className="ml-2">
                            • Enabled: {new Date(period.enabled_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={period.submission_enabled ? 'default' : 'outline'}
                      onClick={() => toggleSubmission(period)}
                      disabled={isSaving === period.id}
                    >
                      {isSaving === period.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : period.submission_enabled ? (
                        <>
                          <ToggleRight className="mr-2 h-4 w-4" />
                          Disable
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="mr-2 h-4 w-4" />
                          Enable
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
