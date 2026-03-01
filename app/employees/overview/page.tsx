'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building2,
  FileText,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import { employeesService, EmployeeOverview } from '@/ui/src/services/employees';
import { useRouter } from 'next/navigation';
import { ApprovalTimeline } from '@/components/workflows/ApprovalTimeline';

export default function EmployeeOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = React.useState<EmployeeOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await employeesService.getOverview();
      if (response.success && response.data) {
        setOverview(response.data);
      } else {
        setError('Failed to load employee overview');
      }
    } catch (err: any) {
      console.error('Failed to load employee overview:', err);
      setError(err.message || 'Failed to load employee overview');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = (start: string, end: string) => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading your overview...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !overview) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8">
            <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{error || 'Failed to load overview'}</p>
            <Button onClick={loadOverview} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Overview</h1>
          <p className="text-muted-foreground mt-2">
            Your approval timelines, leave balances, and submission status
          </p>
        </div>

        {/* User Info, Manager & Contract */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                My Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-semibold">{overview.user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-semibold">{overview.user.email}</p>
              </div>
              {overview.user.primary_location && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Primary Location
                  </p>
                  <p className="font-semibold">{overview.user.primary_location.name}</p>
                </div>
              )}
              {overview.user.staff_type && (
                <div>
                  <p className="text-sm text-muted-foreground">Staff Type</p>
                  <Badge variant="outline">{overview.user.staff_type.name}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overview.user.manager ? (
                <div className="space-y-2">
                  <p className="font-semibold">{overview.user.manager.name}</p>
                  <p className="text-sm text-muted-foreground">{overview.user.manager.email}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No manager assigned</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Contract Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overview.user.contract.start_date && overview.user.contract.end_date ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-semibold">{formatDate(overview.user.contract.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-semibold">{formatDate(overview.user.contract.end_date)}</p>
                  </div>
                  {overview.user.contract.period_months && (
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-semibold">
                        {overview.user.contract.period_months.toFixed(1)} months
                        {overview.user.contract.period_days && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({overview.user.contract.period_days} days)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {overview.user.contract.status && (
                    <Badge variant={overview.user.contract.status === 'active' ? 'default' : 'secondary'}>
                      {overview.user.contract.status}
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No contract period assigned</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timesheet Submission Window */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timesheet Submission Window
            </CardTitle>
            <CardDescription>
              Current status of timesheet submission periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.timesheet_submission_window.is_open ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-600">Submission Window is Open</p>
                  {overview.timesheet_submission_window.current_period && (
                    <p className="text-sm text-muted-foreground">
                      Period: {formatDateRange(
                        overview.timesheet_submission_window.current_period.period_start,
                        overview.timesheet_submission_window.current_period.period_end
                      )}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-600">Submission Window is Closed</p>
                  <p className="text-sm text-muted-foreground">
                    Timesheet submission is not currently enabled for this period
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Leave Balances
            </CardTitle>
            <CardDescription>Your available leave days by type</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.leave_balances.length === 0 ? (
              <p className="text-muted-foreground">No leave balances found</p>
            ) : (
              <div className="space-y-4">
                {overview.leave_balances.map((balance) => (
                  <div key={balance.leave_type.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold">{balance.leave_type.name}</h4>
                        {balance.max_days_per_year && (
                          <p className="text-xs text-muted-foreground">
                            Max: {balance.max_days_per_year} days/year
                          </p>
                        )}
                      </div>
                      <Badge variant={balance.available > 0 ? 'default' : 'destructive'}>
                        {balance.available.toFixed(2)} days available
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Allocated</p>
                        <p className="font-semibold">{balance.allocated.toFixed(2)}</p>
                        {balance.max_days_per_year && balance.allocated > balance.max_days_per_year && (
                          <p className="text-xs text-yellow-600 mt-1">
                            Exceeds max ({balance.max_days_per_year})
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Used</p>
                        <p className="font-semibold text-red-600">{balance.used.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className="font-semibold text-yellow-600">{balance.pending.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Available</p>
                        <p className="font-semibold text-green-600">{balance.available.toFixed(2)}</p>
                      </div>
                    </div>
                    {balance.explanation && (
                      <div className="mt-3 p-2 bg-muted/50 rounded-md">
                        <p className="text-xs text-muted-foreground">{balance.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Workflow Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Active Workflow Templates
            </CardTitle>
            <CardDescription>
              Current approval workflows that apply to your requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overview.active_workflow_templates.length === 0 ? (
              <p className="text-muted-foreground">No active workflow templates found</p>
            ) : (
              <div className="space-y-4">
                {overview.active_workflow_templates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{template.name}</h4>
                      <Badge variant="outline">{template.resource_type}</Badge>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-2">Approval Steps:</p>
                      <div className="space-y-3">
                        {template.steps.map((step) => (
                          <div key={step.step_order} className="border-l-2 border-primary pl-3 py-2">
                            <div className="flex items-center gap-2 text-sm mb-1">
                              <span className="font-medium">Step {step.step_order}:</span>
                              <span className="text-muted-foreground">{step.required_permission}</span>
                              {step.allow_decline && (
                                <Badge variant="outline" className="text-xs">Can Decline</Badge>
                              )}
                              {step.allow_adjust && (
                                <Badge variant="outline" className="text-xs">Can Adjust</Badge>
                              )}
                            </div>
                            {step.approvers && step.approvers.length > 0 ? (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-1">Will be approved by:</p>
                                <div className="flex flex-wrap gap-2">
                                  {step.approvers.map((approver) => (
                                    <div
                                      key={approver.id}
                                      className="flex flex-col gap-1 px-2 py-1 bg-blue-50 rounded-md text-xs"
                                    >
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3 text-blue-600" />
                                        <span className="font-medium text-blue-900">{approver.name}</span>
                                        <span className="text-blue-700">({approver.email})</span>
                                      </div>
                                      {approver.roles && approver.roles.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {approver.roles.map((role, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5">
                                              {role}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 space-y-1">
                                {step.error ? (
                                  <div className="text-xs bg-red-50 border border-red-200 rounded p-2">
                                    <p className="font-medium text-red-800 mb-1">❌ Error:</p>
                                    <p className="text-red-700">{step.error}</p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-yellow-600">
                                    ⚠️ No approvers found for this step
                                  </p>
                                )}
                                {step.warnings && step.warnings.length > 0 && (
                                  <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 mt-1">
                                    <p className="font-medium text-yellow-800 mb-1">⚠️ Warnings:</p>
                                    <ul className="list-disc list-inside text-yellow-700 space-y-0.5">
                                      {step.warnings.map((warning, idx) => (
                                        <li key={idx}>{warning}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Leave Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Leave Requests
            </CardTitle>
            <CardDescription>Your recent leave requests with approval status</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.recent_leave_requests.length === 0 ? (
              <p className="text-muted-foreground">No recent leave requests</p>
            ) : (
              <div className="space-y-6">
                {overview.recent_leave_requests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{request.leave_type.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDateRange(request.start_date, request.end_date)} •{' '}
                          {request.days_requested} day{request.days_requested !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Badge
                        variant={
                          request.status === 'Approved'
                            ? 'default'
                            : request.status === 'Declined'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {request.status}
                      </Badge>
                    </div>
                    {request.workflow_timeline && (
                      <ApprovalTimeline
                        timeline={request.workflow_timeline.timeline.map((step) => ({
                          ...step,
                          allow_decline: false,
                          allow_adjust: false,
                          is_upcoming: !step.is_completed && !step.is_pending,
                        }))}
                        workflowStatus={request.workflow_timeline.workflow_status}
                        className="mt-4"
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/leave/requests/${request.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Timesheets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Timesheets
            </CardTitle>
            <CardDescription>Your recent timesheets with approval status</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.recent_timesheets.length === 0 ? (
              <p className="text-muted-foreground">No recent timesheets</p>
            ) : (
              <div className="space-y-6">
                {overview.recent_timesheets.map((timesheet) => (
                  <div key={timesheet.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">
                          {formatDateRange(timesheet.period_start, timesheet.period_end)}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Created: {formatDate(timesheet.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          timesheet.status === 'Approved'
                            ? 'default'
                            : timesheet.status === 'Declined'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {timesheet.status}
                      </Badge>
                    </div>
                    {timesheet.workflow_timeline && (
                      <ApprovalTimeline
                        timeline={timesheet.workflow_timeline.timeline.map((step) => ({
                          ...step,
                          allow_decline: false,
                          allow_adjust: false,
                          is_upcoming: !step.is_completed && !step.is_pending,
                        }))}
                        workflowStatus={timesheet.workflow_timeline.workflow_status}
                        className="mt-4"
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/timesheets/${timesheet.id}`)}
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
