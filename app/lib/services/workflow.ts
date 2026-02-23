import { prisma } from '@/lib/db';
import { checkAuthority } from '@/lib/services/authority';
import { generateDigitalSignature } from '@/lib/auth/jwt';
import { WorkflowStatus, WorkflowStepStatus, ResourceType } from '@prisma/client';
import { NotificationHelpers } from './notification';
import { AuditHelpers } from './audit';

export interface CreateWorkflowInstanceParams {
  templateId: string;
  resourceId: string;
  resourceType: ResourceType;
  createdBy: string;
  locationId: string;
}

export interface WorkflowActionParams {
  instanceId: string;
  userId: string;
  locationId: string;
  comment?: string;
  routeToStep?: number | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a workflow instance from a template
 */
export async function createWorkflowInstance(params: CreateWorkflowInstanceParams): Promise<string> {
  const { templateId, resourceId, resourceType, createdBy, locationId } = params;

  // Get template with steps
  const template = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
    include: {
      steps: {
        orderBy: { step_order: 'asc' },
      },
    },
  });

  if (!template || template.status === 'deprecated') {
    throw new Error('Workflow template not found or deprecated');
  }

  if (template.steps.length === 0) {
    throw new Error('Workflow template has no steps');
  }

  // Create workflow instance
  const instance = await prisma.workflowInstance.create({
    data: {
      workflow_template_id: templateId,
      resource_id: resourceId,
      resource_type: resourceType,
      created_by: createdBy,
      status: 'Draft',
      current_step_order: 0,
    },
  });

  // Create step instances for all steps
  const stepInstances = template.steps.map((step) => ({
    workflow_instance_id: instance.id,
    step_order: step.step_order,
    status: 'pending' as WorkflowStepStatus,
  }));

  await prisma.workflowStepInstance.createMany({
    data: stepInstances,
  });

  return instance.id;
}

/**
 * Submit workflow instance (move from Draft to Submitted)
 */
export async function submitWorkflowInstance(instanceId: string): Promise<void> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      template: {
        include: {
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      },
    },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  if (instance.status !== 'Draft') {
    throw new Error('Workflow instance must be in Draft status to submit');
  }

  const firstStep = instance.template.steps[0];
  if (!firstStep) {
    throw new Error('Workflow template has no steps');
  }

  // Get location from resource
  let locationId: string;
  if (instance.resource_type === 'leave') {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: instance.resource_id },
      select: { location_id: true },
    });
    locationId = leaveRequest?.location_id || '';
  } else if (instance.resource_type === 'timesheet') {
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: instance.resource_id },
      select: { location_id: true },
    });
    locationId = timesheet?.location_id || '';
  } else {
    throw new Error('Unknown resource type');
  }

  if (!locationId) {
    throw new Error('Resource location not found');
  }

  // Update instance status
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      status: 'Submitted',
      current_step_order: firstStep.step_order,
    },
  });

  // Resolve approvers for first step
  const approvers = await resolveApprovers(firstStep.step_order, instanceId, locationId, {
    stepConfig: firstStep,
  });

  // Notify approvers
  for (const approverId of approvers) {
    await NotificationHelpers.notifyWorkflowStepAssignment(
      approverId,
      instanceId,
      instance.resource_type,
      instance.resource_id,
      firstStep.step_order
    ).catch((error) => {
      console.error(`Failed to notify approver ${approverId}:`, error);
    });
  }
}

/**
 * Resolve approvers for a workflow step
 * Enhanced version that supports multiple approver resolution strategies
 * 
 * @param stepOrder - The workflow step order
 * @param workflowInstanceId - The workflow instance ID
 * @param locationId - The location ID for scope checking
 * @param options - Configuration options
 * @param options.stepConfig - The workflow step configuration (from database)
 * @param options.includeEmployeeManager - Legacy: If true, includes the employee's manager (overridden by stepConfig)
 */
export async function resolveApprovers(
  stepOrder: number,
  workflowInstanceId: string,
  locationId: string,
  options?: {
    stepConfig?: any; // WorkflowStep from database (with JSON fields parsed)
    includeEmployeeManager?: boolean; // Legacy support
  }
): Promise<string[]> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstanceId },
    include: {
      template: {
        include: {
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      },
      creator: {
        select: {
          id: true,
          manager_id: true,
          primary_location_id: true,
        },
      },
    },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  // Get step configuration
  let step = instance.template.steps.find((s: any) => s.step_order === stepOrder);
  if (!step) {
    throw new Error('Workflow step not found');
  }

  // Use provided stepConfig if available (has parsed JSON fields), otherwise use step from template
  const stepConfig = options?.stepConfig || step;
  
  // Parse JSON fields if they're strings (from database)
  const requiredRoles = typeof stepConfig.required_roles === 'string' 
    ? JSON.parse(stepConfig.required_roles) 
    : (stepConfig.required_roles || []);
  
  const approverStrategy = stepConfig.approver_strategy || 'permission';
  const includeManager = stepConfig.include_manager !== undefined 
    ? stepConfig.include_manager 
    : (options?.includeEmployeeManager || false);
  const locationScope = stepConfig.location_scope || 'same';

  const approverSet = new Set<string>();

  // Strategy 1: Manager-based resolution
  if (approverStrategy === 'manager' || approverStrategy === 'combined' || includeManager) {
    const employee = instance.creator;
    if (employee && employee.manager_id) {
      const manager = await prisma.user.findUnique({
        where: { id: employee.manager_id },
        include: {
          primary_location: {
            select: { id: true, name: true },
          },
          user_roles: {
            where: { deleted_at: null },
            include: {
              role: {
                include: {
                  role_permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (manager && manager.status === 'active' && !manager.deleted_at) {
        // Check if manager has the required permission
        const hasPermission = manager.user_roles.some(ur =>
          ur.role.status === 'active' &&
          ur.role.role_permissions.some(rp =>
            rp.permission.name === stepConfig.required_permission || 
            rp.permission.id === stepConfig.required_permission
          )
        );

        if (hasPermission) {
          // Check location scope and authority
          const managerLocationId = manager.primary_location_id || locationId;
          const shouldInclude = await checkLocationScope(managerLocationId, locationId, locationScope);
          
          if (shouldInclude) {
            const authority = await checkAuthority({
              userId: manager.id,
              permission: stepConfig.required_permission,
              locationId: managerLocationId,
              workflowStepOrder: stepOrder,
              workflowInstanceId,
            });

            if (authority.authorized) {
              approverSet.add(manager.id);
            }
          }
        }
      }
    }
  }

  // Strategy 2: Role-based resolution
  if ((approverStrategy === 'role' || approverStrategy === 'combined') && requiredRoles.length > 0) {
    const roleUsers = await prisma.user.findMany({
      where: {
        status: 'active',
        deleted_at: null,
        user_roles: {
          some: {
            role_id: { in: requiredRoles },
            deleted_at: null,
            role: {
              status: 'active',
              role_permissions: {
                some: {
                  permission: {
                    OR: [
                      { name: stepConfig.required_permission },
                      { id: stepConfig.required_permission },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      include: {
        primary_location: {
          select: { id: true, name: true },
        },
        user_roles: {
          where: {
            role_id: { in: requiredRoles },
            deleted_at: null,
          },
          include: {
            role: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    for (const roleUser of roleUsers) {
      const userLocationId = roleUser.primary_location_id || locationId;
      const shouldInclude = await checkLocationScope(userLocationId, locationId, locationScope);

      if (shouldInclude) {
        const authority = await checkAuthority({
          userId: roleUser.id,
          permission: stepConfig.required_permission,
          locationId: userLocationId,
          workflowStepOrder: stepOrder,
          workflowInstanceId,
        });

        if (authority.authorized) {
          approverSet.add(roleUser.id);
        }
      }
    }
  }

  // Strategy 3: Permission-based resolution (fallback or primary)
  if (approverStrategy === 'permission' || approverStrategy === 'combined') {
    const permissionUsers = await prisma.user.findMany({
      where: {
        status: 'active',
        deleted_at: null,
        user_roles: {
          some: {
            deleted_at: null,
            role: {
              status: 'active',
              role_permissions: {
                some: {
                  permission: {
                    OR: [
                      { name: stepConfig.required_permission },
                      { id: stepConfig.required_permission },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      include: {
        primary_location: {
          select: { id: true, name: true },
        },
      },
    });

    for (const permUser of permissionUsers) {
      const userLocationId = permUser.primary_location_id || locationId;
      const shouldInclude = await checkLocationScope(userLocationId, locationId, locationScope);

      if (shouldInclude) {
        const authority = await checkAuthority({
          userId: permUser.id,
          permission: stepConfig.required_permission,
          locationId: userLocationId,
          workflowStepOrder: stepOrder,
          workflowInstanceId,
        });

        if (authority.authorized) {
          approverSet.add(permUser.id);
        }
      }
    }
  }

  return Array.from(approverSet);
}

/**
 * Check if a user's location matches the required location scope
 */
async function checkLocationScope(
  userLocationId: string | null,
  requiredLocationId: string,
  scope: 'same' | 'parent' | 'descendants' | 'all'
): Promise<boolean> {
  if (scope === 'all') {
    return true;
  }

  if (!userLocationId) {
    return false;
  }

  if (scope === 'same') {
    return userLocationId === requiredLocationId;
  }

  if (scope === 'parent') {
    // Check if requiredLocationId is a descendant of userLocationId
    const location = await prisma.location.findUnique({
      where: { id: requiredLocationId },
      select: { path: true },
    });

    if (!location) return false;

    const userLocation = await prisma.location.findUnique({
      where: { id: userLocationId },
      select: { path: true },
    });

    if (!userLocation) return false;

    // Check if required location's path starts with user location's path
    return location.path.startsWith(userLocation.path) && location.path !== userLocation.path;
  }

  if (scope === 'descendants') {
    // Check if userLocationId is a descendant of requiredLocationId
    const location = await prisma.location.findUnique({
      where: { id: userLocationId },
      select: { path: true },
    });

    if (!location) return false;

    const requiredLocation = await prisma.location.findUnique({
      where: { id: requiredLocationId },
      select: { path: true },
    });

    if (!requiredLocation) return false;

    // Check if user location's path starts with required location's path
    return location.path.startsWith(requiredLocation.path) && location.path !== requiredLocation.path;
  }

  return false;
}

/**
 * Approve a workflow step
 */
export async function approveWorkflowStep(params: WorkflowActionParams): Promise<void> {
  const { instanceId, userId, locationId, comment, routeToStep, ipAddress, userAgent } = params;

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      template: {
        include: {
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      },
    },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  if (instance.status === 'Approved' || instance.status === 'Declined') {
    throw new Error('Workflow instance is already finalized');
  }

  const currentStep = instance.template.steps.find(
    (s) => s.step_order === instance.current_step_order
  );

  if (!currentStep) {
    throw new Error('Current workflow step not found');
  }

  // Check authority
  const authority = await checkAuthority({
    userId,
    permission: currentStep.required_permission,
    locationId,
    workflowStepOrder: instance.current_step_order,
    workflowInstanceId: instanceId,
  });

  if (!authority.authorized) {
    throw new Error('You do not have authority to approve this step');
  }

  // Check if user is an approver for this step
  const stepInstance = await prisma.workflowStepInstance.findUnique({
    where: {
      workflow_instance_id_step_order: {
        workflow_instance_id: instanceId,
        step_order: instance.current_step_order,
      },
    },
  });

  if (!stepInstance) {
    throw new Error('Workflow step instance not found');
  }

  // Update step instance
  const beforeState = {
    status: instance.status,
    current_step_order: instance.current_step_order,
    step_status: stepInstance.status,
  };

  await prisma.workflowStepInstance.update({
    where: {
      workflow_instance_id_step_order: {
        workflow_instance_id: instanceId,
        step_order: instance.current_step_order,
      },
    },
    data: {
      status: 'approved',
      acted_by: userId,
      acted_at: new Date(),
      comment: comment || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      digital_signature: await generateDigitalSignature(userId, instanceId, 'approve'),
    },
  });

  // Check if routing to specific step
  if (routeToStep !== null && routeToStep !== undefined) {
    const targetStep = instance.template.steps.find((s) => s.step_order === routeToStep);
    if (!targetStep) {
      throw new Error('Target step not found');
    }

    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status: 'UnderReview',
        current_step_order: routeToStep,
      },
    });

    const afterState = {
      status: 'UnderReview',
      current_step_order: routeToStep,
      step_status: 'approved',
    };

    await AuditHelpers.logWorkflowAction(
      userId,
      'approve',
      instanceId,
      instance.resource_type,
      instance.resource_id,
      beforeState,
      afterState,
      { step_order: instance.current_step_order, routed_to: routeToStep, comment },
      ipAddress
    ).catch((error) => {
      console.error('Failed to create audit log for workflow approval:', error);
    });

    // Resolve approvers for routed step
    const approvers = await resolveApprovers(routeToStep, instanceId, locationId, {
      stepConfig: targetStep,
    });

    for (const approverId of approvers) {
      await NotificationHelpers.notifyWorkflowStepAssignment(
        approverId,
        instanceId,
        instance.resource_type,
        instance.resource_id,
        routeToStep
      ).catch((error) => {
        console.error(`Failed to notify approver ${approverId}:`, error);
      });
    }

    return;
  }

  // Check if this is the last step
  const isLastStep = instance.current_step_order === instance.template.steps[instance.template.steps.length - 1].step_order;

  if (isLastStep) {
    // Finalize workflow
    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status: 'Approved',
      },
    });

    const afterState = {
      status: 'Approved',
      current_step_order: instance.current_step_order,
      step_status: 'approved',
    };

    await AuditHelpers.logWorkflowAction(
      userId,
      'approve',
      instanceId,
      instance.resource_type,
      instance.resource_id,
      beforeState,
      afterState,
      { step_order: instance.current_step_order, comment },
      ipAddress
    ).catch((error) => {
      console.error('Failed to create audit log for workflow approval:', error);
    });

    // Update resource status
    if (instance.resource_type === 'leave') {
      await prisma.leaveRequest.update({
        where: { id: instance.resource_id },
        data: { status: 'Approved' },
      });
    } else if (instance.resource_type === 'timesheet') {
      await prisma.timesheet.update({
        where: { id: instance.resource_id },
        data: { status: 'Approved' },
      });
    }
  } else {
    // Move to next step
    const nextStep = instance.template.steps.find(
      (s) => s.step_order > instance.current_step_order
    );

    if (nextStep) {
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'UnderReview',
          current_step_order: nextStep.step_order,
        },
      });

      const afterState = {
        status: 'UnderReview',
        current_step_order: nextStep.step_order,
        step_status: 'approved',
      };

      await AuditHelpers.logWorkflowAction(
        userId,
        'approve',
        instanceId,
        instance.resource_type,
        instance.resource_id,
        beforeState,
        afterState,
        { step_order: instance.current_step_order, next_step_order: nextStep.step_order, comment },
        ipAddress
      ).catch((error) => {
        console.error('Failed to create audit log for workflow approval:', error);
      });

      // Resolve approvers for next step using step configuration
      const approvers = await resolveApprovers(nextStep.step_order, instanceId, locationId, {
        stepConfig: nextStep,
      });

      for (const approverId of approvers) {
        await NotificationHelpers.notifyWorkflowStepAssignment(
          approverId,
          instanceId,
          instance.resource_type,
          instance.resource_id,
          nextStep.step_order
        ).catch((error) => {
          console.error(`Failed to notify approver ${approverId}:`, error);
        });
      }
    }
  }
}

/**
 * Decline a workflow step
 */
export async function declineWorkflowStep(params: WorkflowActionParams): Promise<void> {
  const { instanceId, userId, locationId, comment, ipAddress, userAgent } = params;

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      template: {
        include: {
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      },
    },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  if (instance.status === 'Approved' || instance.status === 'Declined') {
    throw new Error('Workflow instance is already finalized');
  }

  const currentStep = instance.template.steps.find(
    (s) => s.step_order === instance.current_step_order
  );

  if (!currentStep) {
    throw new Error('Current workflow step not found');
  }

  if (!currentStep.allow_decline) {
    throw new Error('This step does not allow decline');
  }

  // Check authority
  const authority = await checkAuthority({
    userId,
    permission: currentStep.required_permission,
    locationId,
    workflowStepOrder: instance.current_step_order,
    workflowInstanceId: instanceId,
  });

  if (!authority.authorized) {
    throw new Error('You do not have authority to decline this step');
  }

  // Update step instance
  const beforeState = {
    status: instance.status,
    current_step_order: instance.current_step_order,
  };

  await prisma.workflowStepInstance.update({
    where: {
      workflow_instance_id_step_order: {
        workflow_instance_id: instanceId,
        step_order: instance.current_step_order,
      },
    },
    data: {
      status: 'declined',
      acted_by: userId,
      acted_at: new Date(),
      comment: comment || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      digital_signature: await generateDigitalSignature(userId, instanceId, 'decline'),
    },
  });

  // Decline workflow
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      status: 'Declined',
    },
  });

  const afterState = {
    status: 'Declined',
    current_step_order: instance.current_step_order,
    step_status: 'declined',
  };

  await AuditHelpers.logWorkflowAction(
    userId,
    'decline',
    instanceId,
    instance.resource_type,
    instance.resource_id,
    beforeState,
    afterState,
    { step_order: instance.current_step_order, comment },
    ipAddress
  ).catch((error) => {
    console.error('Failed to create audit log for workflow decline:', error);
  });

  // Update resource status
  if (instance.resource_type === 'leave') {
    await prisma.leaveRequest.update({
      where: { id: instance.resource_id },
      data: { status: 'Declined' },
    });
  } else if (instance.resource_type === 'timesheet') {
    await prisma.timesheet.update({
      where: { id: instance.resource_id },
      data: { status: 'Declined' },
    });
  }
}

/**
 * Adjust a workflow step (send back for revision)
 */
export async function adjustWorkflowStep(params: WorkflowActionParams): Promise<void> {
  const { instanceId, userId, locationId, comment, routeToStep, ipAddress, userAgent } = params;

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      template: {
        include: {
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      },
    },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  if (instance.status === 'Approved' || instance.status === 'Declined') {
    throw new Error('Workflow instance is already finalized');
  }

  const currentStep = instance.template.steps.find(
    (s) => s.step_order === instance.current_step_order
  );

  if (!currentStep) {
    throw new Error('Current workflow step not found');
  }

  if (!currentStep.allow_adjust) {
    throw new Error('This step does not allow adjustment');
  }

  // Check authority
  const authority = await checkAuthority({
    userId,
    permission: currentStep.required_permission,
    locationId,
    workflowStepOrder: instance.current_step_order,
    workflowInstanceId: instanceId,
  });

  if (!authority.authorized) {
    throw new Error('You do not have authority to adjust this step');
  }

  // Update step instance
  const beforeState = {
    status: instance.status,
    current_step_order: instance.current_step_order,
  };

  await prisma.workflowStepInstance.update({
    where: {
      workflow_instance_id_step_order: {
        workflow_instance_id: instanceId,
        step_order: instance.current_step_order,
      },
    },
    data: {
      status: 'adjusted',
      acted_by: userId,
      acted_at: new Date(),
      comment: comment || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      digital_signature: await generateDigitalSignature(userId, instanceId, 'adjust'),
    },
  });

  // Route to specific step or back to first step
  const targetStepOrder = routeToStep !== null && routeToStep !== undefined 
    ? routeToStep 
    : instance.template.steps[0].step_order;

  const targetStep = instance.template.steps.find((s) => s.step_order === targetStepOrder);
  if (!targetStep) {
    throw new Error('Target step not found');
  }

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      status: 'Adjusted',
      current_step_order: targetStepOrder,
    },
  });

  const afterState = {
    status: 'Adjusted',
    current_step_order: targetStepOrder,
    step_status: 'adjusted',
  };

  await AuditHelpers.logWorkflowAction(
    userId,
    'adjust',
    instanceId,
    instance.resource_type,
    instance.resource_id,
    beforeState,
    afterState,
    { step_order: instance.current_step_order, routed_to: targetStepOrder, comment },
    ipAddress
  ).catch((error) => {
    console.error('Failed to create audit log for workflow adjustment:', error);
  });

  // Resolve approvers for target step
  const approvers = await resolveApprovers(targetStepOrder, instanceId, locationId, {
    stepConfig: targetStep,
  });

  for (const approverId of approvers) {
    await NotificationHelpers.notifyWorkflowStepAssignment(
      approverId,
      instanceId,
      instance.resource_type,
      instance.resource_id,
      targetStepOrder
    ).catch((error) => {
      console.error(`Failed to notify approver ${approverId}:`, error);
    });
  }

  // Update resource status
  if (instance.resource_type === 'leave') {
    await prisma.leaveRequest.update({
      where: { id: instance.resource_id },
      data: { status: 'Adjusted' },
    });
  } else if (instance.resource_type === 'timesheet') {
    await prisma.timesheet.update({
      where: { id: instance.resource_id },
      data: { status: 'Adjusted' },
    });
  }
}
