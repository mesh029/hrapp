'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, CheckCircle, XCircle, Clock, User, Shield, Mail, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { workflowService, WorkflowTemplate } from '@/ui/src/services/workflows';
import { api } from '@/ui/src/services/api';

interface SimulationStep {
  step_order: number;
  required_permission: string;
  approver_strategy?: string;
  status: 'pending' | 'in_progress' | 'approved' | 'declined';
  approvers: Array<{
    id: string;
    name: string;
    email: string;
    source: 'manager' | 'role' | 'permission';
    role?: string | null;
    notified: boolean;
    acted: boolean;
    acted_at?: string;
    comment?: string;
  }>;
  resolved_at?: string;
  diagnostic_info?: string[]; // Diagnostic messages explaining why no approvers were found
}

interface SimulationState {
  simulation_id?: string;
  resource_id?: string;
  resource_type?: 'leave' | 'timesheet';
  template: WorkflowTemplate | null;
  current_step: number;
  status: 'not_started' | 'running' | 'completed' | 'declined';
  steps: SimulationStep[];
  employee: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function WorkflowSimulatorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get('scenario');

  const [templates, setTemplates] = React.useState<WorkflowTemplate[]>([]);
  const [employees, setEmployees] = React.useState<Array<{ id: string; name: string; email: string; staff_type?: { name: string } }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>('');
  const [simulation, setSimulation] = React.useState<SimulationState | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [isAutoRunning, setIsAutoRunning] = React.useState(false);
  const [processingStep, setProcessingStep] = React.useState<{ stepOrder: number; approverId: string } | null>(null);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [templatesRes, employeesRes] = await Promise.all([
        workflowService.getTemplates({ status: 'active' }),
        api.get('/api/users?limit=100&status=active'),
      ]);

      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data.templates || []);
      }

      if (employeesRes.success && employeesRes.data) {
        const usersData = employeesRes.data as any;
        const users = usersData.users || usersData.data || [];
        
        // Filter to only employees who can submit timesheets/leave requests
        // These are typically regular employees, HRH employees, temporary employees, etc.
        // Must have a staff_type (regular, hrh, temporary, etc.) - admins might not have one
        const eligibleEmployees = users
          .filter((u: any) => {
            // Must be active and not deleted
            if (u.status !== 'active' || u.deleted_at) return false;
            
            // Must have a staff_type_id - this indicates they are an employee who can submit requests
            // Users without staff_type are typically system users/admins who shouldn't submit their own requests
            if (!u.staff_type_id || !u.staff_type) return false;
            
            return true;
          })
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            staff_type: u.staff_type ? { name: u.staff_type.name } : undefined,
          }));
        
        setEmployees(eligibleEmployees);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    if (!selectedTemplateId) {
      alert('Please select a workflow template');
      return;
    }

    if (!selectedEmployeeId) {
      alert('Please select an employee');
      return;
    }

    try {
      setIsSimulating(true);
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) {
        alert('Template not found');
        return;
      }

      const employee = employees.find(e => e.id === selectedEmployeeId);
      if (!employee) {
        alert('Employee not found');
        return;
      }

      // Confirm before creating real data
      const confirmMessage = `This will create a REAL ${template.resource_type} request for ${employee.name} and submit it through the workflow. Continue?`;
      if (!confirm(confirmMessage)) {
        setIsSimulating(false);
        return;
      }

      // Call simulation API - creates REAL leave/timesheet
      const response = await api.post('/api/workflows/test/simulate', {
        template_id: selectedTemplateId,
        employee_id: selectedEmployeeId,
        scenario_id: scenarioId || undefined,
      });

      if (response.success && response.data) {
        setSimulation(response.data);
      } else {
        const errorMsg = response.message || response.error || 'Failed to start simulation';
        console.error('Simulation failed:', response);
        alert(`Failed to start simulation: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Failed to simulate:', error);
      const errorMsg = error.message || error.response?.data?.message || error.response?.data?.error || 'Failed to start simulation';
      alert(`Failed to start simulation: ${errorMsg}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApproveStep = async (stepOrder: number, approverId: string) => {
    if (!simulation || !simulation.simulation_id) return;
    if (processingStep) return; // Prevent double-clicks

    try {
      setProcessingStep({ stepOrder, approverId });
      const response = await api.post('/api/workflows/test/simulate/approve', {
        simulation_id: simulation.simulation_id,
        step_order: stepOrder,
        approver_id: approverId,
        comment: 'Simulation: Approved via UI',
      });

      if (response.success && response.data) {
        setSimulation(response.data);
      } else {
        const errorMsg = response.error || response.message || 'Failed to approve step';
        console.error('Failed to approve step - API response:', response);
        alert(errorMsg);
      }
    } catch (error: any) {
      console.error('Failed to approve step - Exception:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        data: error.response?.data,
      });
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to approve step';
      alert(errorMsg);
    } finally {
      setProcessingStep(null);
    }
  };

  const handleDeclineStep = async (stepOrder: number, approverId: string) => {
    if (!simulation || !simulation.simulation_id) return;
    if (processingStep) return; // Prevent double-clicks

    const comment = prompt('Enter decline reason (optional):');
    if (comment === null) return; // User cancelled

    try {
      setProcessingStep({ stepOrder, approverId });
      const response = await api.post('/api/workflows/test/simulate/decline', {
        simulation_id: simulation.simulation_id,
        step_order: stepOrder,
        approver_id: approverId,
        comment: comment || 'Simulation: Declined via UI',
      });

      if (response.success && response.data) {
        setSimulation(response.data);
      } else {
        alert(response.error || 'Failed to decline step');
      }
    } catch (error: any) {
      console.error('Failed to decline step:', error);
      alert(error.message || 'Failed to decline step');
    } finally {
      setProcessingStep(null);
    }
  };

  const handleAutoRun = async () => {
    if (!simulation?.simulation_id) return;
    try {
      setIsAutoRunning(true);
      const response = await api.post('/api/workflows/test/simulate/auto-run', {
        simulation_id: simulation.simulation_id,
        max_steps: 50,
      });

      if (response.success && response.data) {
        setSimulation(response.data);
      } else {
        const errorMsg = response.message || response.error || 'Failed to auto-run simulation';
        console.error('Auto-run failed:', response);
        alert(`Auto-run failed: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Auto-run error:', error);
      alert(`Auto-run failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsAutoRunning(false);
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'declined':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'manager':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'role':
        return <Shield className="h-4 w-4 text-green-600" />;
      default:
        return <Mail className="h-4 w-4 text-purple-600" />;
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center">Loading...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/workflows/test')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Workflow Simulator</h1>
            <p className="text-muted-foreground mt-1">
              Simulate workflow execution step-by-step and see approver resolution
            </p>
          </div>
        </div>

        {!simulation ? (
          /* Simulation Setup */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Request & Start Simulation</CardTitle>
                <CardDescription>
                  Select an employee and workflow template. A real leave request or timesheet will be created and submitted through the workflow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">1. Select Employee *</label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an employee to create a request for" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.length === 0 ? (
                        <SelectItem value="__no_employees__" disabled>
                          No employees available
                        </SelectItem>
                      ) : (
                        employees.map(employee => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name} ({employee.email})
                            {employee.staff_type && ` - ${employee.staff_type.name}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {employees.length === 0 && (
                    <p className="text-xs text-destructive">
                      No employees found. Please ensure employees are seeded in the system.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">2. Select Workflow Template *</label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a workflow template to use" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <SelectItem value="__no_templates__" disabled>
                          No templates available
                        </SelectItem>
                      ) : (
                        templates.map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.resource_type})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {templates.length === 0 && (
                    <p className="text-xs text-destructive">
                      No workflow templates found. Please create a template first.
                    </p>
                  )}
                  {selectedTemplateId && (
                    <p className="text-xs text-muted-foreground">
                      This template will be used to create a <strong>{templates.find(t => t.id === selectedTemplateId)?.resource_type || 'request'}</strong> for the selected employee
                    </p>
                  )}
                </div>

                {scenarioId && (
                  <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-800 border border-blue-200">
                    <strong>Test Scenario:</strong> {scenarioId}
                  </div>
                )}

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 text-blue-900">What will happen:</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>A real {selectedTemplateId ? templates.find(t => t.id === selectedTemplateId)?.resource_type || 'request' : 'leave request or timesheet'} will be created for {selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId)?.name || 'the selected employee' : 'the selected employee'}</li>
                    <li>The request will be submitted using the selected workflow template</li>
                    <li>You'll see all workflow steps and can approve as each designated approver</li>
                    <li>The request will progress through the workflow step-by-step</li>
                  </ul>
                </div>

                <Button
                  onClick={handleStartSimulation}
                  disabled={!selectedTemplateId || !selectedEmployeeId || isSimulating || templates.length === 0 || employees.length === 0}
                  className="w-full"
                  size="lg"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {isSimulating ? (
                    'Creating Request & Starting Simulation...'
                  ) : (
                    <>
                      Create {selectedTemplateId ? templates.find(t => t.id === selectedTemplateId)?.resource_type || 'Request' : 'Request'} & Start Simulation
                    </>
                  )}
                </Button>
                
                {(!selectedTemplateId || !selectedEmployeeId) && (
                  <p className="text-xs text-center text-muted-foreground">
                    Please select both an employee and a workflow template to continue
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Simulation View */
          <div className="space-y-6">
            {/* Simulation Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Workflow Template: {simulation.template?.name}</CardTitle>
                    <CardDescription>
                      Resource Type: {simulation.template?.resource_type} • 
                      Employee: {simulation.employee?.name} ({simulation.employee?.email})
                      {simulation.resource_id && (
                        <span className="ml-2">
                          • <a 
                            href={simulation.resource_type === 'leave' 
                              ? `/leave/requests/${simulation.resource_id}` 
                              : `/timesheets/${simulation.resource_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View {simulation.resource_type === 'leave' ? 'Leave Request' : 'Timesheet'}
                          </a>
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={simulation.status === 'completed' ? 'default' : 'secondary'}>
                    {simulation.status}
                  </Badge>
                </div>
              </CardHeader>
              {simulation.employee && (
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm">
                      Employee: <strong>{simulation.employee.name}</strong> ({simulation.employee.email})
                    </span>
                  </div>
                  {simulation.resource_id && simulation.resource_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {simulation.resource_type === 'leave' ? 'Leave Request' : 'Timesheet'}: 
                      </span>
                      <a
                        href={simulation.resource_type === 'leave' 
                          ? `/leave/requests/${simulation.resource_id}`
                          : `/timesheets/${simulation.resource_id}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View {simulation.resource_type === 'leave' ? 'Leave Request' : 'Timesheet'}
                      </a>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Workflow Steps */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Workflow Steps</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Each step shows who should approve based on the template configuration. Click "Approve as [Name]" to approve on their behalf.
              </p>
              {simulation.steps.map((step, index) => (
                <Card key={step.step_order} className={step.status === 'in_progress' ? 'border-blue-500 border-2' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStepStatusIcon(step.status)}
                        <div>
                          <CardTitle className="text-lg">Step {step.step_order}</CardTitle>
                          <CardDescription>
                            <div className="space-y-1">
                              <div>Required Permission: <Badge variant="outline" className="text-xs">{step.required_permission}</Badge></div>
                              {step.approver_strategy && (
                                <div>Strategy: <Badge variant="secondary" className="text-xs">{step.approver_strategy}</Badge></div>
                              )}
                              {step.approvers.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  {step.approvers.length} approver{step.approvers.length !== 1 ? 's' : ''} resolved for this step
                                </div>
                              )}
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={
                        step.status === 'approved' ? 'default' :
                        step.status === 'declined' ? 'destructive' :
                        step.status === 'in_progress' ? 'secondary' :
                        'outline'
                      }>
                        {step.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Diagnostic Info - Show why no approvers were found */}
                    {step.approvers.length === 0 && step.diagnostic_info && step.diagnostic_info.length > 0 && (
                      <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-900">
                          <Shield className="h-5 w-5 text-amber-600" />
                          No Approvers Found - Diagnostic Information:
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 mb-3">
                          {step.diagnostic_info.map((info, idx) => (
                            <li key={idx}>{info}</li>
                          ))}
                        </ul>
                        <div className="mt-3 p-3 bg-white border border-amber-200 rounded text-sm">
                          <p className="font-medium text-amber-900 mb-1">To fix this:</p>
                          <ul className="list-disc list-inside space-y-1 text-amber-800">
                            {step.diagnostic_info.some(i => i.includes('no manager')) && (
                              <li>Assign a manager to the employee in the user management section</li>
                            )}
                            {step.diagnostic_info.some(i => i.includes('No active users found with required roles')) && (
                              <li>Assign users to the required roles, or change the workflow template to use different roles</li>
                            )}
                            {step.diagnostic_info.some(i => i.includes("don't have permission")) && (
                              <li>Grant the required permission to the roles assigned in the workflow template</li>
                            )}
                            {step.diagnostic_info.some(i => i.includes('No users found with permission')) && (
                              <li>Ensure at least one user has the required permission: <code className="bg-amber-100 px-1 rounded">{step.required_permission}</code></li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Approve As Section - Show for current step (with or without approvers) */}
                    {step.status === 'in_progress' && (
                      <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg shadow-sm">
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-900">
                          <Shield className="h-5 w-5 text-blue-600" />
                          This Step Should Be Approved By:
                        </h4>
                        {step.approvers.length > 0 ? (
                          <>
                            <p className="text-sm text-blue-800 mb-4">
                              Based on the template configuration, the following {step.approvers.length === 1 ? 'person' : 'people'} {step.approvers.length === 1 ? 'is' : 'are'} responsible for approving Step {step.step_order}. Click "Approve as [Name]" to approve on their behalf.
                            </p>
                            <div className="space-y-2">
                          {step.approvers.map((approver) => (
                            <div
                              key={approver.id}
                              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-4 border-2 rounded-lg bg-white ${
                                approver.acted 
                                  ? 'bg-green-50 border-green-300' 
                                  : 'border-blue-300 shadow-sm'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {getSourceIcon(approver.source)}
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="font-semibold text-base sm:text-lg break-words">{approver.name}</span>
                                    {approver.role && (
                                      <Badge variant="default" className="text-xs whitespace-nowrap">
                                        {approver.role}
                                      </Badge>
                                    )}
                                    <Badge 
                                      variant={
                                        approver.source === 'manager' ? 'default' :
                                        approver.source === 'role' ? 'secondary' :
                                        'outline'
                                      }
                                      className="text-xs whitespace-nowrap"
                                    >
                                      {approver.source === 'manager' ? 'Manager' :
                                       approver.source === 'role' ? 'Role-based' :
                                       'Permission-based'}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground break-words">{approver.email}</div>
                                  {approver.comment && (
                                    <div className="text-xs text-muted-foreground mt-1 italic break-words">
                                      "{approver.comment}"
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {approver.acted ? (
                                  <Badge variant={step.status === 'declined' ? 'destructive' : 'default'} className="text-sm px-3 py-1 whitespace-nowrap">
                                    {step.status === 'declined' ? 'Declined' : 'Approved'}
                                  </Badge>
                                ) : (
                                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleApproveStep(step.step_order, approver.id)}
                                      disabled={processingStep?.stepOrder === step.step_order && processingStep?.approverId === approver.id}
                                      className="w-full sm:w-auto whitespace-nowrap"
                                    >
                                      {processingStep?.stepOrder === step.step_order && processingStep?.approverId === approver.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Processing...
                                        </>
                                      ) : (
                                        <>Approve as {approver.role || approver.name.split(' ')[0]}</>
                                      )}
                                    </Button>
                                    {step.allow_decline !== false && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeclineStep(step.step_order, approver.id)}
                                        disabled={processingStep?.stepOrder === step.step_order && processingStep?.approverId === approver.id}
                                        className="w-full sm:w-auto whitespace-nowrap"
                                      >
                                        Decline
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                            </div>
                          </>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm text-amber-800 mb-2">
                              ⚠️ <strong>No approvers found for this step.</strong>
                            </p>
                            {step.diagnostic_info && step.diagnostic_info.length > 0 ? (
                              <ul className="list-disc list-inside text-xs text-amber-700 space-y-1">
                                {step.diagnostic_info.map((info, idx) => (
                                  <li key={idx}>{info}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-amber-700">
                                The workflow template configuration may need adjustment. Check the step configuration in the template.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pending/Upcoming Steps - Show who will approve */}
                    {step.status === 'pending' && step.approvers.length > 0 && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <h4 className="font-semibold mb-2 text-sm">
                          Will Be Approved By ({step.approvers.length}):
                        </h4>
                        <div className="space-y-2">
                          {step.approvers.map((approver) => (
                            <div
                              key={approver.id}
                              className="flex items-center gap-2 p-2 bg-white border rounded text-sm"
                            >
                              {getSourceIcon(approver.source)}
                              <span className="font-medium">{approver.name}</span>
                              {approver.role && (
                                <Badge variant="outline" className="text-xs">
                                  {approver.role}
                                </Badge>
                              )}
                              <Badge
                                variant={
                                  approver.source === 'manager' ? 'default' :
                                  approver.source === 'role' ? 'secondary' :
                                  'outline'
                                }
                                className="text-xs"
                              >
                                {approver.source === 'manager' ? 'Manager' :
                                 approver.source === 'role' ? 'Role-based' :
                                 'Permission-based'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Completed Steps - Show who approved */}
                    {(step.status === 'approved' || step.status === 'declined') && step.approvers.length > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-semibold mb-2 text-sm">
                          Approved By:
                        </h4>
                        <div className="space-y-2">
                          {step.approvers.filter(a => a.acted).map((approver) => (
                            <div
                              key={approver.id}
                              className="flex items-center gap-2 p-2 bg-white border rounded text-sm"
                            >
                              {getSourceIcon(approver.source)}
                              <span className="font-medium">{approver.name}</span>
                              {approver.role && (
                                <Badge variant="outline" className="text-xs">
                                  {approver.role}
                                </Badge>
                              )}
                              <Badge variant={step.status === 'declined' ? 'destructive' : 'default'} className="text-xs">
                                {step.status === 'declined' ? 'Declined' : 'Approved'}
                              </Badge>
                              {approver.comment && (
                                <span className="text-xs text-muted-foreground italic ml-2">
                                  "{approver.comment}"
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {step.resolved_at && (
                      <div className="text-xs text-muted-foreground">
                        Resolved at: {new Date(step.resolved_at).toLocaleString()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Simulation Controls */}
            <div className="flex items-center justify-end gap-4">
              <Button
                variant="secondary"
                onClick={handleAutoRun}
                disabled={isAutoRunning || simulation.status !== 'running'}
              >
                {isAutoRunning ? 'Auto-running...' : 'Auto-run to Completion'}
              </Button>
              <Button variant="outline" onClick={() => setSimulation(null)}>
                Reset Simulation
              </Button>
              <Button onClick={() => router.push('/workflows/test')}>
                Back to Testing
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
