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
  locations?: Array<{ id: string; name: string }>;
  resourceType: 'leave' | 'timesheet';
  onClose: () => void;
  onSave: (step: WorkflowStep) => void;
  onPreviewApprovers?: (step: WorkflowStep) => void;
}

interface RoleWithPermissions extends Role {
  permissions?: Permission[];
}

export function StepConfigurationDialog({
  open,
  step,
  stepIndex,
  permissions,
  roles,
  locations = [],
  resourceType,
  onClose,
  onSave,
  onPreviewApprovers,
}: StepConfigurationDialogProps) {
  const [formData, setFormData] = React.useState<WorkflowStep>({
    step_order: stepIndex + 1,
    required_permission: resourceType === 'leave' ? 'leave.approve' : 'timesheet.approve',
    allow_decline: true,
    allow_adjust: false,
    approver_strategy: 'role',
    include_manager: false,
    required_roles: [],
    location_scope: 'all',
    required_locations: [], // New field for specific location filtering
  } as any);

  React.useEffect(() => {
    if (step) {
      // Extract required_locations from conditional_rules if stored there
      let requiredLocations: string[] = [];
      if (step.conditional_rules && Array.isArray(step.conditional_rules)) {
        const metadataRule = step.conditional_rules.find((r: any) => r._metadata?.required_locations);
        if (metadataRule?._metadata?.required_locations) {
          requiredLocations = metadataRule._metadata.required_locations;
        }
      }

      setFormData({
        ...step,
        required_roles: step.required_roles || [],
        required_locations: requiredLocations,
      } as any);
    } else {
      setFormData({
        step_order: stepIndex + 1,
        required_permission: resourceType === 'leave' ? 'leave.approve' : 'timesheet.approve',
        allow_decline: true,
        allow_adjust: false,
        approver_strategy: 'role',
        include_manager: false,
        required_roles: [],
        location_scope: 'all',
        required_locations: [],
      } as any);
    }
  }, [step, stepIndex]);

  const filteredPermissions = React.useMemo(() => {
    return permissions.filter(p => {
      if (resourceType === 'leave') {
        return p.name.includes('leave');
      } else {
        return p.name.includes('timesheet') || p.name.includes('timesheets');
      }
    });
  }, [permissions, resourceType]);

  // Auto-select permission based on selected roles
  React.useEffect(() => {
    if (formData.required_roles && formData.required_roles.length > 0 && !formData.required_permission) {
      // Find common permissions across selected roles
      // For now, auto-select based on resource type
      const suggestedPermission = resourceType === 'leave' 
        ? filteredPermissions.find(p => p.name.includes('leave.approve'))?.name || 
          filteredPermissions.find(p => p.name.includes('leave'))?.name
        : filteredPermissions.find(p => p.name.includes('timesheet.approve'))?.name ||
          filteredPermissions.find(p => p.name.includes('timesheet'))?.name;
      
      if (suggestedPermission) {
        setFormData(prev => ({ ...prev, required_permission: suggestedPermission }));
      }
    }
  }, [formData.required_roles, resourceType, filteredPermissions]);

  const handleSave = () => {
    // Auto-select permission if not set but roles are selected
    if (!formData.required_permission && formData.required_roles && formData.required_roles.length > 0) {
      const suggestedPermission = resourceType === 'leave' 
        ? filteredPermissions.find(p => p.name.includes('leave.approve'))?.name || 
          filteredPermissions.find(p => p.name.includes('leave'))?.name
        : filteredPermissions.find(p => p.name.includes('timesheet.approve'))?.name ||
          filteredPermissions.find(p => p.name.includes('timesheet'))?.name;
      
      if (suggestedPermission) {
        formData.required_permission = suggestedPermission;
      }
    }

    if (!formData.required_permission) {
      alert('Please select a required permission, or select roles to auto-select a permission');
      return;
    }

    // Validation: Require either manager OR at least one role
    if (!formData.include_manager && (!formData.required_roles || formData.required_roles.length === 0)) {
      alert('Please either enable "Include Manager" or select at least one role. This ensures you can see who will approve each step.');
      return;
    }

    // Warning: For permission-based strategy without roles, approvers won't be visible until runtime
    if (formData.approver_strategy === 'permission' && 
        !formData.include_manager && 
        (!formData.required_roles || formData.required_roles.length === 0)) {
      const proceed = confirm(
        'Warning: You have selected "Permission-based" strategy without specifying roles or including manager.\n\n' +
        'This means:\n' +
        '- Approvers will be resolved at runtime (any user with the permission)\n' +
        '- You won\'t see specific approvers in the simulation until the workflow runs\n' +
        '- It\'s recommended to select specific roles or use "Role-based" or "Combined" strategy\n\n' +
        'Do you want to continue anyway?'
      );
      if (!proceed) {
        return;
      }
    }

    // Prepare the step data for saving
    // Ensure required_roles is an array (not undefined/null)
    const requiredRoles = formData.required_roles && Array.isArray(formData.required_roles) 
      ? formData.required_roles 
      : [];

    // Prepare conditional_rules - filter out metadata and ensure proper format
    let conditionalRules: any[] = [];
    if (formData.conditional_rules && Array.isArray(formData.conditional_rules)) {
      // Filter out _metadata entries and keep only valid conditional rules
      conditionalRules = formData.conditional_rules.filter((rule: any) => 
        rule && typeof rule === 'object' && rule.condition && rule.approver_strategy
      );
    }

    // If required_locations exist, add them as metadata in conditional_rules
    if ((formData as any).required_locations && Array.isArray((formData as any).required_locations) && (formData as any).required_locations.length > 0) {
      conditionalRules.push({
        _metadata: {
          required_locations: (formData as any).required_locations,
        },
      });
    }

    // Build the step object to save
    // If manager is included, use 'combined' strategy, otherwise 'role'
    // Determine approver strategy:
    // - If manager is included AND no roles: 'manager' (manager-only)
    // - If manager is included AND roles exist: 'combined' (manager + roles)
    // - If no manager but roles exist: 'role' (role-based)
    // - If neither: This should not happen due to validation, but default to 'role'
    let approverStrategy: string;
    if (formData.include_manager && (!requiredRoles || requiredRoles.length === 0)) {
      approverStrategy = 'manager'; // Manager-only step
    } else if (formData.include_manager && requiredRoles && requiredRoles.length > 0) {
      approverStrategy = 'combined'; // Manager + roles
    } else {
      approverStrategy = 'role'; // Role-based only
    }
    
    const stepToSave: any = {
      step_order: formData.step_order,
      required_permission: formData.required_permission,
      allow_decline: formData.allow_decline !== undefined ? formData.allow_decline : true,
      allow_adjust: formData.allow_adjust !== undefined ? formData.allow_adjust : false,
      approver_strategy: approverStrategy,
      include_manager: formData.include_manager || false,
      location_scope: formData.location_scope || 'all',
    };

    // Only include required_roles if it's not empty
    if (requiredRoles.length > 0) {
      stepToSave.required_roles = requiredRoles;
    }

    // Only include conditional_rules if it's not empty
    if (conditionalRules.length > 0) {
      stepToSave.conditional_rules = conditionalRules;
    }

    onSave(stepToSave);
    onClose();
  };

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

          {/* Approver Strategy - Hidden, always role-based */}
          <input type="hidden" value="role" />

          {/* Manager Option - When enabled, disables role selection */}
          <div className="space-y-2 border-t pt-4">
            <Label>Include Manager as Approver</Label>
            <div className="flex items-center gap-2">
              <Switch
                id="include-manager"
                checked={formData.include_manager || false}
                onCheckedChange={(checked) => {
                  setFormData({ 
                    ...formData, 
                    include_manager: checked,
                    // Clear roles when manager is enabled (manager doesn't need roles)
                    required_roles: checked ? [] : (formData.required_roles || [])
                  });
                }}
              />
              <Label htmlFor="include-manager" className="cursor-pointer">
                Include Employee's Manager
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, the employee's direct manager will automatically be the approver for this step (if they have the required permission). Role selection will be disabled. The manager can be included at any step, not just step 1.
            </p>
            {formData.include_manager && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                <p className="text-green-800">
                  ✅ Manager mode active: The employee's manager will approve this step. No role selection needed.
                </p>
              </div>
            )}
          </div>

          {/* Required Roles - Only show if manager is not included */}
          {!formData.include_manager && (
            <div className="space-y-2">
              <Label>
                Required Roles *
              </Label>
              <p className="text-xs text-muted-foreground">
                <strong>Required:</strong> Select at least one role. <strong>Only users with these specific roles</strong> (who also have the required permission) will be able to approve this step. Users with just the permission but not the role will NOT be included.
              </p>
              <div className={`border rounded-lg p-3 max-h-48 overflow-y-auto ${formData.include_manager ? 'opacity-50 pointer-events-none' : ''}`}>
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles available. Please create roles first.</p>
                ) : (
                  <div className="space-y-2">
                    {roles.map(role => {
                      const isSelected = formData.required_roles?.includes(role.id);
                      return (
                        <div
                          key={role.id}
                          className={`flex items-center justify-between p-2 rounded border transition-colors ${
                            formData.include_manager ? 'cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => !formData.include_manager && toggleRole(role.id)}
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
              {formData.include_manager && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Manager will also be included as an approver</span>
                  </div>
                </div>
              )}
              {formData.required_roles && formData.required_roles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-green-700">✅ Selected Roles ({formData.required_roles.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.required_roles.map(roleId => {
                      const role = roles.find(r => r.id === roleId);
                      return role ? (
                        <Badge key={roleId} variant="secondary" className="text-sm">
                          {role.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              {(formData.approver_strategy === 'role' || formData.approver_strategy === 'combined') && 
               (!formData.required_roles || formData.required_roles.length === 0) && (
                <p className="text-xs text-destructive font-medium">
                  ⚠️ Please select at least one role to proceed
                </p>
              )}
            </div>
          )}

          {/* Location Filtering */}
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="location-scope">Location Scope</Label>
              <Select
                value={formData.location_scope || 'all'}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  location_scope: value as 'same' | 'parent' | 'descendants' | 'all' 
                })}
              >
                <SelectTrigger id="location-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">⭐ Any Location (Recommended)</SelectItem>
                  <SelectItem value="same">Same Location Only</SelectItem>
                  <SelectItem value="parent">Parent Location</SelectItem>
                  <SelectItem value="descendants">Descendant Locations</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Where approvers can be located. "Any Location" allows approvers from anywhere.
              </p>
            </div>

            {/* Specific Location Filtering */}
            {locations.length > 0 && (
              <div className="space-y-2">
                <Label>Specific Locations (Optional - Further Restrict Approvers)</Label>
                <p className="text-xs text-muted-foreground">
                  Select specific locations where approvers must be located. Leave empty to use location scope only.
                </p>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations available</p>
                  ) : (
                    <div className="space-y-2">
                      {locations.map(location => {
                        const isSelected = (formData as any).required_locations?.includes(location.id);
                        return (
                          <div
                            key={location.id}
                            className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => {
                              const currentLocs = (formData as any).required_locations || [];
                              if (isSelected) {
                                setFormData({
                                  ...formData,
                                  required_locations: currentLocs.filter((id: string) => id !== location.id),
                                } as any);
                              } else {
                                setFormData({
                                  ...formData,
                                  required_locations: [...currentLocs, location.id],
                                } as any);
                              }
                            }}
                          >
                            <div className="font-medium">{location.name}</div>
                            {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {(formData as any).required_locations && (formData as any).required_locations.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(formData as any).required_locations.map((locId: string) => {
                      const location = locations.find(l => l.id === locId);
                      return location ? (
                        <Badge key={locId} variant="secondary" className="text-sm">
                          {location.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
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
