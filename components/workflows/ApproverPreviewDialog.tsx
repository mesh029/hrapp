'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { WorkflowStep } from '@/ui/src/services/workflows';
import { User, Building2, Shield, UserCheck } from 'lucide-react';
import { api } from '@/ui/src/services/api';

export interface ApproverPreviewDialogProps {
  open: boolean;
  step: WorkflowStep;
  locationId: string;
  resourceType: 'leave' | 'timesheet';
  onClose: () => void;
}

export interface ApproverPreview {
  id: string;
  name: string;
  email: string;
  source: 'manager' | 'role' | 'permission';
  role?: string;
  location?: string;
}

export function ApproverPreviewDialog({
  open,
  step,
  locationId,
  resourceType,
  onClose,
}: ApproverPreviewDialogProps) {
  const [testEmployeeId, setTestEmployeeId] = React.useState<string>('');
  const [employees, setEmployees] = React.useState<Array<{ id: string; name: string; email: string }>>([]);
  const [approvers, setApprovers] = React.useState<ApproverPreview[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      loadEmployees();
    }
  }, [open]);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/api/users?status=active&limit=100');
      if (response.success && response.data) {
        const users = response.data.users || response.data || [];
        setEmployees(users.filter((u: any) => u.manager_id || true)); // Filter to users who might have managers
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const handlePreview = async () => {
    if (!testEmployeeId) {
      alert('Please select a test employee');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call approver resolution API
      const response = await api.post('/api/workflows/templates/preview-approvers', {
        step: {
          step_order: step.step_order,
          required_permission: step.required_permission,
          approver_strategy: step.approver_strategy || 'permission',
          include_manager: step.include_manager || false,
          required_roles: step.required_roles || [],
          location_scope: step.location_scope || 'same',
        },
        test_employee_id: testEmployeeId,
        location_id: locationId,
        resource_type: resourceType,
      });

      if (response.success && response.data) {
        setApprovers(response.data.approvers || []);
      } else {
        const errorMsg = response.message || response.error || `Failed to preview approvers (${response.status || 'unknown error'})`;
        setError(errorMsg);
        console.error('Preview approvers error:', response);
      }
    } catch (err: any) {
      console.error('Failed to preview approvers:', err);
      setError(err.message || 'Failed to preview approvers');
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'manager':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'role':
        return <Shield className="h-4 w-4 text-green-600" />;
      default:
        return <UserCheck className="h-4 w-4 text-purple-600" />;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'manager':
        return <Badge className="bg-blue-100 text-blue-800">Manager</Badge>;
      case 'role':
        return <Badge className="bg-green-100 text-green-800">Role</Badge>;
      default:
        return <Badge className="bg-purple-100 text-purple-800">Permission</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Approvers for Step {step.step_order}</DialogTitle>
          <DialogDescription>
            Test approver resolution with a sample employee
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Test Employee Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Test Employee</label>
            <Select value={testEmployeeId} onValueChange={setTestEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an employee to test with" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select an employee to see who would be approvers for this step
            </p>
          </div>

          {/* Preview Button */}
          <Button onClick={handlePreview} disabled={!testEmployeeId || isLoading} className="w-full">
            {isLoading ? 'Loading...' : 'Preview Approvers'}
          </Button>

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Approvers List */}
          {approvers.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Resolved Approvers ({approvers.length})</h4>
              <div className="space-y-2">
                {approvers.map((approver) => (
                  <div
                    key={approver.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getSourceIcon(approver.source)}
                      <div className="flex-1">
                        <div className="font-medium">{approver.name}</div>
                        <div className="text-sm text-muted-foreground">{approver.email}</div>
                        {approver.role && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Role: {approver.role}
                          </div>
                        )}
                        {approver.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Building2 className="h-3 w-3" />
                            {approver.location}
                          </div>
                        )}
                      </div>
                    </div>
                    {getSourceBadge(approver.source)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {approvers.length === 0 && !isLoading && !error && testEmployeeId && (
            <div className="text-center py-8 text-muted-foreground">
              Click "Preview Approvers" to see who would approve this step
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
