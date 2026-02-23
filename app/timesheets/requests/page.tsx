'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CalendarDays, ClockIcon, Check, X, User, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { timesheetService, WeekendExtraRequest, OvertimeRequest } from '@/ui/src/services/timesheets';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useAuth } from '@/ui/src/contexts/auth-context';

const COMPONENT_ID_REQUESTS_VIEW = 'timesheet.requests.view';

export default function PendingRequestsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const [weekendExtraRequests, setWeekendExtraRequests] = React.useState<WeekendExtraRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = React.useState<OvertimeRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedRequest, setSelectedRequest] = React.useState<{
    type: 'weekend-extra' | 'overtime';
    request: WeekendExtraRequest | OvertimeRequest;
  } | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = React.useState(false);
  const [approveNotes, setApproveNotes] = React.useState('');
  const [declineReason, setDeclineReason] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_REQUESTS_VIEW, {
    fallbackPermission: 'timesheet.approve',
    fallbackCheck: (features) => features.canApproveTimesheet,
  });

  React.useEffect(() => {
    if (!uiLoading && canView) {
      loadPendingRequests();
    }
  }, [uiLoading, canView]);

  const loadPendingRequests = async () => {
    try {
      setIsLoading(true);
      const response = await timesheetService.getPendingRequests();
      if (response.success && response.data) {
        setWeekendExtraRequests(response.data.weekend_extra || []);
        setOvertimeRequests(response.data.overtime || []);
      }
    } catch (error) {
      console.error('Failed to load pending requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      setIsProcessing(true);
      let response;
      if (selectedRequest.type === 'weekend-extra') {
        response = await timesheetService.approveWeekendExtra(
          selectedRequest.request.id,
          approveNotes ? { notes: approveNotes } : undefined
        );
      } else {
        response = await timesheetService.approveOvertime(
          selectedRequest.request.id,
          approveNotes ? { notes: approveNotes } : undefined
        );
      }

      if (response.success) {
        setApproveDialogOpen(false);
        setSelectedRequest(null);
        setApproveNotes('');
        loadPendingRequests();
      }
    } catch (error) {
      console.error('Failed to approve request:', error);
      alert('Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedRequest || !declineReason.trim()) {
      alert('Please provide a reason for declining');
      return;
    }

    try {
      setIsProcessing(true);
      let response;
      if (selectedRequest.type === 'weekend-extra') {
        response = await timesheetService.declineWeekendExtra(
          selectedRequest.request.id,
          { reason: declineReason }
        );
      } else {
        response = await timesheetService.declineOvertime(
          selectedRequest.request.id,
          { reason: declineReason }
        );
      }

      if (response.success) {
        setDeclineDialogOpen(false);
        setSelectedRequest(null);
        setDeclineReason('');
        loadPendingRequests();
      }
    } catch (error) {
      console.error('Failed to decline request:', error);
      alert('Failed to decline request');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to view pending requests
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
          <h1 className="text-3xl font-bold">Pending Timesheet Requests</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve or decline weekend extra and overtime requests
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Weekend Extra Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Weekend Extra Requests ({weekendExtraRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {weekendExtraRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending weekend extra requests
                  </div>
                ) : (
                  <div className="space-y-4">
                    {weekendExtraRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {(request as any).requester?.name || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(request.entry_date)}</span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">{request.requested_hours}</span> hours requested
                            </div>
                            <div className="text-sm text-muted-foreground mt-2">
                              {request.reason}
                            </div>
                            {(request as any).timesheet && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Timesheet: {formatDate((request as any).timesheet.period_start)} - {formatDate((request as any).timesheet.period_end)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest({ type: 'weekend-extra', request });
                              setApproveDialogOpen(true);
                            }}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest({ type: 'weekend-extra', request });
                              setDeclineDialogOpen(true);
                            }}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overtime Requests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClockIcon className="h-5 w-5" />
                  Overtime Requests ({overtimeRequests.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overtimeRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No pending overtime requests
                  </div>
                ) : (
                  <div className="space-y-4">
                    {overtimeRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {(request as any).requester?.name || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(request.entry_date)}</span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">{request.requested_hours}</span> hours requested
                            </div>
                            <div className="text-sm text-muted-foreground mt-2">
                              {request.reason}
                            </div>
                            {(request as any).timesheet && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Timesheet: {formatDate((request as any).timesheet.period_start)} - {formatDate((request as any).timesheet.period_end)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest({ type: 'overtime', request });
                              setApproveDialogOpen(true);
                            }}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest({ type: 'overtime', request });
                              setDeclineDialogOpen(true);
                            }}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Approve Dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Request</DialogTitle>
              <DialogDescription>
                Approve this {selectedRequest?.type === 'weekend-extra' ? 'weekend extra' : 'overtime'} request?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="approve-notes">Notes (Optional)</Label>
                <Textarea
                  id="approve-notes"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any notes about this approval..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setApproveDialogOpen(false);
                  setApproveNotes('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Approve'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decline Dialog */}
        <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Request</DialogTitle>
              <DialogDescription>
                Provide a reason for declining this {selectedRequest?.type === 'weekend-extra' ? 'weekend extra' : 'overtime'} request.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="decline-reason">Reason *</Label>
                <Textarea
                  id="decline-reason"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why this request is being declined..."
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeclineDialogOpen(false);
                  setDeclineReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={isProcessing || !declineReason.trim()}
              >
                {isProcessing ? 'Processing...' : 'Decline'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
