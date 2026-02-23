'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { WorkflowStep } from '@/ui/src/services/workflows';
import { Role } from '@/ui/src/services/roles';
import { Eye, CheckCircle, Plus, Trash2 } from 'lucide-react';

export interface Permission {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface StepConfigurationDialogProps {
  open: boolean;
  step: WorkflowStep | null;
  stepIndex: number;
  permissions: Permission[];
  roles: Role[];
  resourceType: 'leave' | 'timesheet';
  onClose: () => void;
  onSave: (step: WorkflowStep) => void;
  onPreviewApprovers?: (step: WorkflowStep) => void;
}

export function StepConfigurationDialog({
  open,
  step,
  stepIndex,
  permissions,
  roles,
  resourceType,
  onClose,
  onSave,
  onPreviewApprovers,
}: StepConfigurationDialogProps) {
  const [formData, setFormData] = React.useState<WorkflowStep>({
    step_order: stepIndex + 1,
    required_permission: '',
    allow_decline: true,
    allow_adjust: false,
    approver_strategy: 'permission',
    include_manager: false,
    required_roles: [],
    location_scope: 'same',
  });

  React.useEffect(() => {
    if (step) {
      setFormData({
        ...step,
        required_roles: step.required_roles || [],
      });
    } else {
      setFormData({
        step_order: stepIndex + 1,
        required_permission: '',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'permission',
        include_manager: false,
        required_roles: [],
        location_scope: 'same',
      });
    }
  }, [step, stepIndex]);

  const handleSave = () => {
    if (!formData.required_permission) {
      alert('Please select a required permission');
      return;
    }
    onSave(formData);
    onClose();
  };

  const filteredPermissions = permissions.filter(p => {
    if (resourceType === 'leave') {
      return p.name.includes('leave');
    } else {
      return p.name.includes('timesheet') || p.name.includes('timesheets');
    }
  });

  const toggleRole = (roleId: string) => {
    const currentRoles = formData.required_roles || [];
    if (currentRoles.includes(roleId)) {
      setFormData({
        ...formData,
        required_roles: currentRoles.filter(id => id !== roleId),
      });
    } else {
      setFormData({
        ...formData,
        required_roles: [...currentRoles, roleId],
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Step {formData.step_order}</DialogTitle>
          <DialogDescription>
            Set up approval requirements and approver resolution for this step
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Required Permission */}
          <div className="space-y-2">
            <Label htmlFor="permission">Required Permission *</Label>
            <Select
              value={formData.required_permission}
              onValueChange={(value) => setFormData({ ...formData, required_permission: value })}
            >
              <SelectTrigger id="permission">
                <SelectValue placeholder="Select a permission" />
              </SelectTrigger>
              <SelectContent>
                {filteredPermissions.map(perm => (
                  <SelectItem key={perm.id} value={perm.name}>
                    {perm.name}
                    {perm.description && ` - ${perm.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Approver Strategy */}
          <div className="space-y-2">
            <Label htmlFor="strategy">Approver Resolution Strategy *</Label>
            <Select
              value={formData.approver_strategy || 'permission'}
              onValueChange={(value) => setFormData({ 
                ...formData, 
                approver_strategy: value as 'permission' | 'manager' | 'role' | 'combined' 
              })}
            >
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="permission">Permission-based (all users with permission)</SelectItem>
                <SelectItem value="manager">Manager-based (employee's manager only)</SelectItem>
                <SelectItem value="role">Role-based (specific roles)</SelectItem>
                <SelectItem value="combined">Combined (manager + roles)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.approver_strategy === 'permission' && 'Finds all users with the required permission for the location'}
              {formData.approver_strategy === 'manager' && 'Uses the employee\'s manager as approver (if they have permission)'}
              {formData.approver_strategy === 'role' && 'Finds users with specific roles that have the permission'}
              {formData.approver_strategy === 'combined' && 'Includes manager + users with specified roles'}
            </p>
          </div>

          {/* Include Manager Toggle */}
          {(formData.approver_strategy === 'combined' || formData.approver_strategy === 'permission') && (
            <div className="flex items-center gap-2">
              <Switch
                id="include-manager"
                checked={formData.include_manager || false}
                onCheckedChange={(checked) => setFormData({ ...formData, include_manager: checked })}
              />
              <Label htmlFor="include-manager" className="cursor-pointer">
                Include Employee's Manager
              </Label>
            </div>
          )}

          {/* Required Roles (for role-based or combined) */}
          {(formData.approver_strategy === 'role' || formData.approver_strategy === 'combined') && (
            <div className="space-y-2">
              <Label>Required Roles *</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles available</p>
                ) : (
                  <div className="space-y-2">
                    {roles.map(role => {
                      const isSelected = formData.required_roles?.includes(role.id);
                      return (
                        <div
                          key={role.id}
                          className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleRole(role.id)}
                        >
                          <div>
                            <div className="font-medium">{role.name}</div>
                            {role.description && (
                              <div className="text-sm text-muted-foreground">{role.description}</div>
                            )}
                          </div>
                          {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {formData.required_roles && formData.required_roles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.required_roles.map(roleId => {
                    const role = roles.find(r => r.id === roleId);
                    return role ? (
                      <Badge key={roleId} variant="secondary">
                        {role.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Location Scope */}
          <div className="space-y-2">
            <Label htmlFor="location-scope">Location Scope</Label>
            <Select
              value={formData.location_scope || 'same'}
              onValueChange={(value) => setFormData({ 
                ...formData, 
                location_scope: value as 'same' | 'parent' | 'descendants' | 'all' 
              })}
            >
              <SelectTrigger id="location-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Same Location Only</SelectItem>
                <SelectItem value="parent">Parent Location</SelectItem>
                <SelectItem value="descendants">Descendant Locations</SelectItem>
                <SelectItem value="all">All Locations</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Rules (Advanced) */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Conditional Routing Rules (Advanced)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentRules = formData.conditional_rules || [];
                  setFormData({
                    ...formData,
                    conditional_rules: [
                      ...currentRules,
                      { condition: '', approver_strategy: 'permission' },
                    ],
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Define conditions that change approver resolution (e.g., amount &gt; 5 days → different approver)
            </p>
            {formData.conditional_rules && formData.conditional_rules.length > 0 && (
              <div className="space-y-2 mt-2">
                {formData.conditional_rules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                    <Input
                      placeholder="Condition (e.g., amount > 5)"
                      value={rule.condition}
                      onChange={(e) => {
                        const newRules = [...(formData.conditional_rules || [])];
                        newRules[idx] = { ...rule, condition: e.target.value };
                        setFormData({ ...formData, conditional_rules: newRules });
                      }}
                      className="flex-1"
                    />
                    <Select
                      value={rule.approver_strategy}
                      onValueChange={(value) => {
                        const newRules = [...(formData.conditional_rules || [])];
                        newRules[idx] = { ...rule, approver_strategy: value };
                        setFormData({ ...formData, conditional_rules: newRules });
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permission">Permission</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="role">Role</SelectItem>
                        <SelectItem value="combined">Combined</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newRules = formData.conditional_rules?.filter((_, i) => i !== idx) || [];
                        setFormData({ ...formData, conditional_rules: newRules });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step Options */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Switch
                id="allow-decline"
                checked={formData.allow_decline}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_decline: checked })}
              />
              <Label htmlFor="allow-decline" className="cursor-pointer">
                Allow Decline
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="allow-adjust"
                checked={formData.allow_adjust}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_adjust: checked })}
              />
              <Label htmlFor="allow-adjust" className="cursor-pointer">
                Allow Adjust
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          {onPreviewApprovers && (
            <Button
              variant="outline"
              onClick={() => onPreviewApprovers(formData)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Approvers
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
