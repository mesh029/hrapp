'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Clock, CheckCircle } from 'lucide-react';
import { dashboardService } from '@/ui/src/services/dashboard';
import { usersService } from '@/ui/src/services/users';
import { locationsService } from '@/ui/src/services/locations';
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
  const { isVisible: canViewMyTimesheetsAction } = useComponentVisibility('dashboard.actions.view-my-timesheets', {
    fallbackCheck: (f) => f.canCreateTimesheet || f.canViewAllTimesheets || f.canApproveTimesheet,
  });
  const { isVisible: canViewMyLeaveAction } = useComponentVisibility('dashboard.actions.view-my-leave', {
    fallbackCheck: (f) => f.canCreateLeave || f.canViewOwnLeave || f.canApproveLeave,
  });
  const { isVisible: canViewUsersQuickLink } = useComponentVisibility('dashboard.quick-links.manage-users', {
    fallbackCheck: (f) => f.canViewAllUsers,
  });
  const { isVisible: canViewLeaveQuickLink } = useComponentVisibility('dashboard.quick-links.leave', {
    fallbackCheck: (f) => f.canCreateLeave || f.canViewOwnLeave || f.canApproveLeave || f.canViewAllLeave,
  });
  const { isVisible: canViewTimesheetsQuickLink } = useComponentVisibility('dashboard.quick-links.timesheets', {
    fallbackCheck: (f) => f.canCreateTimesheet || f.canViewAllTimesheets || f.canApproveTimesheet,
  });
  const { isVisible: canViewReportsQuickLink } = useComponentVisibility('dashboard.quick-links.reports', {
    fallbackCheck: (f) => f.canViewReports,
  });
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingLeaveRequests: 0,
    pendingLeaveDays: 0,
    pendingTimesheets: 0,
    pendingApprovals: 0,
    approvedLeaveDays: 0,
    declinedLeaveDays: 0,
    totalLeaveDays: 0,
    approvedTimesheets: 0,
    declinedTimesheets: 0,
    totalTimesheets: 0,
    totalAllocatedLeaveDays: 0,
    totalUsedLeaveDays: 0,
    totalAvailableLeaveDays: 0,
    expiringContracts: 0,
    expiredContracts: 0,
    utilizedDaysForExpiredUsers: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>('all');
  const [userData, setUserData] = React.useState<any>(null);
  const canFilterByLocation = features.isAdmin || features.canViewAllUsers || features.canApproveLeave || features.canApproveTimesheet;

  React.useEffect(() => {
    if (user?.id && !uiLoading) {
      loadDashboardData();
    }
  }, [user?.id, uiLoading, selectedLocationId]);

  React.useEffect(() => {
    if (!uiLoading && canFilterByLocation) {
      loadLocations();
    }
  }, [uiLoading, canFilterByLocation]);

  const loadLocations = async () => {
    try {
      const res = await locationsService.getLocations({ status: 'active' });
      const rows =
        (res as any)?.data?.flat ||
        (res as any)?.data?.locations ||
        (res as any)?.data?.tree ||
        [];
      setLocations(rows);
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const userDetails = user?.id ? await usersService.getUser(user.id).catch(() => null) : null;
      const loadedUserData = (userDetails && (userDetails as any).success) ? (userDetails as any).data : null;
      setUserData(loadedUserData);
      const scopedLocationId = loadedUserData?.primary_location_id || loadedUserData?.location_id;
      const isApprover = features.canApproveLeave || features.canApproveTimesheet;
      const isManagerScoped = !features.isAdmin && isApprover && !features.canViewAllUsers;

      const dashboardFilters: { location_id?: string; user_id?: string } = {};
      if (selectedLocationId !== 'all' && canFilterByLocation) {
        dashboardFilters.location_id = selectedLocationId;
      } else if (!features.isAdmin) {
        if (scopedLocationId) dashboardFilters.location_id = scopedLocationId;
      }
      if (!features.isAdmin) {
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
      const pendingLeaveCount = data?.leave?.utilization?.pendingRequests || 0;
      const pendingTimesheetsCount = data?.timesheets?.pendingTimesheets || data?.timesheets?.summary?.pendingTimesheets || 0;
      const pendingApprovalsCount = data?.approvals?.summary?.totalPending || data?.approvals?.total || 0;

      setStats((prev) => ({
        ...prev,
        totalUsers: usersStats.totalUsers,
        activeUsers: usersStats.activeUsers,
        pendingLeaveRequests: pendingLeaveCount,
        pendingLeaveDays: Math.ceil(data?.leave?.utilization?.pendingDays || 0),
        pendingTimesheets: pendingTimesheetsCount,
        pendingApprovals: pendingApprovalsCount,
        approvedLeaveDays: Math.ceil(data?.leave?.utilization?.approvedDays || 0),
        declinedLeaveDays: Math.ceil(data?.leave?.utilization?.declinedDays || 0),
        totalLeaveDays: Math.ceil(data?.leave?.utilization?.totalDays || 0),
        approvedTimesheets: data?.timesheets?.approvedTimesheets || 0,
        declinedTimesheets: data?.timesheets?.declinedTimesheets || 0,
        totalTimesheets: data?.timesheets?.totalTimesheets || 0,
        totalAllocatedLeaveDays: Math.ceil(data?.leave?.balances?.totalAllocated || 0),
        totalUsedLeaveDays: Math.ceil(data?.leave?.balances?.totalUsed || 0),
        totalAvailableLeaveDays: Math.ceil(data?.leave?.balances?.totalAvailable || 0),
        expiringContracts: data?.contracts?.expiringIn30Days || 0,
        expiredContracts: data?.contracts?.expiredContracts || 0,
        utilizedDaysForExpiredUsers: Math.ceil(data?.contracts?.utilizedDaysForExpiredUsers || 0),
      }));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayStat = (value: number) => value;
  const percent = (part: number, total: number) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

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
          {canFilterByLocation && (
            <div className="min-w-[220px]">
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              >
                <option value="all">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              {canViewMyLeaveAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/leave/requests')}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  View My Leave Requests
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
              {canViewMyTimesheetsAction && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/timesheets')}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  View My Timesheets
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
              {!features.isAdmin && !features.canViewAllUsers && !features.canApproveLeave && userData && (
                <>
                  {userData.primary_location && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Location</span>
                      <span className="text-sm font-medium">{userData.primary_location.name}</span>
                    </div>
                  )}
                  {stats.totalAvailableLeaveDays > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Available Leave Days</span>
                      <span className="text-sm font-medium">{displayStat(stats.totalAvailableLeaveDays)}</span>
                    </div>
                  )}
                  {stats.totalAllocatedLeaveDays > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Allocated</span>
                      <span className="text-sm font-medium">{displayStat(stats.totalAllocatedLeaveDays)}</span>
                    </div>
                  )}
                  {stats.totalUsedLeaveDays > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Used Leave Days</span>
                      <span className="text-sm font-medium">{displayStat(stats.totalUsedLeaveDays)}</span>
                    </div>
                  )}
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
              {canViewUsersQuickLink && (
                <Button 
                  className="w-full justify-start" 
                  variant="ghost"
                  onClick={() => router.push('/users')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Button>
              )}
              {canViewLeaveQuickLink && (
                <Button 
                  className="w-full justify-start" 
                  variant="ghost"
                  onClick={() => router.push('/leave/requests')}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Leave Requests
                </Button>
              )}
              {canViewTimesheetsQuickLink && (
                <Button 
                  className="w-full justify-start" 
                  variant="ghost"
                  onClick={() => router.push('/timesheets')}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Timesheets
                </Button>
              )}
              {canViewReportsQuickLink && (
                <Button 
                  className="w-full justify-start" 
                  variant="ghost"
                  onClick={() => router.push('/reports')}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Reports
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {(features.isAdmin || features.canApproveLeave || features.canViewReports) && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Leave Analytics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Approved days</span>
                  <span className="font-medium">{displayStat(stats.approvedLeaveDays)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${percent(stats.approvedLeaveDays, stats.totalLeaveDays)}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending days</span>
                  <span className="font-medium">{displayStat(stats.pendingLeaveDays)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${percent(stats.pendingLeaveDays, stats.totalLeaveDays)}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Declined days</span>
                  <span className="font-medium">{displayStat(stats.declinedLeaveDays)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-red-500" style={{ width: `${percent(stats.declinedLeaveDays, stats.totalLeaveDays)}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timesheet Analytics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium">{displayStat(stats.approvedTimesheets)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${percent(stats.approvedTimesheets, stats.totalTimesheets)}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium">{displayStat(stats.pendingTimesheets)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: `${percent(stats.pendingTimesheets, stats.totalTimesheets)}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Declined</span>
                  <span className="font-medium">{displayStat(stats.declinedTimesheets)}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${percent(stats.declinedTimesheets, stats.totalTimesheets)}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contract & Balance Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contracts expiring in 30 days</span>
                  <span className="font-medium">{displayStat(stats.expiringContracts)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expired contracts</span>
                  <span className="font-medium">{displayStat(stats.expiredContracts)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Allocated leave days</span>
                  <span className="font-medium">{displayStat(stats.totalAllocatedLeaveDays)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Used leave days</span>
                  <span className="font-medium">{displayStat(stats.totalUsedLeaveDays)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Available leave days</span>
                  <span className="font-medium">{displayStat(stats.totalAvailableLeaveDays)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utilized days (expired contracts)</span>
                  <span className="font-medium">{displayStat(stats.utilizedDaysForExpiredUsers)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
