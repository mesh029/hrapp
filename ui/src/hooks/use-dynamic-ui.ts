'use client';

import * as React from 'react';
import { useAuth } from '../contexts/auth-context';
import { usePermissions } from './use-permissions';

/**
 * Dynamic UI Hook
 * Determines what UI elements to show based on user permissions
 */
export function useDynamicUI() {
  const { user } = useAuth();
  const { hasPermission, hasAnyPermission, isLoading: permissionsLoading } = usePermissions();

  // Navigation visibility based on permissions
  const navigationItems = React.useMemo(() => {
    const items: Array<{
      href: string;
      label: string;
      icon: any;
      requiredPermissions?: string[];
      anyPermission?: string[]; // Show if user has ANY of these
    }> = [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: null, // Will be set by component
        requiredPermissions: [], // Everyone can see dashboard
      },
      {
        href: '/users',
        label: 'Users',
        icon: null,
        requiredPermissions: ['users.read'],
        anyPermission: ['system.admin'],
      },
      {
        href: '/leave',
        label: 'Leave',
        icon: null,
        requiredPermissions: [],
        anyPermission: ['leave.read', 'leave.create', 'leave.submit', 'leave.approve', 'system.admin'],
      },
      {
        href: '/timesheets',
        label: 'Timesheets',
        icon: null,
        requiredPermissions: [],
        anyPermission: ['timesheet.read', 'timesheet.create', 'timesheet.submit', 'timesheet.approve', 'system.admin'],
      },
      {
        href: '/workflows',
        label: 'Workflows',
        icon: null,
        requiredPermissions: [],
        anyPermission: ['workflows.read', 'workflows.manage', 'system.admin'],
      },
      {
        href: '/approvals/pending',
        label: 'Pending Approvals',
        icon: null,
        requiredPermissions: [],
        anyPermission: ['leave.approve', 'timesheet.approve', 'workflows.read', 'system.admin'],
      },
      {
        href: '/reports',
        label: 'Reports',
        icon: null,
        requiredPermissions: [],
        anyPermission: ['reports.read', 'system.admin'],
      },
      {
        href: '/administration',
        label: 'Administration',
        icon: null,
        requiredPermissions: [],
        anyPermission: ['system.admin', 'roles.manage', 'permissions.manage'],
      },
      {
        href: '/profile',
        label: 'Profile',
        icon: null,
        requiredPermissions: [], // Everyone can see their profile
      },
      {
        href: '/employees/overview',
        label: 'My Overview',
        icon: null,
        requiredPermissions: [], // Everyone can see their overview
      },
    ];

    return items.filter(item => {
      // If no permissions required, show to everyone
      if (!item.requiredPermissions?.length && !item.anyPermission?.length) {
        return true;
      }

      // Check if user has all required permissions
      if (item.requiredPermissions?.length) {
        const hasAll = item.requiredPermissions.every(perm => hasPermission(perm));
        if (!hasAll) return false;
      }

      // Check if user has any of the optional permissions
      if (item.anyPermission?.length) {
        return hasAnyPermission(item.anyPermission);
      }

      return true;
    });
  }, [hasPermission, hasAnyPermission]);

  // Feature flags based on permissions
  const features = React.useMemo(() => {
    const isAdmin = hasPermission('system.admin');
    
    return {
      canCreateUsers: hasPermission('users.create') || isAdmin,
      canManageUsers: hasPermission('users.update') || isAdmin,
      canViewAllUsers: hasPermission('users.read') || isAdmin,
      // Admins can view and manage leave, but NOT create their own leave requests
      // Leave creation is for employees only
      canCreateLeave: (hasPermission('leave.create') || hasPermission('leave.submit')) && !isAdmin,
      canSubmitLeave: hasPermission('leave.submit') || hasPermission('leave.create') || isAdmin,
      canApproveLeave: hasPermission('leave.approve') || isAdmin,
      canViewAllLeave: hasPermission('leave.read') || isAdmin,
      canViewOwnLeave: hasPermission('leave.create') || hasPermission('leave.submit') || hasPermission('leave.read') || isAdmin,
      // Admins typically don't create their own timesheets either
      canCreateTimesheet: (hasPermission('timesheet.create') || hasPermission('timesheet.submit')) && !isAdmin,
      canSubmitTimesheet: hasPermission('timesheet.submit') || hasPermission('timesheet.create') || isAdmin,
      canApproveTimesheet: hasPermission('timesheet.approve') || isAdmin,
      canViewAllTimesheets: hasPermission('timesheet.read') || isAdmin,
      canManageWorkflows: hasPermission('workflows.manage') || isAdmin,
      canViewReports: hasPermission('reports.read') || isAdmin,
      canManageConfig: hasPermission('config.manage') || isAdmin,
      canManageRoles: hasPermission('roles.manage') || isAdmin,
      canManagePermissions: hasPermission('permissions.manage') || isAdmin,
      isAdmin,
    };
  }, [hasPermission]);

  return {
    navigationItems,
    features,
    isLoading: permissionsLoading,
  };
}
