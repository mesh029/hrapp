'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'reactflow/dist/style.css';
import { MainLayout } from '@/components/layouts/main-layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Users, Settings, BarChart3, FileText, Calendar, Building2, Edit, Trash2, Plus } from 'lucide-react';
import { ReactFlowProvider } from 'reactflow';
import { useRouter } from 'next/navigation';
import { workflowService, WorkflowTemplate } from '@/ui/src/services/workflows';
import { useComponentVisibility } from '@/ui/src/hooks/use-component-visibility';
import { useDynamicUI } from '@/ui/src/hooks/use-dynamic-ui';

// Dynamically import all flow components to avoid SSR issues
const LeaveRequest3StepFlow = dynamic(
  () => import('../../components/workflows/LeaveRequest3StepFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const LeaveRequest1StepFlow = dynamic(
  () => import('../../components/workflows/LeaveRequest1StepFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const LeaveRequestRejectionFlow = dynamic(
  () => import('../../components/workflows/LeaveRequestRejectionFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const TimesheetApprovalFlow = dynamic(
  () => import('../../components/workflows/TimesheetApprovalFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const PeriodLockingFlow = dynamic(
  () => import('../../components/workflows/PeriodLockingFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const DelegationVacationFlow = dynamic(
  () => import('../../components/workflows/DelegationVacationFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const AdminDelegationFlow = dynamic(
  () => import('../../components/workflows/AdminDelegationFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const AuthorityResolutionFlow = dynamic(
  () => import('../../components/workflows/AuthorityResolutionFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const LeaveTimesheetIntegrationFlow = dynamic(
  () => import('../../components/workflows/LeaveTimesheetIntegrationFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const EndToEndFlow = dynamic(
  () => import('../../components/workflows/EndToEndFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const AuthenticationFlow = dynamic(
  () => import('../../components/workflows/AuthenticationFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const RoleCreationFlow = dynamic(
  () => import('../../components/workflows/RoleCreationFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const WorkflowTemplateFlow = dynamic(
  () => import('../../components/workflows/WorkflowTemplateFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const UserManagementFlow = dynamic(
  () => import('../../components/workflows/UserManagementFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const LocationManagementFlow = dynamic(
  () => import('../../components/workflows/LocationManagementFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

const EmployeeTypeCreationFlow = dynamic(
  () => import('../../components/workflows/EmployeeTypeCreationFlow'),
  { ssr: false, loading: () => <FlowLoader /> }
);

type FlowType =
  | 'leave-3step'
  | 'leave-1step'
  | 'leave-rejection'
  | 'timesheet-approval'
  | 'period-locking'
  | 'delegation-vacation'
  | 'admin-delegation'
  | 'authority-resolution'
  | 'leave-integration'
  | 'end-to-end'
  | 'authentication'
  | 'role-creation'
  | 'workflow-template'
  | 'user-management'
  | 'location-management'
  | 'employee-type-creation';

const flowCategories = {
  'Leave & Timesheet': [
    { id: 'leave-3step' as FlowType, name: 'Leave Request - 3-Step', description: 'Standard multi-level approval' },
    { id: 'leave-1step' as FlowType, name: 'Leave Request - 1-Step', description: 'Simplified single approver' },
    { id: 'leave-rejection' as FlowType, name: 'Leave Rejection Routing', description: 'Rejector chooses routing' },
    { id: 'timesheet-approval' as FlowType, name: 'Timesheet Approval', description: 'With leave integration' },
    { id: 'leave-integration' as FlowType, name: 'Leave Integration', description: 'Auto-add to timesheet' },
    { id: 'end-to-end' as FlowType, name: 'End-to-End Flow', description: 'Complete payroll flow' },
  ],
  'System Management': [
    { id: 'period-locking' as FlowType, name: 'Period Locking', description: 'Prevent new submissions' },
    { id: 'delegation-vacation' as FlowType, name: 'Delegation (Vacation)', description: 'When approver unavailable' },
    { id: 'admin-delegation' as FlowType, name: 'Admin Delegation', description: 'System admin delegates' },
    { id: 'authority-resolution' as FlowType, name: 'Authority Resolution', description: 'Multi-layer resolution' },
  ],
  'Configuration': [
    { id: 'authentication' as FlowType, name: 'Authentication', description: 'Login, refresh, logout' },
    { id: 'role-creation' as FlowType, name: 'Role Creation', description: 'Create roles & permissions' },
    { id: 'workflow-template' as FlowType, name: 'Workflow Template', description: 'Create workflow templates' },
    { id: 'user-management' as FlowType, name: 'User Management', description: 'Create users & assign roles' },
    { id: 'location-management' as FlowType, name: 'Location Management', description: 'Create locations & hierarchy' },
    { id: 'employee-type-creation' as FlowType, name: 'Employee Type Creation', description: 'Create & configure employee types' },
  ],
};

function FlowLoader() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="text-muted-foreground">Loading workflow...</p>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [selectedFlow, setSelectedFlow] = useState<FlowType>('leave-3step');
  const [activeTab, setActiveTab] = useState<'visualizations' | 'templates' | 'testing'>('visualizations');
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const { features, isLoading: uiLoading } = useDynamicUI();
  const { isVisible: canView } = useComponentVisibility('workflows.view', {
    fallbackPermission: 'workflows.templates.read',
    fallbackCheck: (features) => features.isAdmin,
  });

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [activeTab]);

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await workflowService.getTemplates({});
      if (response.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const renderFlow = () => {
    console.log('[WorkflowsPage] renderFlow called with:', selectedFlow);
    switch (selectedFlow) {
      case 'leave-3step':
        return <LeaveRequest3StepFlow />;
      case 'leave-1step':
        return <LeaveRequest1StepFlow />;
      case 'leave-rejection':
        return <LeaveRequestRejectionFlow />;
      case 'timesheet-approval':
        return <TimesheetApprovalFlow />;
      case 'period-locking':
        return <PeriodLockingFlow />;
      case 'delegation-vacation':
        return <DelegationVacationFlow />;
      case 'admin-delegation':
        return <AdminDelegationFlow />;
      case 'authority-resolution':
        return <AuthorityResolutionFlow />;
      case 'leave-integration':
        return <LeaveTimesheetIntegrationFlow />;
      case 'end-to-end':
        return <EndToEndFlow />;
      case 'authentication':
        return <AuthenticationFlow />;
      case 'role-creation':
        return <RoleCreationFlow />;
      case 'workflow-template':
        return <WorkflowTemplateFlow />;
      case 'user-management':
        return <UserManagementFlow />;
      case 'location-management':
        return <LocationManagementFlow />;
      case 'employee-type-creation':
        return <EmployeeTypeCreationFlow />;
      default:
        return <LeaveRequest3StepFlow />;
    }
  };

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
            You don't have permission to access workflows.
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
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Manage workflow templates, visualize flows, and test approval processes
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="testing">Testing & Simulation</TabsTrigger>
          </TabsList>

          {/* Visualizations Tab */}
          <TabsContent value="visualizations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Visualizations</CardTitle>
                <CardDescription>
                  Interactive workflow flowcharts showing system processes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Category Tabs */}
                <Tabs defaultValue="Leave & Timesheet" className="w-full">
                  <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-4">
                    {Object.keys(flowCategories).map((category) => (
                      <TabsTrigger key={category} value={category} className="text-sm">
                        {category}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {Object.entries(flowCategories).map(([category, flows]) => (
                    <TabsContent key={category} value={category} className="mt-4">
                      <div className="flex flex-wrap gap-3 mb-6">
                        {flows.map((flow) => (
                          <Button
                            key={flow.id}
                            variant={selectedFlow === flow.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedFlow(flow.id)}
                            className="h-auto py-3 px-4 text-left whitespace-normal min-w-[200px] transition-all hover:scale-105"
                            title={flow.description}
                          >
                            <div className="flex flex-col items-start gap-1 w-full">
                              <span className="font-medium text-sm leading-tight">{flow.name}</span>
                              <span className="text-xs text-muted-foreground font-normal leading-tight">
                                {flow.description}
                              </span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>

                {/* Flow Visualization Container */}
                <div className="relative w-full h-[600px] rounded-lg border bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden">
                  <ReactFlowProvider>
                    {renderFlow()}
                  </ReactFlowProvider>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Workflow Templates</h2>
                <p className="text-muted-foreground mt-1">
                  Manage approval workflows for leave requests and timesheets
                </p>
              </div>
              <Button onClick={() => router.push('/workflows/templates/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>

            {isLoadingTemplates ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">Loading templates...</div>
                </CardContent>
              </Card>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    No workflow templates found. Create your first template to get started.
                  </div>
                  <div className="text-center mt-4">
                    <Button onClick={() => router.push('/workflows/templates/new')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {templates.map((template) => (
                  <Card key={template.id} className="hover:bg-muted/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <Badge variant={template.status === 'active' ? 'default' : 'secondary'}>
                              {template.status}
                            </Badge>
                            <Badge variant="outline">
                              {template.resource_type === 'leave' ? (
                                <Calendar className="h-3 w-3 mr-1" />
                              ) : (
                                <FileText className="h-3 w-3 mr-1" />
                              )}
                              {template.resource_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {template.location && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                <span>{template.location.name}</span>
                              </div>
                            )}
                            <span>{template.steps.length} step{template.steps.length !== 1 ? 's' : ''}</span>
                            {template._count && (
                              <span>{template._count.instances} instance{template._count.instances !== 1 ? 's' : ''}</span>
                            )}
                            <span>v{template.version}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/workflows/templates/${template.id}`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Workflow Testing & Simulation</h2>
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

              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/workflows/test')}>
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
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
