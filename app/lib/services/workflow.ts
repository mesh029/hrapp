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

  // Move to first step
  const firstStep = instance.template.steps[0];
  if (!firstStep) {
    throw new Error('Workflow template has no steps');
  }

  const beforeState = { status: instance.status, current_step_order: instance.current_step_order };
  
  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      status: 'Submitted',
      current_step_order: firstStep.step_order,
    },
  });

  const afterState = { status: 'Submitted', current_step_order: firstStep.step_order };

  // Get locationId from resource
  let locationId = '';
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
  }

  // Audit log
  await AuditHelpers.logWorkflowAction(
    instance.created_by,
    'submit',
    instanceId,
    instance.resource_type,
    instance.resource_id,
    beforeState,
    afterState,
    { step_order: firstStep.step_order },
    undefined
  ).catch((error) => {
    console.error('Failed to create audit log for workflow submit:', error);
  });

  // Notify first step approvers
  if (locationId) {
    const approvers = await resolveApprovers(firstStep.step_order, instanceId, locationId, {
      includeEmployeeManager: true,
    });

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
}

/**
 * Resolve approvers for a workflow step
 * Returns users who have the required permission for the location
 * 
 * Note: The workflow instance's `created_by` is the EMPLOYEE (Regular, Temp, HRH, etc.)
 * who submitted the leave request or timesheet. Their manager can be included as an approver.
 * 
 * @param stepOrder - The workflow step order
 * @param workflowInstanceId - The workflow instance ID
 * @param locationId - The location ID for scope checking
 * @param options - Optional configuration
 * @param options.includeEmployeeManager - If true, includes the employee's manager as an approver (if they have permission)
 */
export async function resolveApprovers(
  stepOrder: number,
  workflowInstanceId: string,
  locationId: string,
  options?: {
    includeEmployeeManager?: boolean; // Include the employee's (creator's) manager as approver
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
    },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  const step = instance.template.steps.find((s: any) => s.step_order === stepOrder);
  if (!step) {
    throw new Error('Workflow step not found');
  }

  // Find all users with the required permission for this location
  const usersWithPermission = await prisma.user.findMany({
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
                    { id: step.required_permission },
                    { name: step.required_permission },
                  ],
                },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  // Filter users by authority check (location scope)
  const approverSet = new Set<string>(); // Use Set to avoid duplicates

  for (const user of usersWithPermission) {
    const authority = await checkAuthority({
      userId: user.id,
      permission: step.required_permission,
      locationId,
      workflowStepOrder: stepOrder,
      workflowInstanceId,
    });

    if (authority.authorized) {
      approverSet.add(user.id);
    }
  }

  // Optionally include employee's manager if they have the permission
  // Note: instance.created_by is the EMPLOYEE who submitted the request (not admin/template creator)
  if (options?.includeEmployeeManager) {
    // Get the employee (who created this workflow instance by submitting their request)
    const employee = await prisma.user.findUnique({
      where: { id: instance.created_by },
    });

    // Check if employee has a manager assigned
    const managerId = (employee as any)?.manager_id;
    if (employee && managerId) {
      
      // Check if manager is already in the list
      if (!approverSet.has(managerId)) {
        // Check if manager has the required permission and authority
        const managerAuthority = await checkAuthority({
          userId: managerId,
          permission: step.required_permission,
          locationId,
          workflowStepOrder: stepOrder,
          workflowInstanceId,
        });

        if (managerAuthority.authorized) {
          approverSet.add(managerId);
        }
      }
    }
  }

  return Array.from(approverSet);
}

/**
 * Approve a workflow step
 */
export async function approveWorkflowStep(params: WorkflowActionParams): Promise<void> {
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

  if (instance.status !== 'Submitted' && instance.status !== 'UnderReview') {
    throw new Error('Workflow instance is not in a reviewable state');
  }

  const currentStep = instance.template.steps.find(
    (s) => s.step_order === instance.current_step_order
  );

  if (!currentStep) {
    throw new Error('Current workflow step not found');
  }

  // Get permission name - required_permission can be either an ID or a name
  // Check if it's a UUID (ID) or a string (name)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentStep.required_permission);
  
  let permissionName: string;
  if (isUUID) {
    // It's an ID, look it up
    const permission = await prisma.permission.findUnique({
      where: { id: currentStep.required_permission },
      select: { name: true },
    });

    if (!permission) {
      throw new Error('Permission not found for workflow step');
    }
    permissionName = permission.name;
  } else {
    // It's already a name, use it directly
    permissionName = currentStep.required_permission;
    
    // Verify the permission exists
    const permission = await prisma.permission.findFirst({
      where: { name: permissionName },
    });

    if (!permission) {
      throw new Error(`Permission "${permissionName}" not found for workflow step`);
    }
  }

  // Check authority
  const authority = await checkAuthority({
    userId,
    permission: permissionName,
    locationId,
    workflowStepOrder: instance.current_step_order,
    workflowInstanceId: instanceId,
  });

  if (!authority.authorized) {
    throw new Error('User does not have permission to approve this step');
  }

  // Generate digital signature
  const signature = await generateDigitalSignature({
    userId,
    workflowInstanceId: instanceId,
    stepOrder: instance.current_step_order,
    action: 'approve',
    timestamp: new Date(),
  });

  // Update step instance
  await prisma.workflowStepInstance.updateMany({
    where: {
      workflow_instance_id: instanceId,
      step_order: instance.current_step_order,
    },
    data: {
      status: 'approved',
      acted_by: userId,
      acted_at: new Date(),
      comment: comment || null,
      digital_signature: signature.token,
      signature_hash: signature.hash,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    },
  });

  // Capture before state for audit log
  const beforeState = {
    status: instance.status,
    current_step_order: instance.current_step_order,
    step_status: 'pending',
  };

  // Check if this is the last step
  const lastStep = instance.template.steps[instance.template.steps.length - 1];
  const isLastStep = instance.current_step_order === lastStep.step_order;

  if (isLastStep) {
    // Final approval - mark workflow as approved
    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status: 'Approved',
        current_step_order: instance.current_step_order,
      },
    });

    const afterState = {
      status: 'Approved',
      current_step_order: instance.current_step_order,
      step_status: 'approved',
    };

    // Audit log
    await AuditHelpers.logWorkflowAction(
      userId,
      'approve',
      instanceId,
      instance.resource_type,
      instance.resource_id,
      beforeState,
      afterState,
      { step_order: instance.current_step_order, is_final: true, comment },
      ipAddress
    ).catch((error) => {
      console.error('Failed to create audit log for workflow approval:', error);
    });

    // Notify requester of completion
    await NotificationHelpers.notifyWorkflowComplete(
      instance.created_by,
      instanceId,
      instance.resource_type,
      instance.resource_id,
      'Approved'
    ).catch((error) => {
      console.error('Failed to notify requester of approval:', error);
    });

    // Handle resource-specific approval logic
    if (instance.resource_type === 'leave') {
      const { handleLeaveRequestApproval } = await import('./leave-workflow');
      await handleLeaveRequestApproval(instanceId);
    }
    // TODO: Add timesheet approval handling in Phase 6
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

      // Audit log
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

      // Notify next step approvers
      const approvers = await resolveApprovers(nextStep.step_order, instanceId, locationId, {
        includeEmployeeManager: true,
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

  if (!comment) {
    throw new Error('Comment is required for decline');
  }

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

  if (instance.status !== 'Submitted' && instance.status !== 'UnderReview') {
    throw new Error('Workflow instance is not in a reviewable state');
  }

  const currentStep = instance.template.steps.find(
    (s) => s.step_order === instance.current_step_order
  );

  if (!currentStep) {
    throw new Error('Current workflow step not found');
  }

  if (!currentStep.allow_decline) {
    throw new Error('This workflow step does not allow decline');
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
    throw new Error('User does not have permission to decline this step');
  }

  // Generate digital signature
  const signature = await generateDigitalSignature({
    userId,
    workflowInstanceId: instanceId,
    stepOrder: instance.current_step_order,
    action: 'decline',
    timestamp: new Date(),
  });

  // Update step instance
  await prisma.workflowStepInstance.updateMany({
    where: {
      workflow_instance_id: instanceId,
      step_order: instance.current_step_order,
    },
    data: {
      status: 'declined',
      acted_by: userId,
      acted_at: new Date(),
      comment,
      digital_signature: signature.token,
      signature_hash: signature.hash,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    },
  });

  // Capture before state for audit log
  const beforeState = {
    status: instance.status,
    current_step_order: instance.current_step_order,
    step_status: 'pending',
  };

  // Mark workflow as declined
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

  // Audit log
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

  // Notify requester of decline
  await NotificationHelpers.notifyWorkflowComplete(
    instance.created_by,
    instanceId,
    instance.resource_type,
    instance.resource_id,
    'Declined'
  ).catch((error) => {
    console.error('Failed to notify requester of decline:', error);
  });

  // Handle resource-specific decline logic
  if (instance.resource_type === 'leave') {
    const { handleLeaveRequestDecline } = await import('./leave-workflow');
    await handleLeaveRequestDecline(instanceId);
  }
  // TODO: Add timesheet decline handling in Phase 6
}

/**
 * Adjust a workflow step (route back to a previous step or to employee)
 */
export async function adjustWorkflowStep(params: WorkflowActionParams): Promise<void> {
  const { instanceId, userId, locationId, comment, routeToStep, ipAddress, userAgent } = params;

  if (!comment) {
    throw new Error('Comment is required for adjust');
  }

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

  if (instance.status !== 'Submitted' && instance.status !== 'UnderReview') {
    throw new Error('Workflow instance is not in a reviewable state');
  }

  const currentStep = instance.template.steps.find(
    (s) => s.step_order === instance.current_step_order
  );

  if (!currentStep) {
    throw new Error('Current workflow step not found');
  }

  if (!currentStep.allow_adjust) {
    throw new Error('This workflow step does not allow adjust');
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
    throw new Error('User does not have permission to adjust this step');
  }

  // Generate digital signature
  const signature = await generateDigitalSignature({
    userId,
    workflowInstanceId: instanceId,
    stepOrder: instance.current_step_order,
    action: 'adjust',
    timestamp: new Date(),
  });

  // Update step instance
  await prisma.workflowStepInstance.updateMany({
    where: {
      workflow_instance_id: instanceId,
      step_order: instance.current_step_order,
    },
    data: {
      status: 'adjusted',
      acted_by: userId,
      acted_at: new Date(),
      comment,
      digital_signature: signature.token,
      signature_hash: signature.hash,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    },
  });

  // Capture before state for audit log
  const beforeState = {
    status: instance.status,
    current_step_order: instance.current_step_order,
    step_status: 'pending',
  };

  // Route to specified step or back to Draft (employee)
  if (routeToStep !== null && routeToStep !== undefined) {
    // Route to specific step
    const targetStep = instance.template.steps.find((s) => s.step_order === routeToStep);
    if (!targetStep) {
      throw new Error('Target workflow step not found');
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
      step_status: 'adjusted',
    };

    // Audit log
    await AuditHelpers.logWorkflowAction(
      userId,
      'adjust',
      instanceId,
      instance.resource_type,
      instance.resource_id,
      beforeState,
      afterState,
      { step_order: instance.current_step_order, route_to_step: routeToStep, comment },
      ipAddress
    ).catch((error) => {
      console.error('Failed to create audit log for workflow adjust:', error);
    });

    // Notify target step approvers
    const approvers = await resolveApprovers(routeToStep, instanceId, locationId, {
      includeEmployeeManager: true,
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
  } else {
    // Route back to employee (Draft)
    await prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status: 'Adjusted',
        current_step_order: 0,
      },
    });

    const afterState = {
      status: 'Adjusted',
      current_step_order: 0,
      step_status: 'adjusted',
    };

    // Audit log
    await AuditHelpers.logWorkflowAction(
      userId,
      'adjust',
      instanceId,
      instance.resource_type,
      instance.resource_id,
      beforeState,
      afterState,
      { step_order: instance.current_step_order, route_to_employee: true, comment },
      ipAddress
    ).catch((error) => {
      console.error('Failed to create audit log for workflow adjust:', error);
    });

    // Notify requester
    // Type assertion needed: TypeScript infers method type incorrectly from object literal
    const notifyComplete = NotificationHelpers.notifyWorkflowComplete as (
      requesterId: string,
      workflowInstanceId: string,
      resourceType: string,
      resourceId: string,
      status: 'Approved' | 'Declined' | 'Adjusted'
    ) => Promise<any>;
    
    await notifyComplete(
      instance.created_by,
      instanceId,
      instance.resource_type,
      instance.resource_id,
      'Adjusted'
    ).catch((error) => {
      console.error('Failed to notify requester of adjustment:', error);
    });
  }

  // Handle resource-specific adjust logic
  if (instance.resource_type === 'leave') {
    const { handleLeaveRequestAdjust } = await import('./leave-workflow');
    await handleLeaveRequestAdjust(instanceId);
  }
  // TODO: Add timesheet adjust handling in Phase 6
}

/**
 * Cancel a workflow instance
 */
export async function cancelWorkflowInstance(instanceId: string, userId: string): Promise<void> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error('Workflow instance not found');
  }

  // Only creator can cancel
  if (instance.created_by !== userId) {
    throw new Error('Only the creator can cancel the workflow instance');
  }

  // Can only cancel if in Draft or Submitted status
  if (instance.status !== 'Draft' && instance.status !== 'Submitted') {
    throw new Error('Workflow instance cannot be cancelled in current status');
  }

  const beforeState = {
    status: instance.status,
    current_step_order: instance.current_step_order,
  };

  await prisma.workflowInstance.update({
    where: { id: instanceId },
    data: {
      status: 'Cancelled',
    },
  });

  const afterState = {
    status: 'Cancelled',
    current_step_order: instance.current_step_order,
  };

  // Audit log
  await AuditHelpers.logWorkflowAction(
    userId,
    'cancel',
    instanceId,
    instance.resource_type,
    instance.resource_id,
    beforeState,
    afterState,
    {},
    undefined
  ).catch((error) => {
    console.error('Failed to create audit log for workflow cancel:', error);
  });

  // Handle resource-specific cancel logic
  if (instance.resource_type === 'leave') {
    const { handleLeaveRequestCancel } = await import('./leave-workflow');
    await handleLeaveRequestCancel(instanceId);
  }
  // TODO: Add timesheet cancel handling in Phase 6
}
