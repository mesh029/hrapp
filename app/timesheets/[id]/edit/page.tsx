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
    fallbackCheck: (features) => (features.canCreateTimesheet || features.canUpdateTimesheet) && !features.isAdmin,
  });

  const timesheetId = params.id as string;
  const [timesheet, setTimesheet] = React.useState<Timesheet | null>(null);
  const [entries, setEntries] = React.useState<Record<string, Partial<TimesheetEntry>>>({});
  const [entriesMetadata, setEntriesMetadata] = React.useState<Record<string, {
    is_auto_added: boolean;
    leave_request_id?: string | null;
    holiday_id?: string | null;
    leave_request?: any;
    holiday?: any;
  }>>({});
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
          setError(`Only draft timesheets can be edited. Current status: ${ts.status}`);
          setTimeout(() => router.push(`/timesheets/${timesheetId}`), 3000);
          return;
        }
        
        console.log('[EditTimesheet] Timesheet loaded:', {
          id: ts.id,
          status: ts.status,
          entriesCount: ts.entries?.length || 0,
          canAccess,
          isDraft: ts.status === 'Draft',
        });
        
        // Verify status is Draft
        if (ts.status !== 'Draft') {
          console.error('[EditTimesheet] Status check failed:', {
            expected: 'Draft',
            actual: ts.status,
          });
        }

        setTimesheet(ts);
        
        // Initialize entries state
        if (ts.entries && ts.entries.length > 0) {
          const entriesMap: Record<string, Partial<TimesheetEntry>> = {};
          const metadata: Record<string, {
            is_auto_added: boolean;
            leave_request_id?: string | null;
            holiday_id?: string | null;
            leave_request?: any;
            holiday?: any;
            weekend_extra_request_id?: string | null;
            weekend_extra_request?: any;
            expected_hours?: number;
          }> = {};
          
          ts.entries.forEach(entry => {
            // Normalize date to YYYY-MM-DD format for consistent key matching
            const dateKey = typeof entry.date === 'string' 
              ? entry.date.split('T')[0] 
              : new Date(entry.date).toISOString().split('T')[0];
            
            entriesMap[dateKey] = {
              work_hours: typeof entry.work_hours === 'number' ? entry.work_hours : (entry.work_hours ? parseFloat(entry.work_hours.toString()) : 0),
              leave_hours: typeof entry.leave_hours === 'number' ? entry.leave_hours : (entry.leave_hours ? parseFloat(entry.leave_hours.toString()) : 0),
              holiday_hours: typeof entry.holiday_hours === 'number' ? entry.holiday_hours : (entry.holiday_hours ? parseFloat(entry.holiday_hours.toString()) : 0),
              overtime_hours: typeof entry.overtime_hours === 'number' ? entry.overtime_hours : (entry.overtime_hours ? parseFloat(entry.overtime_hours.toString()) : 0),
              weekend_extra_hours: typeof entry.weekend_extra_hours === 'number' ? entry.weekend_extra_hours : (entry.weekend_extra_hours ? parseFloat(entry.weekend_extra_hours.toString()) : 0),
              notes: entry.notes || entry.description || '',
            };
            
            metadata[dateKey] = {
              is_auto_added: entry.is_auto_added || false,
              leave_request_id: entry.leave_request_id,
              holiday_id: entry.holiday_id,
              leave_request: entry.leave_request,
              holiday: entry.holiday,
              weekend_extra_request_id: entry.weekend_extra_request_id,
              weekend_extra_request: entry.weekend_extra_request,
              expected_hours: entry.expected_hours 
                ? (typeof entry.expected_hours === 'number' 
                    ? entry.expected_hours 
                    : parseFloat(entry.expected_hours.toString()) || 0)
                : 0,
            };
          });
          
          setEntries(entriesMap);
          setEntriesMetadata(metadata);
          
          console.log('[EditTimesheet] Loaded entries:', {
            count: ts.entries.length,
            entriesMapKeys: Object.keys(entriesMap),
            metadataKeys: Object.keys(metadata),
          });
        } else {
          console.warn('[EditTimesheet] No entries found in timesheet');
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
    setEntries(prev => {
      const currentEntry = prev[date] || {};
      const metadata = entriesMetadata[date] || {};
      const newValue = field.includes('notes') ? value : parseFloat(value) || 0;
      
      // Mutual exclusivity: Only one of work_hours, leave_hours, or holiday_hours can be > 0
      const updatedEntry = { ...currentEntry };
      
      if (field === 'work_hours' && newValue > 0) {
        // If setting work hours, clear leave and holiday hours
        updatedEntry.leave_hours = 0;
        updatedEntry.holiday_hours = 0;
        updatedEntry[field] = newValue;
      } else if (field === 'leave_hours' && newValue > 0) {
        // If setting leave hours, clear work and holiday hours
        updatedEntry.work_hours = 0;
        updatedEntry.holiday_hours = 0;
        updatedEntry[field] = newValue;
      } else if (field === 'holiday_hours' && newValue > 0) {
        // If setting holiday hours, clear work and leave hours
        updatedEntry.work_hours = 0;
        updatedEntry.leave_hours = 0;
        updatedEntry[field] = newValue;
      } else {
        // For other fields or setting to 0, just update the field
        updatedEntry[field] = newValue;
      }
      
      return {
        ...prev,
        [date]: updatedEntry,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setIsSaving(true);
      
      // Convert entries map to array format
      // API only accepts work_hours and description (notes)
      const entriesArray = Object.entries(entries).map(([date, data]) => ({
        date,
        work_hours: data.work_hours || 0,
        description: data.notes || undefined,
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

  if (!timesheet) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            {error || 'Timesheet not found'}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!canAccess) {
    console.warn('[EditTimesheet] Access denied:', { canAccess, timesheetId });
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to edit this timesheet
          </div>
        </div>
      </MainLayout>
    );
  }

  // Check status again in render (in case it changed)
  if (timesheet.status !== 'Draft') {
    console.warn('[EditTimesheet] Render check - not Draft:', {
      status: timesheet.status,
      id: timesheet.id,
    });
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            Only draft timesheets can be edited. Current status: <strong>{timesheet.status}</strong>
            <br />
            <small className="text-xs mt-2 block">Timesheet ID: {timesheet.id}</small>
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
            <p className="text-xs text-red-500 mt-1">
              Status: {timesheet.status} | Entries: {sortedEntries.length} | You should see INPUT FIELDS below, not just text
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Timesheet Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <form 
              onSubmit={handleSubmit} 
              className="space-y-6" 
              noValidate
              style={{ pointerEvents: 'auto' }}
            >
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
                    {sortedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                          No entries found. Please create a timesheet first.
                        </td>
                      </tr>
                    ) : (
                      sortedEntries.map((entry) => {
                        // Normalize date to YYYY-MM-DD format for consistent key matching
                        const dateKey = typeof entry.date === 'string' 
                          ? entry.date.split('T')[0] 
                          : new Date(entry.date).toISOString().split('T')[0];
                        
                        const entryData = entries[dateKey] || {};
                        const metadata = entriesMetadata[dateKey] || {};
                        const hasApprovedLeave = !!(metadata.leave_request_id || metadata.leave_request);
                        const hasHoliday = !!(metadata.holiday_id || metadata.holiday);
                        const isAutoAdded = metadata.is_auto_added || false;
                        
                        // Check if this is a weekend (Saturday=6, Sunday=0)
                        const entryDate = new Date(entry.date);
                        const dayOfWeek = entryDate.getDay(); // 0=Sunday, 6=Saturday
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        
                        // Check if there's an approved weekend extra request
                        const hasApprovedWeekendExtra = !!(metadata.weekend_extra_request_id || metadata.weekend_extra_request);
                        
                        // Mutual exclusivity: Only one type can be > 0
                        const hasWorkHours = (entryData.work_hours || 0) > 0;
                        const hasLeaveHours = (entryData.leave_hours || 0) > 0 || hasApprovedLeave;
                        const hasHolidayHours = (entryData.holiday_hours || 0) > 0 || hasHoliday;
                        
                        // Weekend restriction: Work hours disabled on weekends unless approved weekend extra
                        const canEnterWorkHours = !isWeekend || hasApprovedWeekendExtra;
                        
                        // Debug log for first entry
                        if (sortedEntries.indexOf(entry) === 0) {
                          console.log('[EditTimesheet] First entry debug:', {
                            entryDate: entry.date,
                            dateKey,
                            entryData,
                            metadata,
                            hasApprovedLeave,
                            hasHoliday,
                            entriesKeys: Object.keys(entries),
                            metadataKeys: Object.keys(entriesMetadata),
                            timesheetStatus: timesheet.status,
                            canAccess,
                            isSaving,
                          });
                          console.log('[EditTimesheet] Input disabled states:', {
                            workHours: hasApprovedLeave || hasHoliday,
                            leaveHours: hasApprovedLeave,
                            holidayHours: hasHoliday,
                            overtime: false,
                            weekendExtra: false,
                          });
                        }
                      
                      return (
                        <tr key={entry.id} className={`border-b hover:bg-muted/50 ${hasApprovedLeave ? 'bg-blue-50 dark:bg-blue-950/20' : hasHoliday ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}>
                          <td className="p-2">
                            <div className="font-medium">{formatDate(entry.date)}</div>
                            {hasApprovedLeave && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                Leave: {metadata.leave_request?.leave_type?.name || 'Approved Leave'}
                              </div>
                            )}
                            {hasHoliday && (
                              <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                Holiday: {metadata.holiday?.name || 'Holiday'}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.work_hours || 0}
                              onChange={(e) => {
                                const val = e.target.value;
                                console.log('[EditTimesheet] Work hours onChange:', { dateKey, value: val, tagName: e.target.tagName });
                                handleEntryChange(dateKey, 'work_hours', val);
                              }}
                              onFocus={(e) => {
                                console.log('[EditTimesheet] Work hours onFocus:', { dateKey, tagName: e.target.tagName, type: e.target.type });
                              }}
                              onClick={(e) => {
                                console.log('[EditTimesheet] Work hours onClick:', { 
                                  dateKey, 
                                  disabled: e.currentTarget.disabled,
                                  tagName: e.currentTarget.tagName,
                                  type: e.currentTarget.type,
                                  isContentEditable: e.currentTarget.isContentEditable
                                });
                                e.stopPropagation();
                              }}
                              className="w-20 text-right flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                              disabled={isSaving || (hasApprovedLeave || hasHoliday || !canEnterWorkHours)}
                              readOnly={false}
                              autoComplete="off"
                              title={
                                hasApprovedLeave ? 'Work hours disabled for approved leave days' : 
                                hasHoliday ? 'Work hours disabled for holidays' : 
                                isWeekend && !hasApprovedWeekendExtra ? 'Weekend work requires manager approval (weekend extra request)' :
                                'Enter work hours'
                              }
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.leave_hours || 0}
                              onChange={(e) => handleEntryChange(dateKey, 'leave_hours', e.target.value)}
                              className="w-20 text-right flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                              disabled={isSaving || hasApprovedLeave || hasWorkHours || hasHolidayHours}
                              readOnly={false}
                              title={
                                hasApprovedLeave ? 'Leave hours are auto-populated from approved leave request' : 
                                hasWorkHours ? 'Cannot enter leave hours when work hours are set (mutual exclusivity)' :
                                hasHolidayHours ? 'Cannot enter leave hours when holiday hours are set (mutual exclusivity)' :
                                'Enter leave hours'
                              }
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.holiday_hours || 0}
                              onChange={(e) => handleEntryChange(dateKey, 'holiday_hours', e.target.value)}
                              className="w-20 text-right flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                              disabled={isSaving || hasHoliday || hasWorkHours || hasLeaveHours}
                              readOnly={false}
                              title={
                                hasHoliday ? 'Holiday hours are auto-populated' : 
                                hasWorkHours ? 'Cannot enter holiday hours when work hours are set (mutual exclusivity)' :
                                hasLeaveHours ? 'Cannot enter holiday hours when leave hours are set (mutual exclusivity)' :
                                'Enter holiday hours'
                              }
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.overtime_hours || 0}
                              onChange={(e) => handleEntryChange(dateKey, 'overtime_hours', e.target.value)}
                              className="w-20 text-right flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                              disabled={isSaving}
                              readOnly={false}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={entryData.weekend_extra_hours || 0}
                              onChange={(e) => handleEntryChange(dateKey, 'weekend_extra_hours', e.target.value)}
                              className="w-20 text-right flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                              disabled={isSaving}
                              readOnly={false}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={entryData.notes || ''}
                              onChange={(e) => handleEntryChange(dateKey, 'notes', e.target.value)}
                              placeholder="Notes..."
                              className="w-full flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                            />
                          </td>
                        </tr>
                      );
                    }))}
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
                  variant="secondary"
                  onClick={() => {
                    // Fill all work hours for entries that don't have leave/holiday and are not weekends
                    setEntries(prev => {
                      const updated = { ...prev };
                      sortedEntries.forEach(entry => {
                        const dateKey = typeof entry.date === 'string' 
                          ? entry.date.split('T')[0] 
                          : new Date(entry.date).toISOString().split('T')[0];
                        
                        const currentEntry = prev[dateKey] || {};
                        const metadata = entriesMetadata[dateKey] || {};
                        
                        // Check if this is a weekend
                        const entryDate = new Date(entry.date);
                        const dayOfWeek = entryDate.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const hasApprovedWeekendExtra = !!(metadata.weekend_extra_request_id || metadata.weekend_extra_request);
                        
                        // Get expected hours from metadata (from work hours config)
                        const expectedHours = metadata.expected_hours || 8; // Fallback to 8 if not available
                        
                        // Only fill if:
                        // 1. No leave/holiday
                        // 2. Work hours is 0
                        // 3. Not a weekend OR has approved weekend extra
                        // 4. Expected hours > 0 (it's a work day)
                        if (!metadata?.hasApprovedLeave && 
                            !metadata?.hasHoliday && 
                            (!currentEntry.work_hours || currentEntry.work_hours === 0) &&
                            (!isWeekend || hasApprovedWeekendExtra) &&
                            expectedHours > 0) {
                          updated[dateKey] = {
                            ...currentEntry,
                            work_hours: expectedHours, // Use expected hours from work hours config
                            leave_hours: 0, // Clear leave/holiday to maintain mutual exclusivity
                            holiday_hours: 0,
                          };
                        }
                      });
                      return updated;
                    });
                  }}
                  disabled={isSaving}
                >
                  Fill All Work Hours (8h)
                </Button>
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
