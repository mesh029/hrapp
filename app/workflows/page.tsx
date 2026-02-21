'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ReactFlowProvider } from 'reactflow';

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
  const [selectedFlow, setSelectedFlow] = useState<FlowType>('leave-3step');

  useEffect(() => {
    console.log('[WorkflowsPage] Component mounted');
    console.log('[WorkflowsPage] Initial selectedFlow:', selectedFlow);
  }, []);

  useEffect(() => {
    console.log('[WorkflowsPage] selectedFlow changed to:', selectedFlow);
  }, [selectedFlow]);

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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">PATH HR Workflows</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Interactive workflow visualizations
              </p>
            </div>
          </div>

          {/* Tabs for Categories */}
          <Tabs defaultValue="Leave & Timesheet" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              {Object.keys(flowCategories).map((category) => (
                <TabsTrigger key={category} value={category} className="text-sm">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(flowCategories).map(([category, flows]) => (
              <TabsContent key={category} value={category} className="mt-4">
                <div className="flex flex-wrap gap-3">
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
        </div>
      </div>

      {/* Main Content - Workflow Container */}
      <div className="flex-1 relative min-w-0 overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        <Card className="absolute inset-4 p-0 overflow-hidden bg-white">
          <div className="w-full h-full relative">
            <ReactFlowProvider>
              {renderFlow()}
            </ReactFlowProvider>
          </div>
        </Card>
      </div>
    </div>
  );
}
