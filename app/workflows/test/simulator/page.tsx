'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, CheckCircle, XCircle, Clock, User, Shield, Mail } from 'lucide-react';
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
    notified: boolean;
    acted: boolean;
    acted_at?: string;
    comment?: string;
  }>;
  resolved_at?: string;
}

interface SimulationState {
  simulation_id?: string;
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
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [simulation, setSimulation] = React.useState<SimulationState | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSimulating, setIsSimulating] = React.useState(false);

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await workflowService.getTemplates({ status: 'active' });
      if (response.success && response.data) {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    if (!selectedTemplateId) {
      alert('Please select a workflow template');
      return;
    }

    try {
      setIsSimulating(true);
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) {
        alert('Template not found');
        return;
      }

      // Call simulation API
      const response = await api.post('/api/workflows/test/simulate', {
        template_id: selectedTemplateId,
        scenario_id: scenarioId || 'default',
      });

      if (response.success && response.data) {
        setSimulation(response.data);
      } else {
        alert('Failed to start simulation');
      }
    } catch (error: any) {
      console.error('Failed to simulate:', error);
      alert(error.message || 'Failed to start simulation');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleApproveStep = async (stepOrder: number, approverId: string) => {
    if (!simulation || !simulation.simulation_id) return;

    try {
      const response = await api.post('/api/workflows/test/simulate/approve', {
        simulation_id: simulation.simulation_id,
        step_order: stepOrder,
        approver_id: approverId,
      });

      if (response.success && response.data) {
        setSimulation(response.data);
      }
    } catch (error: any) {
      console.error('Failed to approve step:', error);
      alert(error.message || 'Failed to approve step');
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
          <Card>
            <CardHeader>
              <CardTitle>Start Simulation</CardTitle>
              <CardDescription>
                Select a workflow template to simulate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow Template *</label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.resource_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {scenarioId && (
                <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-800">
                  Using test scenario: {scenarioId}
                </div>
              )}

              <Button
                onClick={handleStartSimulation}
                disabled={!selectedTemplateId || isSimulating}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                {isSimulating ? 'Starting Simulation...' : 'Start Simulation'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Simulation View */
          <div className="space-y-6">
            {/* Simulation Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{simulation.template?.name}</CardTitle>
                    <CardDescription>
                      Resource Type: {simulation.template?.resource_type}
                    </CardDescription>
                  </div>
                  <Badge variant={simulation.status === 'completed' ? 'default' : 'secondary'}>
                    {simulation.status}
                  </Badge>
                </div>
              </CardHeader>
              {simulation.employee && (
                <CardContent>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="text-sm">
                      Employee: <strong>{simulation.employee.name}</strong> ({simulation.employee.email})
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Workflow Steps */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Workflow Steps</h2>
              {simulation.steps.map((step, index) => (
                <Card key={step.step_order} className={step.status === 'in_progress' ? 'border-blue-500' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStepStatusIcon(step.status)}
                        <div>
                          <CardTitle className="text-lg">Step {step.step_order}</CardTitle>
                          <CardDescription>
                            Permission: {step.required_permission}
                            {step.approver_strategy && ` • Strategy: ${step.approver_strategy}`}
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
                    {/* Approvers */}
                    <div>
                      <h4 className="font-semibold mb-2">
                        Resolved Approvers ({step.approvers.length})
                      </h4>
                      <div className="space-y-2">
                        {step.approvers.map((approver) => (
                          <div
                            key={approver.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              approver.acted ? 'bg-green-50 border-green-200' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {getSourceIcon(approver.source)}
                              <div className="flex-1">
                                <div className="font-medium">{approver.name}</div>
                                <div className="text-sm text-muted-foreground">{approver.email}</div>
                                {approver.comment && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Comment: {approver.comment}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {approver.notified && (
                                <Badge variant="outline" className="text-xs">
                                  <Mail className="h-3 w-3 mr-1" />
                                  Notified
                                </Badge>
                              )}
                              {approver.acted ? (
                                <Badge variant="default" className="text-xs">
                                  Approved
                                </Badge>
                              ) : step.status === 'in_progress' ? (
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveStep(step.step_order, approver.id)}
                                >
                                  Approve
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

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
