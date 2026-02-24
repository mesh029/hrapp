'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { api } from '@/ui/src/services/api';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';

interface PendingApproval {
  id: string;
  resource_type: 'leave' | 'timesheet';
  resource_id: string;
  created_at: string;
  current_step_order: number;
  total_steps: number;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  template: {
    name: string;
  };
  step: {
    step_order: number;
    required_permission: string;
    status: string;
  };
}

export default function PendingApprovalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [approvals, setApprovals] = React.useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const { isVisible: canView } = useComponentVisibility('approvals.pending.view', {
    fallbackPermission: 'workflows.read',
  });

  React.useEffect(() => {
    if (canView && user) {
      loadPendingApprovals();
    }
  }, [canView, user]);

  const loadPendingApprovals = async () => {
    try {
      setIsLoading(true);
      // Get pending approvals that require this user's action
      const response = await api.get('/api/workflows/instances/pending');
      
      if (response.success && response.data) {
        setApprovals(response.data.approvals || response.data || []);
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (approval: PendingApproval) => {
    if (approval.resource_type === 'leave') {
      router.push(`/leave/requests/${approval.resource_id}`);
    } else {
      router.push(`/timesheets/${approval.resource_id}`);
    }
  };

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">You don't have permission to view pending approvals.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pending Approvals</h1>
            <p className="text-muted-foreground mt-1">
              Items requiring your approval
            </p>
          </div>
          <Button onClick={loadPendingApprovals} variant="outline">
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Loading pending approvals...</p>
            </CardContent>
          </Card>
        ) : approvals.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No pending approvals</p>
              <p className="text-muted-foreground mt-2">
                You're all caught up! There are no items waiting for your approval.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {approvals.map((approval) => (
              <Card key={approval.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {approval.resource_type === 'leave' ? (
                          <Calendar className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-purple-600" />
                        )}
                        <CardTitle className="text-lg">
                          {approval.template.name}
                        </CardTitle>
                        <Badge variant="outline">
                          {approval.resource_type === 'leave' ? 'Leave Request' : 'Timesheet'}
                        </Badge>
                      </div>
                      <CardDescription>
                        Step {approval.current_step_order} of {approval.total_steps}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {approval.step.required_permission}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{approval.creator.name}</span>
                      <span className="text-muted-foreground">({approval.creator.email})</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created: {new Date(approval.created_at).toLocaleString()}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-sm text-muted-foreground">
                        Status: <span className="font-medium capitalize">{approval.step.status}</span>
                      </div>
                      <Button onClick={() => handleView(approval)} size="sm">
                        View Details
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
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
