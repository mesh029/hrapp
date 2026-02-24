import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { resolveApprovers } from '@/lib/services/workflow';
import { z } from 'zod';

const simulateSchema = z.object({
  template_id: z.string().uuid(),
  employee_id: z.string().uuid(), // Employee to create request for
  scenario_id: z.string().optional(),
});

/**
 * POST /api/workflows/test/simulate
 * Simulate a workflow execution
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });

    const locationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    
    if (!locationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Use workflows.read permission (more permissive for testing)
    try {
      await requirePermission(user, 'workflows.read', { locationId });
    } catch {
      // Fallback to workflows.templates.read if workflows.read doesn't exist
      try {
        await requirePermission(user, 'workflows.templates.read', { locationId });
      } catch {
        // For testing, allow system admin to bypass
        const isAdmin = await prisma.userRole.findFirst({
          where: {
            user_id: user.id,
            deleted_at: null,
            role: {
              status: 'active',
              role_permissions: {
                some: {
                  permission: {
                    name: 'system.admin',
                  },
                },
              },
            },
          },
        });
        if (!isAdmin) {
          return errorResponse('Forbidden: Insufficient permissions for workflow simulation', 403);
        }
      }
    }

    const body = await request.json();
    const validation = simulateSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { template_id, scenario_id } = validation.data;

    // Get template with steps
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: template_id },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
        location: {
          select: { id: true, name: true },
        },
      },
    });

    if (!template) {
      return errorResponse('Template not found', 404);
    }

    // Parse JSON fields in steps
    const stepsWithParsed = template.steps.map(step => ({
      ...step,
      required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
      conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
      // Normalize location_scope: default to 'all' if null, undefined, or empty
      location_scope: (step.location_scope && typeof step.location_scope === 'string' && step.location_scope.trim() !== '') 
        ? step.location_scope 
        : 'all',
    }));

    // Get the employee to create request for
    const employee = await prisma.user.findUnique({
      where: { id: validation.data.employee_id },
      include: {
        primary_location: true,
        staff_type: true,
      },
    });

    if (!employee || employee.status !== 'active' || employee.deleted_at) {
      return errorResponse('Employee not found or inactive', 404);
    }

    if (!employee.primary_location_id) {
      return errorResponse('Employee has no primary location', 400);
    }

    let resourceId: string;
    let resourceType = template.resource_type;

    // Create REAL leave request or timesheet
    if (template.resource_type === 'leave') {
      // Get a leave type
      const leaveType = await prisma.leaveType.findFirst({
        where: { deleted_at: null, status: 'active' },
      });

      if (!leaveType) {
        return errorResponse('No active leave type found', 400);
      }

      // Create leave request
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7); // 7 days from now
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5); // 5 days leave
      const daysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          user_id: employee.id,
          leave_type_id: leaveType.id,
          start_date: startDate,
          end_date: endDate,
          days_requested: daysRequested,
          reason: `Workflow simulation test for ${employee.name}`,
          location_id: employee.primary_location_id,
          status: 'Draft',
        },
      });

      resourceId = leaveRequest.id;
    } else {
      // Create timesheet
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() - 1); // Yesterday
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 13); // 2 weeks ago

      const { createTimesheet } = await import('@/lib/services/timesheet');
      const { id: timesheetId } = await createTimesheet({
        userId: employee.id,
        periodStart,
        periodEnd,
        locationId: employee.primary_location_id,
      });

      resourceId = timesheetId;
    }

    // Use the selected template directly (admin chose it, so use it!)
    // Don't auto-find - respect the admin's choice
    const finalTemplateId = template.id;

    // Create REAL workflow instance using the selected template
    const { createWorkflowInstance, submitWorkflowInstance } = await import('@/lib/services/workflow');
    const workflowInstanceId = await createWorkflowInstance({
      templateId: finalTemplateId,
      resourceId: resourceId,
      resourceType: template.resource_type,
      createdBy: employee.id,
      locationId: employee.primary_location_id,
    });

    // Submit the workflow (moves to first step and notifies approvers)
    // Note: submitWorkflowInstance already creates step instances, so we don't need to create them again
    await submitWorkflowInstance(workflowInstanceId);

    // Get the created instance with all details
    const tempInstance = await prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
        },
      },
    });

    if (!tempInstance) {
      return errorResponse('Failed to create workflow instance', 500);
    }

    // Step instances are already created by submitWorkflowInstance, so we don't need to create them again

    // Resolve approvers for each step
    const simulationSteps = await Promise.all(
      stepsWithParsed.map(async (step) => {
        try {
          console.log(`[Simulation] Resolving approvers for step ${step.step_order}...`);
          console.log(`[Simulation] Step config:`, {
            approver_strategy: step.approver_strategy,
            include_manager: step.include_manager,
            required_roles: step.required_roles,
            required_permission: step.required_permission,
            location_scope: step.location_scope,
          });
          console.log(`[Simulation] Employee:`, {
            id: employee.id,
            name: employee.name,
            manager_id: employee.manager_id,
            primary_location_id: employee.primary_location_id,
          });

          const approverIds = await resolveApprovers(
            step.step_order,
            tempInstance.id,
            employee.primary_location_id || template.location_id || locationId || '',
            {
              stepConfig: step,
              includeEmployeeManager: step.include_manager || false,
            }
          );
          console.log(`[Simulation] Step ${step.step_order} resolved ${approverIds.length} approvers:`, approverIds);
          console.log(`[Simulation] Employee manager_id: ${employee.manager_id}`);
          console.log(`[Simulation] Manager in approverIds?`, employee.manager_id ? approverIds.includes(employee.manager_id) : 'N/A');

          // Diagnostic: Check why approvers might not be found
          let diagnosticInfo: string[] = [];
          if (approverIds.length === 0) {
            // Check if employee has manager (for manager-based or combined strategies)
            if (step.approver_strategy === 'manager' || step.approver_strategy === 'combined' || step.include_manager) {
              if (!employee.manager_id) {
                diagnosticInfo.push(`⚠️ Employee "${employee.name}" has no manager assigned (manager_id is null)`);
                diagnosticInfo.push(`   → The workflow requires a manager, but this employee doesn't have one`);
              } else {
                // Employee has manager, but check if manager has permission
                const manager = await prisma.user.findUnique({
                  where: { id: employee.manager_id },
                  include: {
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
                
                if (!manager || manager.status !== 'active' || manager.deleted_at) {
                  diagnosticInfo.push(`⚠️ Employee's manager is inactive or deleted`);
                } else {
                  const managerHasPermission = manager.user_roles.some(ur =>
                    ur.role.status === 'active' &&
                    ur.role.role_permissions.some(rp =>
                      rp.permission.name === step.required_permission || 
                      rp.permission.id === step.required_permission
                    )
                  );
                  if (!managerHasPermission) {
                    diagnosticInfo.push(`⚠️ Employee's manager "${manager.name}" doesn't have permission: ${step.required_permission}`);
                  }
                }
              }
            }

            // Check if required roles exist
            if (step.required_roles && step.required_roles.length > 0) {
              // Get role names for better diagnostic messages
              const roles = await prisma.role.findMany({
                where: {
                  id: { in: step.required_roles },
                  status: 'active',
                },
                select: { id: true, name: true },
              });
              const roleNames = roles.map(r => r.name).join(', ');
              const missingRoleIds = step.required_roles.filter(rid => !roles.find(r => r.id === rid));
              
              // Show location scope being used
              const locationScope = step.location_scope || 'all';
              diagnosticInfo.push(`ℹ️ Location scope for this step: ${locationScope} ${locationScope === 'all' ? '(Any Location)' : locationScope === 'same' ? '(Same Location Only)' : `(${locationScope})`}`);
              
              const roleUsers = await prisma.user.findMany({
                where: {
                  status: 'active',
                  deleted_at: null,
                  user_roles: {
                    some: {
                      role_id: { in: step.required_roles },
                      deleted_at: null,
                      role: {
                        status: 'active',
                      },
                    },
                  },
                },
                select: { id: true, name: true, primary_location_id: true },
              });
              if (roleUsers.length === 0) {
                if (roleNames) {
                  diagnosticInfo.push(`⚠️ No active users found with required roles: ${roleNames}`);
                } else {
                  diagnosticInfo.push(`⚠️ Required role IDs not found in system: ${step.required_roles.join(', ')}`);
                }
              } else {
                // Check if these users have the required permission
                const usersWithPermission = await prisma.user.findMany({
                  where: {
                    id: { in: roleUsers.map(u => u.id) },
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
                                name: step.required_permission,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  select: { id: true, name: true, primary_location_id: true },
                });
                if (usersWithPermission.length === 0) {
                  diagnosticInfo.push(`⚠️ Users with required roles don't have permission: ${step.required_permission}`);
                  diagnosticInfo.push(`   → Make sure the ${roleNames} role has the ${step.required_permission} permission assigned`);
                } else {
                  // Always show found users, regardless of location scope
                  diagnosticInfo.push(`ℹ️ Found ${usersWithPermission.length} user(s) with required roles (${roleNames}) and permission (${step.required_permission}):`);
                  for (const user of usersWithPermission) {
                    const userLocation = user.primary_location_id ? await prisma.location.findUnique({
                      where: { id: user.primary_location_id },
                      select: { name: true },
                    }) : null;
                    diagnosticInfo.push(`   • ${user.name} (Location: ${userLocation?.name || user.primary_location_id || 'Not set'})`);
                  }
                  
                  // Show location information if location scope is not 'all'
                  if (locationScope !== 'all') {
                    const employeeLocationId = employee.primary_location_id || template.location_id || locationId || '';
                    const employeeLocation = employeeLocationId ? await prisma.location.findUnique({
                      where: { id: employeeLocationId },
                      select: { name: true },
                    }) : null;
                    diagnosticInfo.push(`ℹ️ Employee location: ${employeeLocation?.name || employeeLocationId || 'Not set'}`);
                  }
                  
                  // Check if these users already approved a previous step
                  const previousStepInstances = await prisma.workflowStepInstance.findMany({
                    where: {
                      workflow_instance_id: tempInstance.id,
                      step_order: { lt: step.step_order },
                      status: 'approved',
                    },
                    select: {
                      acted_by: true,
                    },
                  });
                  const usersWhoAlreadyApproved = new Set(
                    previousStepInstances
                      .map(step => step.acted_by)
                      .filter((id): id is string => id !== null)
                  );
                  
                  const availableUsers = usersWithPermission.filter(u => !usersWhoAlreadyApproved.has(u.id));
                  const excludedUsers = usersWithPermission.filter(u => usersWhoAlreadyApproved.has(u.id));
                  
                  if (excludedUsers.length > 0) {
                    const excludedNames = excludedUsers.map(u => u.name).join(', ');
                    diagnosticInfo.push(`ℹ️ ${excludedUsers.length} user(s) with required roles already approved a previous step: ${excludedNames}`);
                    diagnosticInfo.push(`   → These users are excluded to prevent the same person from approving multiple steps`);
                  }
                  
                  if (availableUsers.length === 0 && usersWithPermission.length > 0) {
                    diagnosticInfo.push(`⚠️ All users with required roles and permission already approved a previous step`);
                    diagnosticInfo.push(`   → Consider adding more users with the required roles, or adjust the workflow template`);
                  } else if (availableUsers.length > 0) {
                    // Show available users who can approve
                    const availableNames = availableUsers.map(u => u.name).join(', ');
                    diagnosticInfo.push(`✅ ${availableUsers.length} user(s) available to approve this step: ${availableNames}`);
                    diagnosticInfo.push(`   → If these users are not showing as approvers, they may be missing UserPermissionScope entries`);
                    diagnosticInfo.push(`   → The system will still include them for role-based steps, but you may want to create scopes for better authority tracking`);
                  }
                }
              }
            }

            // Check permission-based users
            if (step.approver_strategy === 'permission' || step.approver_strategy === 'combined') {
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
                              name: step.required_permission,
                            },
                          },
                        },
                      },
                    },
                  },
                },
                select: { id: true, name: true },
              });
              if (permissionUsers.length === 0) {
                diagnosticInfo.push(`⚠️ No users found with permission: ${step.required_permission}`);
              }
            }
          }

          // Get approver details
          const approvers = await prisma.user.findMany({
            where: {
              id: { in: approverIds },
              status: 'active',
              deleted_at: null,
            },
            include: {
              primary_location: {
                select: { id: true, name: true },
              },
              user_roles: {
                where: { deleted_at: null },
                include: {
                  role: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          });

          // Determine source and role for each approver
          const approversWithSource = approvers.map(approver => {
            let source: 'manager' | 'role' | 'permission' = 'permission';
            let roleName: string | null = null;
            
            // Check if manager
            if (employee.manager_id === approver.id) {
              source = 'manager';
              // Get manager's primary role for display
              roleName = approver.user_roles.find(ur => ur.role)?.role?.name || 'Manager';
            } else if (step.required_roles && approver.user_roles.some(ur => 
              step.required_roles.includes(ur.role.id)
            )) {
              source = 'role';
              // Get the matching role name
              const matchingRole = approver.user_roles.find(ur => 
                step.required_roles.includes(ur.role.id)
              );
              roleName = matchingRole?.role?.name || null;
            } else {
              // Permission-based - get primary role for display
              roleName = approver.user_roles.find(ur => ur.role)?.role?.name || null;
            }

            return {
              id: approver.id,
              name: approver.name,
              email: approver.email,
              source,
              role: roleName,
              notified: false,
              acted: false,
            };
          });

          return {
            step_order: step.step_order,
            required_permission: step.required_permission,
            approver_strategy: step.approver_strategy || 'permission',
            allow_decline: step.allow_decline !== false,
            status: step.step_order === 1 ? 'in_progress' : 'pending' as const,
            approvers: approversWithSource,
            diagnostic_info: diagnosticInfo.length > 0 ? diagnosticInfo : undefined,
          };
        } catch (error: any) {
          console.error(`[Simulation] Error resolving approvers for step ${step.step_order}:`, error);
          console.error(`[Simulation] Error stack:`, error.stack);
          // Return step with empty approvers but don't fail the whole simulation
          return {
            step_order: step.step_order,
            required_permission: step.required_permission,
            approver_strategy: step.approver_strategy || 'permission',
            status: 'pending' as const,
            approvers: [],
          };
        }
      })
    );

    const simulation = {
      simulation_id: tempInstance.id,
      resource_id: resourceId,
      resource_type: template.resource_type,
      template: {
        ...template,
        steps: stepsWithParsed,
      },
      current_step: 1,
      status: 'running' as const,
      steps: simulationSteps,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
      },
    };

    console.log('[Simulation] Simulation created successfully:', {
      simulation_id: tempInstance.id,
      steps_count: simulationSteps.length,
      employee: employee.email,
    });

    return successResponse(simulation);
  } catch (error: any) {
    console.error('[Simulation] Error simulating workflow:', error);
    console.error('[Simulation] Error stack:', error.stack);
    console.error('[Simulation] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
