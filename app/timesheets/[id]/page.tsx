'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter, useParams } from 'next/navigation';
import { timesheetService, Timesheet } from '@/ui/src/services/timesheets';
import { workflowService } from '@/ui/src/services/workflows';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { usePermissions } from '@/ui/src/hooks/use-permissions';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { ApprovalTimeline, TimelineStep } from '@/components/workflows/ApprovalTimeline';
import { Calendar, User, Clock, FileText, ArrowLeft, Edit, Send, CheckCircle, ClockIcon, CalendarDays, Trash2 } from 'lucide-react';

const COMPONENT_ID_DETAIL_VIEW = 'timesheet.detail.view';
const COMPONENT_ID_EDIT_ACTION = 'timesheet.edit.action';
const COMPONENT_ID_SUBMIT_ACTION = 'timesheet.submit.action';
const COMPONENT_ID_WEEKEND_EXTRA_BUTTON = 'timesheet.weekend-extra.button';
const COMPONENT_ID_OVERTIME_BUTTON = 'timesheet.overtime.button';

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-500',
  Submitted: 'bg-blue-500',
  UnderReview: 'bg-yellow-500',
  Approved: 'bg-green-500',
  Declined: 'bg-red-500',
  Locked: 'bg-purple-500',
};

export default function TimesheetDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { features } = useDynamicUI();
  const { hasPermission } = usePermissions();
  const [timesheet, setTimesheet] = React.useState<Timesheet | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<{
    canSubmit: boolean;
    validation: {
      status: 'valid' | 'warning' | 'error';
      expectedHours: number;
      actualHours: number;
      discrepancy: number;
      dailyIssues: Array<{
        date: string;
        expected: number;
        actual: number;
        discrepancy: number;
        issue: string;
      }>;
      notes: string[];
    };
  } | null>(null);
  const [workflowTimeline, setWorkflowTimeline] = React.useState<{
    has_workflow: boolean;
    workflow_instance_id?: string;
    workflow_status?: string;
    current_step_order?: number;
    template?: { id: string; name: string; resource_type: string };
    timeline: TimelineStep[];
  } | null>(null);
  const [actionMode, setActionMode] = React.useState<'approve' | 'decline' | 'reroute' | null>(null);
  const [actionComment, setActionComment] = React.useState('');
  const [routeToStep, setRouteToStep] = React.useState<string>('');
  const [isActioning, setIsActioning] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const timesheetId = params.id as string;

  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_DETAIL_VIEW, {
    fallbackPermission: 'timesheet.read',
    fallbackCheck: (features) => features.canViewAllTimesheets || features.canCreateTimesheet,
  });

  // Always show edit button for Draft timesheets if user has any timesheet permissions
  const { isVisible: canEdit, isLoading: canEditLoading } = useComponentVisibility(COMPONENT_ID_EDIT_ACTION, {
    fallbackPermission: 'timesheet.update',
    fallbackCheck: (features) => {
      // Show edit button if timesheet is Draft and user has any timesheet permission
      if (timesheet?.status !== 'Draft') {
        console.log('[Timesheet] Edit button hidden: timesheet status is', timesheet?.status);
        return false;
      }
      const hasPermission = features.canCreateTimesheet || features.canUpdateTimesheet || features.canSubmitTimesheet || features.isAdmin || features.canViewAllTimesheets;
      console.log('[Timesheet] Edit button visibility:', { 
        status: timesheet?.status, 
        hasPermission, 
        canCreate: features.canCreateTimesheet,
        canUpdate: features.canUpdateTimesheet,
        canSubmit: features.canSubmitTimesheet,
        isAdmin: features.isAdmin
      });
      return hasPermission;
    },
    defaultVisible: false,
  });

  // Always show submit button for Draft timesheets if user has any timesheet permissions
  const { isVisible: canSubmit, isLoading: canSubmitLoading } = useComponentVisibility(COMPONENT_ID_SUBMIT_ACTION, {
    fallbackPermission: 'timesheet.submit',
    fallbackCheck: (features) => {
      // Show submit button if timesheet is Draft and user has any timesheet permission
      if (timesheet?.status !== 'Draft') {
        console.log('[Timesheet] Submit button hidden: timesheet status is', timesheet?.status);
        return false;
      }
      const hasPermission = features.canCreateTimesheet || features.canSubmitTimesheet || features.canUpdateTimesheet || features.isAdmin || features.canViewAllTimesheets;
      console.log('[Timesheet] Submit button visibility:', { 
        status: timesheet?.status, 
        hasPermission, 
        canCreate: features.canCreateTimesheet,
        canSubmit: features.canSubmitTimesheet,
        canUpdate: features.canUpdateTimesheet,
        isAdmin: features.isAdmin
      });
      return hasPermission;
    },
    defaultVisible: false,
  });

  const { isVisible: canRequestWeekendExtra } = useComponentVisibility(COMPONENT_ID_WEEKEND_EXTRA_BUTTON, {
    fallbackPermission: 'timesheet.create',
    fallbackCheck: (features) => timesheet?.status === 'Draft' && features.canCreateTimesheet && !features.isAdmin,
  });

  const { isVisible: canRequestOvertime } = useComponentVisibility(COMPONENT_ID_OVERTIME_BUTTON, {
    fallbackPermission: 'timesheet.create',
    fallbackCheck: (features) => timesheet?.status === 'Draft' && features.canCreateTimesheet && !features.isAdmin,
  });

  const { isVisible: canApproveAction } = useComponentVisibility('timesheet.approve.action', {
    fallbackPermission: 'timesheet.approve',
    fallbackCheck: (features) => timesheet?.status === 'UnderReview' && features.canApproveTimesheet,
  });

  // Check if user can delete (admin only)
  const canDelete = features.isAdmin || hasPermission('timesheet.delete') || hasPermission('system.admin');
  const workflowInstanceId = workflowTimeline?.workflow_instance_id;
  const canApprove = canApproveAction;

  React.useEffect(() => {
    if (timesheetId && canView) {
      loadTimesheet();
      loadValidation();
    }
  }, [timesheetId, canView]);

  const loadTimesheet = async () => {
    try {
      setIsLoading(true);
      const [timesheetResponse, workflowResponse] = await Promise.all([
        timesheetService.getTimesheet(timesheetId).catch(err => {
          console.error('Failed to load timesheet:', err);
          return { success: false, data: null, message: err.message };
        }),
        timesheetService.getTimesheetWorkflow(timesheetId).catch(err => {
          console.error('Failed to load workflow:', err);
          return { success: false, data: null };
        }),
      ]);
      
      if (timesheetResponse.success && timesheetResponse.data) {
        setTimesheet(timesheetResponse.data);
      } else {
        console.error('Timesheet not found or error:', timesheetResponse.message || 'Unknown error');
        setTimesheet(null);
      }
      
      if (workflowResponse.success && workflowResponse.data) {
        console.log('[Timesheet] Workflow data:', workflowResponse.data);
        setWorkflowTimeline(workflowResponse.data);
      } else {
        console.log('[Timesheet] No workflow data or error:', workflowResponse);
        setWorkflowTimeline({ has_workflow: false, timeline: [] });
      }
    } catch (error: any) {
      console.error('Failed to load timesheet:', error);
      setTimesheet(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadValidation = async () => {
    try {
      const response = await timesheetService.validateTimesheet(timesheetId);
      if (response.success && response.data) {
        setValidationResult(response.data);
      }
    } catch (error) {
      console.error('Failed to validate timesheet:', error);
    }
  };

  const handleSubmit = async () => {
    if (!timesheet || !confirm('Are you sure you want to submit this timesheet for approval?')) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await timesheetService.submitTimesheet(timesheet.id);
      if (response.success) {
        router.push('/timesheets');
      }
    } catch (error) {
      console.error('Failed to submit timesheet:', error);
      alert('Failed to submit timesheet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!timesheet) return;

    const confirmMessage = timesheet.status === 'Approved' 
      ? '⚠️ WARNING: This timesheet has been approved. Are you sure you want to delete it? This action cannot be undone.'
      : `Are you sure you want to delete this timesheet? This action cannot be undone.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await timesheetService.deleteTimesheet(timesheet.id);
      if (response.success) {
        router.push('/timesheets');
      } else {
        alert(response.message || 'Failed to delete timesheet');
      }
    } catch (error: any) {
      console.error('Failed to delete timesheet:', error);
      alert(error.message || 'Failed to delete timesheet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAction = (mode: 'approve' | 'decline' | 'reroute') => {
    setActionMode(mode);
    setActionComment('');
    setRouteToStep(
      workflowTimeline?.current_step_order
        ? String(workflowTimeline.current_step_order)
        : ''
    );
    setActionError(null);
  };

  const closeAction = () => {
    setActionMode(null);
    setActionComment('');
    setRouteToStep('');
    setActionError(null);
  };

  const handleWorkflowAction = async () => {
    if (!workflowInstanceId || !actionMode) {
      setActionError('Workflow instance is not available for this timesheet.');
      return;
    }

    if ((actionMode === 'decline' || actionMode === 'reroute') && !actionComment.trim()) {
      setActionError('Comment is required for decline/reroute actions.');
      return;
    }

    try {
      setIsActioning(true);
      setActionError(null);

      if (actionMode === 'approve') {
        await workflowService.approveInstance(workflowInstanceId, actionComment.trim() || undefined);
      } else if (actionMode === 'decline') {
        await workflowService.declineInstance(workflowInstanceId, actionComment.trim());
      } else {
        const step = Number(routeToStep);
        if (!Number.isInteger(step) || step < 1) {
          setActionError('Select a valid step to route back to.');
          return;
        }
        await workflowService.routeBackInstance(workflowInstanceId, actionComment.trim(), step);
      }

      closeAction();
      await loadTimesheet();
    } catch (error: any) {
      console.error('Workflow action failed:', error);
      setActionError(error.message || 'Failed to perform workflow action');
    } finally {
      setIsActioning(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to view this timesheet
          </div>
        </div>
      </MainLayout>
    );
  }

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
            Timesheet not found
          </div>
        </div>
      </MainLayout>
    );
  }

  // Helper function to safely convert to number
  const toNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    // Handle Prisma Decimal objects
    if (value && typeof value === 'object' && 'toNumber' in value) {
      return (value as any).toNumber();
    }
    return Number(value) || 0;
  };

  const totalWorkHours = timesheet.entries?.reduce((sum, e) => sum + toNumber(e.work_hours), 0) || 0;
  const totalLeaveHours = timesheet.entries?.reduce((sum, e) => sum + toNumber(e.leave_hours), 0) || 0;
  const totalHolidayHours = timesheet.entries?.reduce((sum, e) => sum + toNumber(e.holiday_hours), 0) || 0;
  const totalOvertimeHours = timesheet.entries?.reduce((sum, e) => sum + toNumber(e.overtime_hours), 0) || 0;
  const totalWeekendExtraHours = timesheet.entries?.reduce((sum, e) => sum + toNumber(e.weekend_extra_hours), 0) || 0;

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/timesheets')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Timesheet Details</h1>
              <p className="text-muted-foreground mt-1">
                View and manage timesheet information
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={statusColors[timesheet.status] || 'bg-gray-500'}>
              {timesheet.status}
            </Badge>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Work Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWorkHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leave Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeaveHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Holiday Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHolidayHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overtime</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOvertimeHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Weekend Extra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWeekendExtraHours.toFixed(1)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Employee Info */}
            {features.canViewAllTimesheets && timesheet.user && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Employee Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{timesheet.user.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{timesheet.user.email}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Period Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Period Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(timesheet.period_start)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{formatDate(timesheet.period_end)}</p>
                </div>
                {timesheet.location && (
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{timesheet.location.name}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Status History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Current Status</p>
                  <Badge className={statusColors[timesheet.status] || 'bg-gray-500'}>
                    {timesheet.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(timesheet.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{formatDate(timesheet.updated_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Validation & Actions */}
          <div className="space-y-6">
            {/* Validation Status */}
            {timesheet.status === 'Draft' && validationResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Validation Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {/* Status message */}
                    {validationResult.canSubmit ? (
                      <div className="p-3 rounded-md bg-green-500/10 text-green-700 text-sm">
                        ✓ Timesheet is ready to submit
                        {validationResult.validation?.status === 'warning' && validationResult.validation.dailyIssues && validationResult.validation.dailyIssues.length > 0 && (
                          <span className="ml-2 text-yellow-600">(Has {validationResult.validation.dailyIssues.length} warning(s))</span>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-md bg-red-500/10 text-red-700 text-sm">
                        ✗ Timesheet cannot be submitted - Critical issues found
                      </div>
                    )}
                    
                    {/* Validation notes - clear and concise */}
                    {validationResult.validation?.notes && validationResult.validation.notes.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {validationResult.validation.notes.map((note, idx) => {
                          const isCritical = note.includes('❌');
                          const isWarning = note.includes('⚠️');
                          const isInfo = note.includes('Total:');
                          return (
                            <div key={idx} className={`text-sm ${
                              isCritical
                                ? 'text-red-700 font-medium'
                                : isWarning
                                ? 'text-yellow-700'
                                : isInfo
                                ? 'text-muted-foreground'
                                : 'text-muted-foreground'
                            }`}>
                              {note}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions - Always show for Draft timesheets */}
            {timesheet?.status === 'Draft' && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {/* Always show Edit button for Draft timesheets */}
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/timesheets/${timesheet.id}/edit`)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Entries
                    </Button>

                    {canRequestWeekendExtra && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/timesheets/${timesheet.id}/weekend-extra/new`)}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Request Weekend Extra
                      </Button>
                    )}

                    {canRequestOvertime && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/timesheets/${timesheet.id}/overtime/new`)}
                      >
                        <ClockIcon className="mr-2 h-4 w-4" />
                        Request Overtime
                      </Button>
                    )}
                    
                    {/* Always show Submit button for Draft timesheets */}
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || (validationResult && !validationResult.canSubmit)}
                      title={validationResult && !validationResult.canSubmit ? 'Please fix critical validation errors before submitting' : undefined}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    </Button>

                    {canDelete && (
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isSubmitting ? 'Deleting...' : 'Delete Timesheet'}
                      </Button>
                    )}

                    {canApprove && (
                      <div className="pt-3 border-t space-y-2">
                        <Button
                          variant="default"
                          onClick={() => openAction('approve')}
                          disabled={!workflowInstanceId}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => openAction('decline')}
                          disabled={!workflowInstanceId}
                        >
                          Final Decline
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => openAction('reroute')}
                          disabled={!workflowInstanceId || !workflowTimeline?.timeline?.length}
                        >
                          Decline & Route Back
                        </Button>
                      </div>
                    )}
                  </div>

                  {canApprove && actionMode && (
                    <div className="mt-4 border-t pt-4 space-y-3">
                      <p className="text-sm font-medium">
                        {actionMode === 'approve'
                          ? 'Approve current step'
                          : actionMode === 'decline'
                            ? 'Final decline (timesheet will be declined)'
                            : 'Decline and route back for re-approval'}
                      </p>
                      <textarea
                        value={actionComment}
                        onChange={(e) => setActionComment(e.target.value)}
                        placeholder={
                          actionMode === 'approve'
                            ? 'Optional approval comment'
                            : 'Required: explain why this timesheet is being declined'
                        }
                        className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      {actionMode === 'reroute' && (
                        <div>
                          <p className="text-sm mb-1">Route back to step</p>
                          <select
                            value={routeToStep}
                            onChange={(e) => setRouteToStep(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            {workflowTimeline?.timeline?.map((step) => (
                              <option key={step.step_order} value={String(step.step_order)}>
                                Step {step.step_order} ({step.required_permission})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={closeAction} disabled={isActioning}>
                          Cancel
                        </Button>
                        <Button onClick={handleWorkflowAction} disabled={isActioning}>
                          {isActioning ? 'Processing...' : 'Submit'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Timesheet Entries Table */}
        {timesheet.entries && timesheet.entries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Timesheet Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Work</th>
                      <th className="text-right p-2">Leave</th>
                      <th className="text-right p-2">Holiday</th>
                      <th className="text-right p-2">Overtime</th>
                      <th className="text-right p-2">Weekend</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheet.entries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">{formatDateShort(entry.date)}</td>
                        <td className="text-right p-2">{toNumber(entry.work_hours)}</td>
                        <td className="text-right p-2">{toNumber(entry.leave_hours)}</td>
                        <td className="text-right p-2">{toNumber(entry.holiday_hours)}</td>
                        <td className="text-right p-2">{toNumber(entry.overtime_hours)}</td>
                        <td className="text-right p-2">{toNumber(entry.weekend_extra_hours)}</td>
                        <td className="p-2 text-sm text-muted-foreground">{entry.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="p-2">Total</td>
                      <td className="text-right p-2">{totalWorkHours.toFixed(1)}</td>
                      <td className="text-right p-2">{totalLeaveHours.toFixed(1)}</td>
                      <td className="text-right p-2">{totalHolidayHours.toFixed(1)}</td>
                      <td className="text-right p-2">{totalOvertimeHours.toFixed(1)}</td>
                      <td className="text-right p-2">{totalWeekendExtraHours.toFixed(1)}</td>
                      <td className="p-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval Timeline */}
        <ApprovalTimeline
          timeline={workflowTimeline?.timeline || []}
          workflowStatus={workflowTimeline?.workflow_status}
          templateName={workflowTimeline?.template?.name}
        />
      </div>
    </MainLayout>
  );
}
