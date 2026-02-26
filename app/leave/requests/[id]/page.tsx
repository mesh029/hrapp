'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter, useParams } from 'next/navigation';
import { leaveService, LeaveRequest } from '@/ui/src/services/leave';
import { workflowService } from '@/ui/src/services/workflows';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { ApprovalTimeline, TimelineStep } from '@/components/workflows/ApprovalTimeline';
import { Calendar, User, Clock, FileText, ArrowLeft } from 'lucide-react';

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-500',
  Submitted: 'bg-blue-500',
  UnderReview: 'bg-yellow-500',
  Approved: 'bg-green-500',
  Declined: 'bg-red-500',
  Adjusted: 'bg-orange-500',
  Cancelled: 'bg-gray-400',
};

export default function LeaveRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const [request, setRequest] = React.useState<LeaveRequest | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCancelling, setIsCancelling] = React.useState(false);
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

  const requestId = params.id as string;

  React.useEffect(() => {
    if (requestId) {
      loadLeaveRequest();
    }
  }, [requestId]);

  const loadLeaveRequest = async () => {
    try {
      setIsLoading(true);
      const [requestResponse, workflowResponse] = await Promise.all([
        leaveService.getLeaveRequest(requestId).catch(err => {
          console.error('Failed to load leave request:', err);
          return { success: false, data: null, message: err.message };
        }),
        leaveService.getLeaveRequestWorkflow(requestId).catch(err => {
          console.error('Failed to load workflow:', err);
          return { success: false, data: null };
        }),
      ]);
      
      if (requestResponse.success && requestResponse.data) {
        setRequest(requestResponse.data);
      } else {
        console.error('Leave request not found or error:', requestResponse.message || 'Unknown error');
        setRequest(null);
      }
      
      if (workflowResponse.success && workflowResponse.data) {
        console.log('[Leave Request] Workflow data:', workflowResponse.data);
        setWorkflowTimeline(workflowResponse.data);
      } else {
        console.log('[Leave Request] No workflow data or error:', workflowResponse);
        setWorkflowTimeline({ has_workflow: false, timeline: [] });
      }
    } catch (error: any) {
      console.error('Failed to load leave request:', error);
      setRequest(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!request || !confirm('Are you sure you want to submit this leave request for approval?')) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await leaveService.submitLeaveRequest(request.id);
      if (response.success) {
        await loadLeaveRequest(); // Reload to show updated status
      }
    } catch (error: any) {
      console.error('Failed to submit leave request:', error);
      alert(error.message || 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!request || !confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      setIsCancelling(true);
      const response = await leaveService.cancelLeaveRequest(request.id);
      if (response.success) {
        router.push('/leave/requests');
      }
    } catch (error) {
      console.error('Failed to cancel leave request:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Check if user can edit (must be Draft status and have edit permission)
  // For Draft status, show buttons if user has any leave permission or is admin
  const { isVisible: canEdit } = useComponentVisibility('leave.edit.action', {
    fallbackPermission: 'leave.update',
    fallbackCheck: (features) => {
      if (request?.status !== 'Draft') return false;
      // Show if user has any leave-related permission or is admin
      return features.canCreateLeave || features.canUpdateLeave || features.canSubmitLeave || features.isAdmin || features.canViewAllLeaves;
    },
  });
  
  // Check if user can submit (must be Draft status)
  const { isVisible: canSubmit } = useComponentVisibility('leave.submit.action', {
    fallbackPermission: 'leave.submit',
    fallbackCheck: (features) => {
      if (request?.status !== 'Draft') return false;
      // Show if user has any leave-related permission or is admin
      return features.canCreateLeave || features.canSubmitLeave || features.canUpdateLeave || features.isAdmin || features.canViewAllLeaves;
    },
  });
  
  const { isVisible: canCancelAction } = useComponentVisibility('leave.cancel.action', {
    fallbackPermission: 'leave.update',
    fallbackCheck: (features) => {
      if (request?.status !== 'Draft') return false;
      // Show if user has any leave-related permission or is admin
      return features.canCreateLeave || features.canUpdateLeave || features.canSubmitLeave || features.isAdmin || features.canViewAllLeaves;
    },
  });
  
  const { isVisible: canApproveAction } = useComponentVisibility('leave.approve.action', {
    fallbackPermission: 'leave.approve',
    fallbackCheck: (features) => request?.status === 'UnderReview' && features.canApproveLeave,
  });
  
  const canCancel = canCancelAction;
  const canApprove = canApproveAction;
  const workflowInstanceId = workflowTimeline?.workflow_instance_id;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
      setActionError('Workflow instance is not available for this request.');
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
      await loadLeaveRequest();
    } catch (error: any) {
      console.error('Workflow action failed:', error);
      setActionError(error.message || 'Failed to perform workflow action');
    } finally {
      setIsActioning(false);
    }
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

  if (!request) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            Leave request not found
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/leave/requests')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Leave Request Details</h1>
              <p className="text-muted-foreground mt-1">
                View and manage leave request information
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={statusColors[request.status] || 'bg-gray-500'}>
              {request.status}
            </Badge>
          </div>
        </div>

        {/* Request Details */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Employee Info */}
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
                  <p className="font-medium">{request.user?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{request.user?.email || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Leave Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Leave Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium text-lg">
                  {request.leave_type?.name || 'Unknown'}
                </p>
                {request.leave_type && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Max {request.leave_type.max_days_per_year} days per year
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Date Range */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Date Range
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(request.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{formatDate(request.end_date)}</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">Total Days</p>
                  <p className="font-semibold text-lg">{request.days_requested} days</p>
                </div>
              </CardContent>
            </Card>

            {/* Reason */}
            {request.reason && (
              <Card>
                <CardHeader>
                  <CardTitle>Reason</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{request.reason}</p>
                </CardContent>
              </Card>
            )}

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
                  <Badge className={statusColors[request.status] || 'bg-gray-500'}>
                    {request.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(request.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{formatDate(request.updated_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        {request.status === 'Draft' && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/leave/requests/${request.id}/edit`)}
                >
                  Edit Request
                </Button>
                
                <Button
                  variant="default"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Approval Actions */}
        {canApprove && (
          <Card>
            <CardHeader>
              <CardTitle>Approval Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">

                <div className="flex gap-2">
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
              </div>
              {canApprove && actionMode && (
                <div className="mt-4 border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">
                    {actionMode === 'approve'
                      ? 'Approve current step'
                      : actionMode === 'decline'
                        ? 'Final decline (request will be declined)'
                        : 'Decline and route back for re-approval'}
                  </p>
                  <textarea
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    placeholder={
                      actionMode === 'approve'
                        ? 'Optional approval comment'
                        : 'Required: explain why this request is being declined'
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
