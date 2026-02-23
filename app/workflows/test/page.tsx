'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Play, Users, Settings, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';
import Link from 'next/link';

const COMPONENT_ID_VIEW = 'workflows.test.view';

export default function WorkflowTestPage() {
  const router = useRouter();
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility(COMPONENT_ID_VIEW, {
    fallbackPermission: 'workflows.templates.read',
    fallbackCheck: (features) => features.isAdmin,
  });

  if (uiLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  if (!canView) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center text-muted-foreground">
            You don't have permission to access workflow testing.
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Workflow Testing & Simulation</h1>
          <p className="text-muted-foreground mt-1">
            Test workflow templates with real users and simulate approval flows
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/workflows/test/scenarios')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Test Scenarios</CardTitle>
              </div>
              <CardDescription>
                Create and manage test scenarios with multiple users
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/workflows/test/simulator')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                <CardTitle>Workflow Simulator</CardTitle>
              </div>
              <CardDescription>
                Simulate workflow execution step-by-step
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/workflows/test/results')}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <CardTitle>Test Results</CardTitle>
              </div>
              <CardDescription>
                View simulation results and analytics
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">1. Create Test Scenario</h3>
              <p className="text-sm text-muted-foreground">
                Set up test users (employee + approvers), assign managers, roles, and locations.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">2. Select Workflow Template</h3>
              <p className="text-sm text-muted-foreground">
                Choose a workflow template to test with your scenario.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">3. Run Simulation</h3>
              <p className="text-sm text-muted-foreground">
                Simulate the workflow execution and see approver resolution at each step.
              </p>
            </div>
            <div className="pt-4">
              <Button onClick={() => router.push('/workflows/test/scenarios')}>
                <Users className="h-4 w-4 mr-2" />
                Create Test Scenario
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
