'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Clock, CheckCircle } from 'lucide-react';
import { dashboardService } from '@/ui/src/services/dashboard';
import { usersService } from '@/ui/src/services/users';
import { useRouter } from 'next/navigation';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { features, isLoading: uiLoading } = useDynamicUI();

  const { isVisible: canViewTotalUsersCard } = useComponentVisibility('dashboard.stats.total-users', {
    fallbackCheck: (f) => f.isAdmin || f.canViewAllUsers || f.canApproveLeave,
  });
  const { isVisible: canViewPendingLeaveCard } = useComponentVisibility('dashboard.stats.pending-leave', {
    defaultVisible: true,
  });
  const { isVisible: canViewPendingTimesheetsCard } = useComponentVisibility('dashboard.stats.pending-timesheets', {
    defaultVisible: true,
  });
  const { isVisible: canViewPendingApprovalsCard } = useComponentVisibility('dashboard.stats.pending-approvals', {
    fallbackCheck: (f) => f.isAdmin || f.canApproveLeave || f.canApproveTimesheet,
  });
  const { isVisible: canViewQuickLinks } = useComponentVisibility('dashboard.quick-links', {
    defaultVisible: true,
  });
  const { isVisible: canCreateUserAction } = useComponentVisibility('dashboard.actions.create-user', {
    fallbackCheck: (f) => f.canCreateUsers,
  });
  const { isVisible: canManageUsersAction } = useComponentVisibility('dashboard.actions.manage-users', {
    fallbackCheck: (f) => f.canManageUsers,
  });
  const { isVisible: canCreateLeaveAction } = useComponentVisibility('dashboard.actions.create-leave', {
    fallbackCheck: (f) => f.canCreateLeave,
  });
  const { isVisible: canApproveLeaveAction } = useComponentVisibility('dashboard.actions.approve-leave', {
    fallbackCheck: (f) => f.canApproveLeave,
  });
  const { isVisible: canCreateTimesheetAction } = useComponentVisibility('dashboard.actions.create-timesheet', {
    fallbackCheck: (f) => f.canCreateTimesheet,
  });
  const { isVisible: canApproveTimesheetAction } = useComponentVisibility('dashboard.actions.approve-timesheets', {
    fallbackCheck: (f) => f.canApproveTimesheet,
  });
  const { isVisible: canViewReportsAction } = useComponentVisibility('dashboard.actions.view-reports', {
    fallbackCheck: (f) => f.canViewReports,
  });
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingLeaveRequests: 0,
    pendingTimesheets: 0,
    pendingApprovals: 0,
    directReports: 0,
    locationEmployees: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (user?.id && !uiLoading) {
      loadDashboardData();
    }
  }, [user?.id, uiLoading]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const userDetails = user?.id ? await usersService.getUser(user.id).catch(() => null) : null;
      const userData = (userDetails && (userDetails as any).success) ? (userDetails as any).data : null;
      const scopedLocationId = userData?.primary_location_id || userData?.location_id;
      const isApprover = features.canApproveLeave || features.canApproveTimesheet;
      const isManagerScoped = !features.isAdmin && isApprover && !features.canViewAllUsers;

      const dashboardFilters: { location_id?: string; user_id?: string } = {};
      if (!features.isAdmin) {
        if (scopedLocationId) dashboardFilters.location_id = scopedLocationId;
        if (!isApprover && user?.id) dashboardFilters.user_id = user.id;
      }

      const usersStatsPromise = (features.isAdmin || features.canViewAllUsers || features.canApproveLeave)
        ? (async () => {
            if (isManagerScoped && user?.id) {
              const teamRes = await usersService.getUsers({
                limit: 1000,
                location_id: scopedLocationId,
              });
              const users = (teamRes as any)?.data?.users || [];
              const directReports = Array.isArray(users)
                ? users.filter((u: any) => u.manager_id === user.id)
                : [];
              return {
                totalUsers: directReports.length,
                activeUsers: directReports.filter((u: any) => u.status === 'active').length,
              };
            }

            const [totalRes, activeRes] = await Promise.all([
              usersService.getUsers({ limit: 1, location_id: scopedLocationId }),
              usersService.getUsers({ limit: 1, status: 'active', location_id: scopedLocationId }),
            ]);
            return {
              totalUsers: (totalRes as any)?.data?.pagination?.total || 0,
              activeUsers: (activeRes as any)?.data?.pagination?.total || 0,
            };
          })()
        : Promise.resolve({ totalUsers: 0, activeUsers: 0 });

      const dashboardPromise = dashboardService.getDashboardStats(dashboardFilters);
      const [usersStats, dashboardResponse] = await Promise.all([usersStatsPromise, dashboardPromise]);

      const data = (dashboardResponse as any)?.success ? (dashboardResponse as any).data : null;
      const pendingLeaveCount = data?.leave?.utilization?.summary?.pendingDays
        ? Math.ceil(data.leave.utilization.summary.pendingDays)
        : (data?.leave?.utilization?.pendingDays ? Math.ceil(data.leave.utilization.pendingDays) : 0);
      const pendingTimesheetsCount = data?.timesheets?.pendingTimesheets || data?.timesheets?.summary?.pendingTimesheets || 0;
      const pendingApprovalsCount = data?.approvals?.summary?.totalPending || data?.approvals?.total || 0;

      setStats((prev) => ({
        ...prev,
        totalUsers: usersStats.totalUsers,
        activeUsers: usersStats.activeUsers,
        pendingLeaveRequests: pendingLeaveCount,
        pendingTimesheets: pendingTimesheetsCount,
        pendingApprovals: pendingApprovalsCount,
      }));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayStat = (value: number) => {
    if (!features.isAdmin && value === 0) return '--';
    return value;
  };

  const pendingItemsTotal =
    stats.pendingLeaveRequests +
    stats.pendingTimesheets +
    (features.canApproveLeave || features.canApproveTimesheet ? stats.pendingApprovals : 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your HR system</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {canViewTotalUsersCard && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : displayStat(stats.totalUsers)}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? '...' : `${displayStat(stats.activeUsers)} active users`}
              </p>
            </CardContent>
          </Card>
          )}

          {canViewPendingLeaveCard && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Leave Requests</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : displayStat(stats.pendingLeaveRequests)}</div>
              <p className="text-xs text-muted-foreground">
                Leave requests awaiting approval
              </p>
            </CardContent>
          </Card>
          )}

          {canViewPendingTimesheetsCard && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Timesheets</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : displayStat(stats.pendingTimesheets)}</div>
              <p className="text-xs text-muted-foreground">
                Timesheets awaiting submission or approval
              </p>
            </CardContent>
          </Card>
          )}

          {/* Pending Approvals - Only show for Admin, HR Manager, Program Officer, Manager */}
          {(features.isAdmin || features.canApproveLeave || features.canApproveTimesheet) && canViewPendingApprovalsCard && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? '...' : displayStat(stats.pendingApprovals)}</div>
                <p className="text-xs text-muted-foreground">
                  Items requiring your approval
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {canViewQuickLinks && (
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* User Management Actions */}
              {features.canCreateUsers && canCreateUserAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/users/new')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Create New User
                </Button>
              )}
              {features.canManageUsers && canManageUsersAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/users')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Button>
              )}

              {/* Leave Actions */}
              {features.canCreateLeave && canCreateLeaveAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/leave/requests/new')}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Create Leave Request
                </Button>
              )}
              {features.canApproveLeave && canApproveLeaveAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/workflows/approvals')}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Leave Requests
                </Button>
              )}

              {/* Timesheet Actions */}
              {features.canCreateTimesheet && canCreateTimesheetAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/timesheets/new')}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Create Timesheet
                </Button>
              )}
              {features.canApproveTimesheet && canApproveTimesheetAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/workflows/approvals')}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Timesheets
                </Button>
              )}

              {/* Reports */}
              {features.canViewReports && canViewReportsAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/reports')}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  View Reports
                </Button>
              )}
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {features.isAdmin ? 'System Overview' : features.canViewAllUsers ? 'Location Overview' : features.canApproveLeave ? 'Team Overview' : 'My Overview'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(features.isAdmin || features.canViewAllUsers || features.canApproveLeave) && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active {features.isAdmin ? 'Users' : features.canViewAllUsers ? 'Users' : 'Members'}</span>
                    <span className="text-sm font-medium">{displayStat(stats.activeUsers)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total {features.isAdmin ? 'Users' : features.canViewAllUsers ? 'Users' : 'Members'}</span>
                    <span className="text-sm font-medium">{displayStat(stats.totalUsers)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending Items</span>
                <span className="text-sm font-medium">
                  {displayStat(pendingItemsTotal)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full justify-start" 
                variant="ghost"
                onClick={() => router.push('/users')}
              >
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="ghost"
                onClick={() => router.push('/leave/requests')}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Leave Requests
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="ghost"
                onClick={() => router.push('/timesheets')}
              >
                <Clock className="mr-2 h-4 w-4" />
                Timesheets
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="ghost"
                onClick={() => router.push('/reports')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Reports
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
