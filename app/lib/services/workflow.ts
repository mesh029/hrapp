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

export interface FindWorkflowTemplateParams {
  resourceType: ResourceType;
  locationId: string;
  staffTypeId?: string | null;
  leaveTypeId?: string | null; // Only for leave workflows
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
 * Find the best matching workflow template based on resource type, location, staff type, and leave type
 * Priority: Most specific match wins
 * 
 * Matching priority:
 * 0. EXPLICIT ASSIGNMENTS (highest priority):
 *    - Check for active template assignment for this location + resource_type
 * 1. Location-specific templates (is_area_wide = false):
 *    - All filters (location + staff_type + leave_type)
 *    - Location + staff_type
 *    - Location + leave_type (for leave)
 *    - Location only
 * 2. Area-wide templates (is_area_wide = true):
 *    - All filters (staff_type + leave_type, any location)
 *    - Staff_type only (any location)
 *    - Leave_type only (any location, for leave)
 *    - No filters (any location, any staff type, any leave type)
 */
export async function findWorkflowTemplate(params: FindWorkflowTemplateParams): Promise<string | null> {
  const { resourceType, locationId, staffTypeId, leaveTypeId } = params;

  // ===== PRIORITY 0: Check for explicit template assignment (highest priority) =====
  // Admin has explicitly assigned a template to this location for this resource type
  const assignment = await prisma.workflowTemplateAssignment.findFirst({
    where: {
      location_id: locationId,
      resource_type: resourceType,
      status: 'active',
    },
    include: {
      workflow_template: {
        where: {
          status: 'active', // Ensure the assigned template is still active
        },
      },
    },
    orderBy: { assigned_at: 'desc' }, // Most recent assignment wins if multiple
  });

  if (assignment && assignment.workflow_template) {
    return assignment.workflow_template.id;
  }

  // ===== PRIORITY 1-4: Location-specific templates (is_area_wide = false) =====
  // These templates apply only to the specific location

  // Priority 1: Match all filters (most specific location-specific)
  if (staffTypeId && (resourceType === 'leave' ? leaveTypeId : true)) {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: resourceType,
        location_id: locationId,
        is_area_wide: false, // Location-specific
        staff_type_id: staffTypeId,
        leave_type_id: resourceType === 'leave' ? leaveTypeId : null,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });

    if (template) {
      return template.id;
    }
  }

  // Priority 2: Match location + staff_type (leave_type can be null)
  if (staffTypeId) {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: resourceType,
        location_id: locationId,
        is_area_wide: false, // Location-specific
        staff_type_id: staffTypeId,
        leave_type_id: null,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });

    if (template) {
      return template.id;
    }
  }

  // Priority 3: Match location + leave_type (staff_type can be null) - only for leave
  if (resourceType === 'leave' && leaveTypeId) {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'leave',
        location_id: locationId,
        is_area_wide: false, // Location-specific
        staff_type_id: null,
        leave_type_id: leaveTypeId,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });

    if (template) {
      return template.id;
    }
  }

  // Priority 4: Match location only (no filters)
  const locationSpecificTemplate = await prisma.workflowTemplate.findFirst({
    where: {
      resource_type: resourceType,
      location_id: locationId,
      is_area_wide: false, // Location-specific
      staff_type_id: null,
      leave_type_id: null,
      status: 'active',
    },
    orderBy: { version: 'desc' },
  });

  if (locationSpecificTemplate) {
    return locationSpecificTemplate.id;
  }

  // ===== PRIORITY 5-8: Area-wide templates (is_area_wide = true) =====
  // These templates apply to all locations, but may still filter by staff_type/leave_type

  // Priority 5: Match area-wide with all filters (staff_type + leave_type)
  if (staffTypeId && (resourceType === 'leave' ? leaveTypeId : true)) {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: resourceType,
        is_area_wide: true, // Area-wide
        staff_type_id: staffTypeId,
        leave_type_id: resourceType === 'leave' ? leaveTypeId : null,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });

    if (template) {
      return template.id;
    }
  }

  // Priority 6: Match area-wide + staff_type (leave_type can be null)
  if (staffTypeId) {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: resourceType,
        is_area_wide: true, // Area-wide
        staff_type_id: staffTypeId,
        leave_type_id: null,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });

    if (template) {
      return template.id;
    }
  }

  // Priority 7: Match area-wide + leave_type (staff_type can be null) - only for leave
  if (resourceType === 'leave' && leaveTypeId) {
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'leave',
        is_area_wide: true, // Area-wide
        staff_type_id: null,
        leave_type_id: leaveTypeId,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });

    if (template) {
      return template.id;
    }
  }

  // Priority 8: Match area-wide with no filters (applies to all locations, all staff types, all leave types)
  const areaWideTemplate = await prisma.workflowTemplate.findFirst({
    where: {
      resource_type: resourceType,
      is_area_wide: true, // Area-wide
      staff_type_id: null,
      leave_type_id: null,
      status: 'active',
    },
    orderBy: { version: 'desc' },
  });

  return areaWideTemplate?.id || null;
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
        select: {
          id: true,
          name: true,
          location_id: true, // Explicitly include location_id
          is_area_wide: true, // Include area-wide flag
          resource_type: true,
          status: true,
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
  // For 'combined' strategy, always include manager if not explicitly disabled
  // This ensures managers are included when using combined strategy
  const includeManager = stepConfig.include_manager !== undefined 
    ? stepConfig.include_manager 
    : (approverStrategy === 'combined' ? true : (options?.includeEmployeeManager || false));
  // Default to 'all' to match UI behavior - if no location is specified, allow any location
  // Handle null, undefined, empty string, or falsy values
  const locationScope = (stepConfig.location_scope && typeof stepConfig.location_scope === 'string' && stepConfig.location_scope.trim() !== '') 
    ? stepConfig.location_scope 
    : 'all';
  
  // IMPORTANT: For location_scope checks, use the template's location as the reference point
  // This matches the workflow template settings and ensures consistency
  // The template.location_id is the base location for this workflow template
  // However, if is_area_wide is true, we should treat location_scope as 'all' for all checks
  const templateLocationId = instance.template.location_id;
  const isAreaWide = (instance.template as any).is_area_wide || false;
  
  // If template is area-wide, override location_scope to 'all' for all steps
  // This ensures approvers from any location can approve
  const effectiveLocationScope = isAreaWide ? 'all' : locationScope;
  
  // Safety check: If template location is missing, log a warning and use fallback
  if (!templateLocationId) {
    console.warn(`[Workflow] ⚠️ Template ${instance.template.id} has no location_id! Using fallback location.`);
    console.warn(`[Workflow] Template data:`, {
      id: instance.template.id,
      name: instance.template.name,
      location_id: instance.template.location_id,
    });
  }
  
  console.log(`[Workflow] Template location scope:`, {
    isAreaWide,
    originalLocationScope: locationScope,
    effectiveLocationScope,
    templateLocationId,
  });
  
  console.log(`[Workflow] Step ${stepOrder} configuration:`, {
    approverStrategy,
    includeManager,
    locationScope,
    requiredPermission: stepConfig.required_permission,
    requiredRoles: requiredRoles,
    employeeManagerId: instance.creator.manager_id,
    templateLocationId,
    note: 'Location scope checks use template location as reference',
  });

  const approverSet = new Set<string>();

  // Check if manager has already approved a previous step in this workflow
  // Get all step instances for this workflow to check if manager already approved
  const previousStepInstances = await prisma.workflowStepInstance.findMany({
    where: {
      workflow_instance_id: workflowInstanceId,
      step_order: { lt: stepOrder }, // Only check previous steps
      status: { in: ['approved', 'declined'] }, // Only check completed steps
    },
    select: {
      step_order: true,
      acted_by: true,
      status: true,
    },
  });

  // Get manager ID if employee has one
  const managerId = instance.creator.manager_id;
  const managerAlreadyApproved = managerId && previousStepInstances.some(
    step => step.acted_by === managerId && step.status === 'approved'
  );

  // Get list of all users who have already approved previous steps
  // This prevents the same user from approving multiple steps
  const usersWhoAlreadyApproved = new Set(
    previousStepInstances
      .filter(step => step.status === 'approved')
      .map(step => step.acted_by)
      .filter((id): id is string => id !== null)
  );
  
  console.log(`[Workflow] Users who already approved previous steps:`, Array.from(usersWhoAlreadyApproved));

  // Strategy 1: Manager-based resolution
  // IMPORTANT: This resolves the SPECIFIC manager of the employee who created the leave/timesheet
  // It does NOT resolve all managers in the system - only the manager of instance.creator
  // For 'manager' strategy: ONLY include manager (no roles, no permission-based) - RETURN EARLY after this
  // For 'combined' strategy: Include manager if includeManager is true, then continue to role-based
  // For 'role' strategy with includeManager: Include manager in addition to roles, then continue to role-based
  const isManagerOnlyStrategy = approverStrategy === 'manager';
  const shouldIncludeManager = isManagerOnlyStrategy || (approverStrategy === 'combined' && includeManager) || (approverStrategy === 'role' && includeManager);
  
  if (shouldIncludeManager) {
    // Get the employee who created this leave/timesheet (instance.creator)
    const employee = instance.creator;
    console.log(`[Workflow] Manager resolution check for step ${stepOrder}:`, {
      approverStrategy,
      includeManager,
      employeeId: employee?.id,
      employeeName: employee?.id, // Will be logged as employee name if available
      employeeHasManager: !!employee?.manager_id,
      managerId: employee?.manager_id,
    });
    
    // Only resolve the manager of THIS specific employee (not all managers)
    if (employee && employee.manager_id) {
      // Skip manager if they've already approved a previous step
      if (managerAlreadyApproved) {
        console.log(`[Workflow] Manager ${employee.manager_id} already approved a previous step, excluding from step ${stepOrder}`);
      } else {
        // Look up ONLY the specific manager of this employee (employee.manager_id)
        // This ensures we get the correct manager for the employee who created the leave/timesheet
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

        console.log(`[Workflow] Manager lookup result:`, {
          found: !!manager,
          name: manager?.name,
          status: manager?.status,
          deleted: !!manager?.deleted_at,
          hasRoles: manager?.user_roles?.length || 0,
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

          console.log(`[Workflow] Manager permission check:`, {
            requiredPermission: stepConfig.required_permission,
            hasPermission,
            managerRoles: manager.user_roles.map(ur => ur.role.name),
          });

          if (hasPermission) {
            // Check location scope and authority
            // Use template location as reference for location_scope checks (from workflow template settings)
            const managerLocationId = manager.primary_location_id;
            const referenceLocationId = templateLocationId || locationId; // Template location is the reference
            const shouldInclude = await checkLocationScope(managerLocationId, referenceLocationId, effectiveLocationScope);
            
            console.log(`[Workflow] Location scope check:`, {
              managerLocationId,
              templateLocationId: referenceLocationId,
              locationScope,
              shouldInclude,
              note: 'Using template location as reference for location_scope',
            });
            
            if (shouldInclude) {
              // For managers, we can be more lenient with authority check
              // Managers should be able to approve if they have the permission and location matches
              // The authority check might be too strict for simulation scenarios
              // IMPORTANT: For manager-only steps or when include_manager is true, we should include
              // the manager even if UserPermissionScope is missing, as long as they have the role permission
              try {
                const authority = await checkAuthority({
                  userId: manager.id,
                  permission: stepConfig.required_permission,
                  locationId: managerLocationId || referenceLocationId, // Use manager's location or template location
                  workflowStepOrder: stepOrder,
                  workflowInstanceId,
                });

                console.log(`[Workflow] Authority check:`, {
                  authorized: authority.authorized,
                  source: authority.source,
                });

                if (authority.authorized) {
                  approverSet.add(manager.id);
                  console.log(`[Workflow] ✅ Manager ${manager.name} (${manager.id}) added as approver for step ${stepOrder}`);
                } else {
                  // If authority check fails but manager has permission and location matches,
                  // still include them (authority check might be too strict for simulation)
                  // This is especially important for manager-only steps where the manager MUST be included
                  console.log(`[Workflow] ⚠️ Manager ${manager.name} failed authority check, but has permission - including anyway for manager-based resolution`);
                  approverSet.add(manager.id);
                  console.log(`[Workflow] ✅ Manager ${manager.name} (${manager.id}) added as approver for step ${stepOrder} (bypassed strict authority check)`);
                }
              } catch (authError: any) {
                // If authority check throws an error, still include manager if they have permission
                // This ensures managers are not excluded due to missing UserPermissionScope entries
                console.log(`[Workflow] ⚠️ Authority check error for manager ${manager.name}:`, authError.message);
                console.log(`[Workflow] ✅ Manager ${manager.name} (${manager.id}) added as approver for step ${stepOrder} (bypassed authority check due to error)`);
                approverSet.add(manager.id);
              }
            } else {
              console.log(`[Workflow] ❌ Manager ${manager.name} excluded due to location scope`);
              // If location scope is 'all', this should never happen, so log a warning
              if (locationScope === 'all') {
                console.log(`[Workflow] ⚠️ WARNING: Location scope is 'all' but manager was excluded! This should not happen.`);
                console.log(`[Workflow] ⚠️ Manager location: ${managerLocationId}, Reference location: ${referenceLocationId}`);
                // Still include the manager if location_scope is 'all' (safety fallback)
                console.log(`[Workflow] ✅ Manager ${manager.name} (${manager.id}) added as approver for step ${stepOrder} (location_scope is 'all', bypassing location check)`);
                approverSet.add(manager.id);
              }
            }
          } else {
            console.log(`[Workflow] ❌ Manager ${manager.name} doesn't have permission ${stepConfig.required_permission}`);
            console.log(`[Workflow] Manager's roles:`, manager.user_roles.map(ur => ur.role.name).join(', ') || 'None');
            console.log(`[Workflow] Manager's permissions:`, manager.user_roles.flatMap(ur => 
              ur.role.role_permissions.map(rp => rp.permission.name)
            ).join(', ') || 'None');
          }
        } else {
          console.log(`[Workflow] ❌ Manager not found, inactive, or deleted`);
        }
      }
    } else {
      console.log(`[Workflow] ❌ Employee has no manager_id`);
    }
  } else {
    console.log(`[Workflow] Manager resolution skipped (strategy: ${approverStrategy}, includeManager: ${includeManager})`);
  }

  // IMPORTANT: If strategy is 'manager' (manager-only), return early - do NOT continue to role/permission-based resolution
  // This ensures only the employee's manager is included, not all users with the permission
  if (approverStrategy === 'manager') {
    console.log(`[Workflow] Manager-only strategy: Returning early with ${approverSet.size} approver(s). Skipping role/permission-based resolution.`);
    return Array.from(approverSet);
  }

  // Strategy 2: Role-based resolution
  // Only include role-based approvers if:
  // 1. Strategy is 'role' or 'combined' (NOT 'manager')
  // 2. Required roles are specified
  // IMPORTANT: If strategy is 'role' but no roles are specified, skip role-based resolution
  // This prevents falling back to permission-based which would find all users
  if ((approverStrategy === 'role' || approverStrategy === 'combined') && requiredRoles.length > 0) {
    console.log(`[Workflow] Role-based resolution for step ${stepOrder}:`, {
      requiredRoles,
      locationScope,
      requiredPermission: stepConfig.required_permission,
    });

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

    console.log(`[Workflow] Found ${roleUsers.length} users with required roles and permission`);

    for (const roleUser of roleUsers) {
      // Skip if this user has already approved a previous step
      if (usersWhoAlreadyApproved.has(roleUser.id)) {
        console.log(`[Workflow] ⚠️ Role user ${roleUser.name} (${roleUser.id}) already approved a previous step, excluding from step ${stepOrder}`);
        continue;
      }

      const userLocationId = roleUser.primary_location_id;
      // Use template location as reference for location_scope checks (from workflow template settings)
      const referenceLocationId = templateLocationId || locationId;
      const shouldInclude = await checkLocationScope(userLocationId, referenceLocationId, effectiveLocationScope);

      console.log(`[Workflow] Role user ${roleUser.name} (${roleUser.id}):`, {
        userLocationId,
        templateLocationId: referenceLocationId,
        locationScope,
        shouldInclude,
        note: 'Using template location as reference for location_scope',
      });

      if (shouldInclude) {
        const authority = await checkAuthority({
          userId: roleUser.id,
          permission: stepConfig.required_permission,
          locationId: userLocationId,
          workflowStepOrder: stepOrder,
          workflowInstanceId,
        });

        console.log(`[Workflow] Authority check for ${roleUser.name}:`, {
          authorized: authority.authorized,
          source: authority.source,
        });

        if (authority.authorized) {
          approverSet.add(roleUser.id);
          console.log(`[Workflow] ✅ Role user ${roleUser.name} (${roleUser.id}) added as approver for step ${stepOrder}`);
        } else {
          // For role-based approvers, be more lenient - if they have the role and permission, include them
          // The authority check requires UserPermissionScope entries, but for role-based workflow steps,
          // we should trust that if the role has the permission, the user can approve
          const hasPermission = roleUser.user_roles.some(ur =>
            ur.role.status === 'active' &&
            ur.role.role_permissions.some(rp =>
              rp.permission.name === stepConfig.required_permission || 
              rp.permission.id === stepConfig.required_permission
            )
          );
          
          if (hasPermission) {
            // User has the required role with the required permission
            // For role-based workflow steps, this is sufficient even without UserPermissionScope
            console.log(`[Workflow] ⚠️ Role user ${roleUser.name} failed strict authority check (likely missing UserPermissionScope), but has role and permission - including anyway for role-based step`);
            approverSet.add(roleUser.id);
            console.log(`[Workflow] ✅ Role user ${roleUser.name} (${roleUser.id}) added as approver for step ${stepOrder} (bypassed strict authority check - role-based step)`);
          } else {
            console.log(`[Workflow] ❌ Role user ${roleUser.name} failed authority check and doesn't have permission through role`);
          }
        }
      } else {
        console.log(`[Workflow] ❌ Role user ${roleUser.name} excluded due to location scope`);
      }
    }
    
    // IMPORTANT: If roles are specified, return early after role-based resolution
    // Do NOT continue to permission-based resolution - roles are categorical
    // Only users with the specified roles should be included, not all users with the permission
    if (requiredRoles.length > 0 && approverStrategy === 'role') {
      console.log(`[Workflow] Role-based strategy with required roles: Returning with ${approverSet.size} approver(s). Skipping permission-based resolution (roles are categorical).`);
      return Array.from(approverSet);
    }
  }

  // Strategy 3: Permission-based resolution (fallback or primary)
  // IMPORTANT: When roles are specified, we should ONLY use role-based resolution
  // Permission-based should NOT run if requiredRoles.length > 0, even for 'combined' strategy
  // This ensures that when roles are selected, only users with those specific roles are included
  // 
  // Only use permission-based resolution if:
  //   1. Strategy is explicitly 'permission' (permission-based only)
  //   2. Strategy is 'role' but NO roles are specified (fallback to permission-based)
  //   3. Strategy is 'combined' but NO roles are specified AND manager is not included (fallback)
  //
  // Do NOT use permission-based if:
  //   - Strategy is 'manager' (manager-only steps - already returned early)
  //   - Required roles are specified (roles are categorical - must have the role)
  //   - Strategy is 'combined' with roles specified (use role-based only, not permission-based)
  const hasRequiredRoles = requiredRoles.length > 0;
  const isEffectivelyManagerOnly = 
    approverStrategy === 'manager' || 
    (approverStrategy === 'combined' && includeManager && !hasRequiredRoles);
    
  // Permission-based should ONLY run if:
  // 1. Strategy is 'permission' (explicitly permission-based)
  // 2. Strategy is 'role' but no roles specified (fallback)
  // 3. Strategy is 'combined' but no roles AND no manager (fallback)
  // AND never when roles are specified (roles are categorical - must have the role)
  // IMPORTANT: When roles are specified, permission-based resolution is NEVER used
  // Roles are categorical - you MUST have the role to approve, permission alone is not enough
  const shouldUsePermissionBased = 
    !hasRequiredRoles && // NEVER use permission-based when roles are specified (roles are categorical)
    approverStrategy !== 'combined' && // NEVER use permission-based for 'combined' strategy (use manager + role-based only)
    (
      approverStrategy === 'permission' || // Explicitly permission-based
      (approverStrategy === 'role' && !hasRequiredRoles) // Role strategy with no roles (fallback)
    ) &&
    !isEffectivelyManagerOnly; // Never for manager-only
    
  if (shouldUsePermissionBased) {
    console.log(`[Workflow] Permission-based resolution for step ${stepOrder} (no roles specified, using permission fallback)`);
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

    for (const permUser of permissionUsers) {
      // Exclude system administrators unless they're also the manager or have a required role
      const isSystemAdmin = permUser.user_roles.some(ur =>
        ur.role.status === 'active' &&
        ur.role.role_permissions.some(rp => rp.permission.name === 'system.admin')
      );

      // Skip system admins unless they're the manager or have required role
      if (isSystemAdmin) {
        const isManager = instance.creator.manager_id === permUser.id;
        const hasRequiredRole = requiredRoles.length > 0 && 
          permUser.user_roles.some(ur => requiredRoles.includes(ur.role_id));
        
        // Only include if they're the manager or have required role
        if (!isManager && !hasRequiredRole) {
          continue; // Skip this system admin
        }
      }

      // Skip if this user has already approved a previous step
      if (usersWhoAlreadyApproved.has(permUser.id)) {
        console.log(`[Workflow] ⚠️ Permission user ${permUser.name} (${permUser.id}) already approved a previous step, excluding from step ${stepOrder}`);
        continue;
      }

      const userLocationId = permUser.primary_location_id;
      // Use template location as reference for location_scope checks (from workflow template settings)
      const referenceLocationId = templateLocationId || locationId;
      const shouldInclude = await checkLocationScope(userLocationId, referenceLocationId, effectiveLocationScope);

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
  requiredLocationId: string | null,
  scope: 'same' | 'parent' | 'descendants' | 'all'
): Promise<boolean> {
  // If scope is 'all', always return true (no location restrictions)
  if (scope === 'all') {
    return true;
  }

  // If user has no location, they can't match location-based scopes (except 'all' which we already handled)
  if (!userLocationId) {
    return false;
  }

  // If required location is missing and scope is not 'all', we can't validate
  // This should not happen in normal operation, but we'll be defensive
  if (!requiredLocationId) {
    console.warn(`[Workflow] ⚠️ checkLocationScope: requiredLocationId is null/undefined but scope is '${scope}'. Returning false.`);
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
