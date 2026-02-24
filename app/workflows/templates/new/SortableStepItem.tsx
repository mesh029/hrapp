'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Settings, Eye, Trash2, User, Shield, UserCheck } from 'lucide-react';
import { WorkflowStep } from '@/ui/src/services/workflows';

interface SortableStepItemProps {
  step: WorkflowStep;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  onPreview: () => void;
  canRemove: boolean;
  roles?: Array<{ id: string; name: string }>; // Optional roles list to map role IDs to names
}

export function SortableStepItem({
  step,
  index,
  onEdit,
  onRemove,
  onPreview,
  canRemove,
  roles = [],
}: SortableStepItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.step_order.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStrategyBadge = () => {
    const strategy = step.approver_strategy || 'permission';
    switch (strategy) {
      case 'manager':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Manager</Badge>;
      case 'role':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Role-based</Badge>;
      case 'combined':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">Combined</Badge>;
      default:
        return <Badge variant="outline">Permission</Badge>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-4 bg-card ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-1"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Step {step.step_order}</span>
              {getStrategyBadge()}
              {step.include_manager && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  <User className="h-3 w-3 mr-1" />
                  Manager
                </Badge>
              )}
            </div>
            <div className="text-sm">
              <div className="font-medium">Permission: {step.required_permission || 'Not set'}</div>
              {(() => {
                // Handle both string (JSON) and array formats
                let roleIds: string[] = [];
                if (step.required_roles) {
                  if (Array.isArray(step.required_roles)) {
                    roleIds = step.required_roles;
                  } else if (typeof step.required_roles === 'string') {
                    try {
                      roleIds = JSON.parse(step.required_roles);
                    } catch {
                      roleIds = [];
                    }
                  }
                }
                
                return roleIds.length > 0 ? (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Required Roles:</div>
                    <div className="flex flex-wrap gap-1">
                      {roleIds.map((roleId: string) => {
                        const role = roles.find(r => r.id === roleId);
                        return (
                          <Badge key={roleId} variant="secondary" className="text-xs">
                            {role ? role.name : roleId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {step.allow_decline && <span>✓ Can Decline</span>}
                {step.allow_adjust && <span>✓ Can Adjust</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPreview}
            title="Preview Approvers"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            title="Configure Step"
          >
            <Settings className="h-4 w-4" />
          </Button>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              title="Remove Step"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
