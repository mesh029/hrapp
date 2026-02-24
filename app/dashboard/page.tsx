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

export default function DashboardPage() {
  const router = useRouter();
  const { features, isLoading: uiLoading } = useDynamicUI();
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
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load users count
      try {
        const usersResponse = await usersService.getUsers({ limit: 1 });
        if (usersResponse.success && usersResponse.data) {
          const usersData = usersResponse.data as any;
          const totalUsers = usersData.pagination?.total || usersData.users?.length || 0;
          
          // Get active users count
          const activeUsersResponse = await usersService.getUsers({ limit: 1000, status: 'active' });
          const activeUsersData = activeUsersResponse.data as any;
          const activeUsers = activeUsersData.pagination?.total || 
            (Array.isArray(activeUsersData.users) ? 
              activeUsersData.users.filter((u: any) => u.status === 'active').length : 0);
          
          setStats(prev => ({
            ...prev,
            totalUsers,
            activeUsers,
          }));
        }
      } catch (error) {
        console.error('Failed to load users:', error);
      }

      // Load dashboard stats
      try {
        const dashboardResponse = await dashboardService.getDashboardStats();
        if (dashboardResponse.success && dashboardResponse.data) {
          const data = dashboardResponse.data as any;
          
          // Extract counts from nested structure
          // Leave requests: count pending requests (UnderReview or Draft status)
          const pendingLeaveCount = data.leave?.utilization?.summary?.pendingDays ? 
            Math.ceil(data.leave.utilization.summary.pendingDays) : 
            (data.leave?.utilization?.pendingDays ? 
              Math.ceil(data.leave.utilization.pendingDays) : 0);
          
          // Timesheets: count from timesheets summary
          const pendingTimesheetsCount = data.timesheets?.pendingTimesheets || 
                                        data.timesheets?.summary?.pendingTimesheets || 0;
          
          // Approvals: count from approvals summary
          const pendingApprovalsCount = data.approvals?.summary?.totalPending || 
                                       data.approvals?.total || 0;
          
          setStats(prev => ({
            ...prev,
            pendingLeaveRequests: pendingLeaveCount,
            pendingTimesheets: pendingTimesheetsCount,
            pendingApprovals: pendingApprovalsCount,
          }));
        }
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        // Try to get pending approvals separately as fallback
        try {
          const approvalsResponse = await dashboardService.getPendingApprovals();
          if (approvalsResponse.success && approvalsResponse.data) {
            setStats(prev => ({
              ...prev,
              pendingApprovals: (approvalsResponse.data as any).summary?.totalPending || 
                               (approvalsResponse.data as any).total || 0,
            }));
          }
        } catch (approvalsError) {
          console.error('Failed to load pending approvals:', approvalsError);
        }
      }

      // Load employee counts (direct reports and location-based)
      if (user?.id) {
        try {
          // Get user details first
          const userDetails = await usersService.getUser(user.id);
          if (userDetails.success && userDetails.data) {
            const userData = userDetails.data as any;
            const locationId = userData.primary_location_id || userData.location_id;

            // Get all active users and filter client-side
            const allUsersRes = await usersService.getUsers({ 
              limit: 1000,
              status: 'active',
            });
            const allUsersData = allUsersRes.data as any;
            const allUsers = Array.isArray(allUsersData.users) 
              ? allUsersData.users 
              : (allUsersData.data?.users || []);

            // Count direct reports
            const directReports = allUsers.filter((u: any) => 
              u.manager_id === user.id && u.status === 'active'
            ).length;

            // Count location-based employees
            let locationEmployees = 0;
            if (locationId) {
              locationEmployees = allUsers.filter((u: any) => 
                u.status === 'active' && 
                (u.primary_location_id === locationId || u.location_id === locationId)
              ).length;
            }

            setStats(prev => ({
              ...prev,
              directReports,
              locationEmployees,
            }));
          }
        } catch (error) {
          console.error('Failed to load employee counts:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeUsers} active users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Leave Requests</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.pendingLeaveRequests}</div>
              <p className="text-xs text-muted-foreground">
                Leave requests awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Timesheets</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.pendingTimesheets}</div>
              <p className="text-xs text-muted-foreground">
                Timesheets awaiting submission or approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? '...' : stats.pendingApprovals}</div>
              <p className="text-xs text-muted-foreground">
                Items requiring your approval
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* User Management Actions */}
              {features.canCreateUsers && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/users/new')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Create New User
                </Button>
              )}
              {features.canManageUsers && (
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
              {features.canCreateLeave && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/leave/requests/new')}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Create Leave Request
                </Button>
              )}
              {features.canApproveLeave && (
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
              {features.canCreateTimesheet && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => router.push('/timesheets/new')}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Create Timesheet
                </Button>
              )}
              {features.canApproveTimesheet && (
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
              {features.canViewReports && (
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

          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Users</span>
                <span className="text-sm font-medium">{stats.activeUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Users</span>
                <span className="text-sm font-medium">{stats.totalUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending Items</span>
                <span className="text-sm font-medium">
                  {stats.pendingLeaveRequests + stats.pendingTimesheets + stats.pendingApprovals}
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
