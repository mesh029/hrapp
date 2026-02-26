'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import { 
  Shield, 
  Users, 
  Settings, 
  Eye,
  UserCog,
  Key,
  Building2,
  Calendar,
  Clock,
  BarChart,
  Workflow
  Clock,
} from 'lucide-react';

const COMPONENT_ID_VIEW = 'admin.dashboard.view';

export default function AdministrationPage() {
  const router = useRouter();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'system.admin',
    fallbackCheck: (features) => features.isAdmin,
  });

  const adminSections = [
    {
      id: 'component-visibility',
      title: 'Component Visibility',
      description: 'Configure which UI components are visible to different roles',
      icon: Eye,
      href: '/administration/component-visibility',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Create, edit, and manage users',
      icon: Users,
      href: '/users',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      id: 'roles',
      title: 'Roles & Permissions',
      description: 'Manage roles and permissions',
      icon: Key,
      href: '/administration/roles',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      id: 'locations',
      title: 'Locations',
      description: 'Manage organizational locations',
      icon: Building2,
      href: '/administration/locations',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      id: 'workflow-templates',
      title: 'Workflow Templates',
      description: 'Create and manage approval workflow templates',
      icon: Workflow,
      href: '/workflows/templates',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      id: 'workflow-assignments',
      title: 'Template Assignments',
      description: 'Assign workflow templates to locations for leaves and timesheets',
      icon: Workflow,
      href: '/administration/workflow-assignments',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'leave-accrual',
      title: 'Leave Accrual',
      description: 'Configure monthly/quarterly/annual leave earning rules',
      icon: Calendar,
      href: '/administration/leave-accrual',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      id: 'work-hours',
      title: 'Work Hours Configuration',
      description: 'Configure work hours per staff type and location',
      icon: Clock,
      href: '/administration/work-hours',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      id: 'configuration',
      title: 'Configuration',
      description: 'System configuration settings',
      icon: Settings,
      href: '/configuration',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
  ];

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-8 text-muted-foreground">
            You do not have permission to view this page
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
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8" />
            Administration
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage system settings, users, permissions, and configurations
          </p>
        </div>

        {/* Admin Sections Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(section.href)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center mb-2`}>
                    <Icon className={`h-6 w-6 ${section.color}`} />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(section.href);
                    }}
                  >
                    Manage
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground mt-1">Active users in system</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Component Configs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground mt-1">Visibility configurations</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground mt-1">System roles</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
