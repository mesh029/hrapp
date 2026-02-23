'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Circle, User, MessageSquare } from 'lucide-react';

export interface TimelineStep {
  step_order: number;
  required_permission: string;
  allow_decline: boolean;
  allow_adjust: boolean;
  status: 'pending' | 'approved' | 'declined' | 'adjusted';
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
  acted_at: string | null;
  comment: string | null;
  is_current: boolean;
  is_completed: boolean;
  is_pending: boolean;
  is_upcoming: boolean;
}

export interface ApprovalTimelineProps {
  timeline: TimelineStep[];
  workflowStatus?: string;
  className?: string;
}

export function ApprovalTimeline({ timeline, workflowStatus, className }: ApprovalTimelineProps) {
  // Always show the timeline card, even if empty
  // This helps users understand the approval process

  const getStatusIcon = (step: TimelineStep) => {
    if (step.is_completed) {
      if (step.status === 'approved') {
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      } else if (step.status === 'declined') {
        return <XCircle className="h-5 w-5 text-red-600" />;
      } else if (step.status === 'adjusted') {
        return <Circle className="h-5 w-5 text-orange-600" />;
      }
    } else if (step.is_pending) {
      return <Clock className="h-5 w-5 text-yellow-600 animate-pulse" />;
    } else {
      return <Circle className="h-5 w-5 text-gray-300" />;
    }
  };

  const getStatusBadge = (step: TimelineStep) => {
    if (step.is_completed) {
      if (step.status === 'approved') {
        return <Badge className="bg-green-600">Approved</Badge>;
      } else if (step.status === 'declined') {
        return <Badge className="bg-red-600">Declined</Badge>;
      } else if (step.status === 'adjusted') {
        return <Badge className="bg-orange-600">Adjusted</Badge>;
      }
    } else if (step.is_pending) {
      return <Badge className="bg-yellow-600">Pending</Badge>;
    } else {
      return <Badge variant="outline">Upcoming</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Approval Timeline</CardTitle>
        {workflowStatus && (
          <Badge className="mt-2 w-fit">
            {workflowStatus}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {!timeline || timeline.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No workflow timeline available</p>
            <p className="text-sm mt-2">
              This item may not have been submitted for approval yet, or no workflow template is configured.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {timeline.map((step, index) => (
            <div key={step.step_order} className="relative">
              {/* Timeline Line */}
              {index < timeline.length - 1 && (
                <div
                  className={`absolute left-[11px] top-8 w-0.5 h-full ${
                    step.is_completed ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}

              {/* Step Content */}
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="relative z-10 flex-shrink-0">
                  {getStatusIcon(step)}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">
                        Step {step.step_order}: {step.required_permission}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Requires: {step.required_permission}
                      </p>
                    </div>
                    {getStatusBadge(step)}
                  </div>

                  {/* Actor Info */}
                  {step.actor && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{step.actor.name}</span>
                      {step.acted_at && (
                        <span className="text-muted-foreground">
                          • {formatDate(step.acted_at)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Comment */}
                  {step.comment && (
                    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{step.comment}</p>
                    </div>
                  )}

                  {/* Step Options */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {step.allow_decline && (
                      <span>Can Decline</span>
                    )}
                    {step.allow_adjust && (
                      <span>Can Adjust</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
