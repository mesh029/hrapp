'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter, useParams } from 'next/navigation';
import { leaveService, LeaveRequest } from '@/ui/src/services/leave';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useAuth } from '@/ui/src/contexts/auth-context';
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

  const requestId = params.id as string;

  React.useEffect(() => {
    if (requestId) {
      loadLeaveRequest();
    }
  }, [requestId]);

  const loadLeaveRequest = async () => {
    try {
      setIsLoading(true);
      const response = await leaveService.getLeaveRequest(requestId);
      if (response.success && response.data) {
        setRequest(response.data);
      }
    } catch (error) {
      console.error('Failed to load leave request:', error);
    } finally {
      setIsLoading(false);
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

  const canEdit = request?.status === 'Draft' && features.canCreateLeave;
  const canCancel = request?.status === 'Draft' && features.canCreateLeave;
  const canApprove = request?.status === 'UnderReview' && features.canApproveLeave;

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

            {/* Timestamps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
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
        {(canEdit || canCancel || canApprove) && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {canEdit && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/leave/requests/${request.id}/edit`)}
                  >
                    Edit Request
                  </Button>
                )}
                
                {canCancel && (
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={isCancelling}
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                  </Button>
                )}

                {canApprove && (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={() => router.push(`/workflows/approvals?request=${request.id}`)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => router.push(`/workflows/approvals?request=${request.id}&action=decline`)}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
