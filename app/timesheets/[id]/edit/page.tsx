'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter, useParams } from 'next/navigation';
import { timesheetService, Timesheet, TimesheetEntry } from '@/ui/src/services/timesheets';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { AlertCircle, Loader2, ArrowLeft, Save } from 'lucide-react';

const COMPONENT_ID_EDIT_FORM = 'timesheet.edit.form';

export default function EditTimesheetPage() {
  const router = useRouter();
  const params = useParams();
  const { isVisible: canAccess } = useComponentVisibility(COMPONENT_ID_EDIT_FORM, {
    fallbackPermission: 'timesheet.update',
    fallbackCheck: (features) => features.canCreateTimesheet && !features.isAdmin,
  });

  const timesheetId = params.id as string;
  const [timesheet, setTimesheet] = React.useState<Timesheet | null>(null);
  const [entries, setEntries] = React.useState<Record<string, Partial<TimesheetEntry>>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (timesheetId && canAccess) {
      loadTimesheet();
    }
  }, [timesheetId, canAccess]);

  React.useEffect(() => {
    if (!canAccess && !isLoading) {
      router.push(`/timesheets/${timesheetId}`);
    }
  }, [canAccess, isLoading, router, timesheetId]);

  const loadTimesheet = async () => {
    try {
      setIsLoading(true);
      const response = await timesheetService.getTimesheet(timesheetId);
      if (response.success && response.data) {
        const ts = response.data;
        
        // Only allow editing if status is Draft
        if (ts.status !== 'Draft') {
          setError('Only draft timesheets can be edited');
          setTimeout(() => router.push(`/timesheets/${timesheetId}`), 2000);
          return;
        }

        setTimesheet(ts);
        
        // Initialize entries state
        if (ts.entries) {
          const entriesMap: Record<string, Partial<TimesheetEntry>> = {};
          ts.entries.forEach(entry => {
            entriesMap[entry.date] = {
              work_hours: entry.work_hours || 0,
              leave_hours: entry.leave_hours || 0,
              holiday_hours: entry.holiday_hours || 0,
              overtime_hours: entry.overtime_hours || 0,
              weekend_extra_hours: entry.weekend_extra_hours || 0,
              notes: entry.notes || '',
            };
          });
          setEntries(entriesMap);
        }
      }
    } catch (error) {
      console.error('Failed to load timesheet:', error);
      setError('Failed to load timesheet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntryChange = (date: string, field: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [field]: field.includes('notes') ? value : parseFloat(value) || 0,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setIsSaving(true);
      
      // Convert entries map to array format
      const entriesArray = Object.entries(entries).map(([date, data]) => ({
        date,
        work_hours: data.work_hours,
        leave_hours: data.leave_hours,
        holiday_hours: data.holiday_hours,
        overtime_hours: data.overtime_hours,
        weekend_extra_hours: data.weekend_extra_hours,
        notes: data.notes,
      }));

      const response = await timesheetService.updateTimesheetEntries(timesheetId, {
        entries: entriesArray,
      });

      if (response.success) {
        router.push(`/timesheets/${timesheetId}`);
      } else {
        setError('Failed to update timesheet');
      }
    } catch (err: any) {
      console.error('Update timesheet error:', err);
      setError(err.message || 'Failed to update timesheet');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
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

  if (!timesheet || !canAccess) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            {error || 'Timesheet not found or cannot be edited'}
          </div>
        </div>
      </MainLayout>
    );
  }

  const sortedEntries = timesheet.entries?.sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  ) || [];

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-6xl">
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
            <h1 className="text-3xl font-bold">Edit Timesheet</h1>
            <p className="text-muted-foreground mt-1">
              Update timesheet entries for {new Date(timesheet.period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Timesheet Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Entries Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Work Hours</th>
                      <th className="text-right p-2">Leave Hours</th>
                      <th className="text-right p-2">Holiday Hours</th>
                      <th className="text-right p-2">Overtime Hours</th>
                      <th className="text-right p-2">Weekend Extra</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry) => {
                      const entryData = entries[entry.date] || {};
                      return (
                        <tr key={entry.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div className="font-medium">{formatDate(entry.date)}</div>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.work_hours || 0}
                              onChange={(e) => handleEntryChange(entry.date, 'work_hours', e.target.value)}
                              className="w-20 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.leave_hours || 0}
                              onChange={(e) => handleEntryChange(entry.date, 'leave_hours', e.target.value)}
                              className="w-20 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.holiday_hours || 0}
                              onChange={(e) => handleEntryChange(entry.date, 'holiday_hours', e.target.value)}
                              className="w-20 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.overtime_hours || 0}
                              onChange={(e) => handleEntryChange(entry.date, 'overtime_hours', e.target.value)}
                              className="w-20 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.weekend_extra_hours || 0}
                              onChange={(e) => handleEntryChange(entry.date, 'weekend_extra_hours', e.target.value)}
                              className="w-20 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="text"
                              value={entryData.notes || ''}
                              onChange={(e) => handleEntryChange(entry.date, 'notes', e.target.value)}
                              placeholder="Notes..."
                              className="w-full"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                  onClick={() => router.push(`/timesheets/${timesheetId}`)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
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
