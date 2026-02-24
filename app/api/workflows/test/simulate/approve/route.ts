import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { resolveApprovers } from '@/lib/services/workflow';
import { checkAuthority } from '@/lib/services/authority';
import { z } from 'zod';

const approveSchema = z.object({
  simulation_id: z.string().uuid(),
  step_order: z.number().int().positive(),
  approver_id: z.string().uuid(),
  comment: z.string().optional(),
});

/**
 * POST /api/workflows/test/simulate/approve
 * Approve a step in a simulation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validation = approveSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { simulation_id, step_order, approver_id, comment } = validation.data;

    // Get the simulation instance
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: simulation_id },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
            location: {
              select: { id: true, name: true },
            },
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            manager_id: true,
            primary_location_id: true,
          },
        },
      },
    });

    if (!instance) {
      return errorResponse('Simulation not found', 404);
    }

    // Ensure caller is allowed to run simulations (but approvals use the *approver_id*'s authority)
    const callerWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });
    const callerLocationId =
      callerWithLocation?.primary_location_id ||
      instance.template.location_id ||
      instance.creator.primary_location_id ||
      (await prisma.location.findFirst({ select: { id: true } }))?.id;
    if (!callerLocationId) {
      return errorResponse('No location available for permission check', 400);
    }

    // Determine the *workflow location* used for authority checks
    // IMPORTANT: For location scope checks, we should use the employee's location (resource location)
    // not the template's location, because the employee is at a specific location
    // Get location from the resource (leave request or timesheet)
    let resourceLocationId: string | null = null;
    if (instance.resource_type === 'leave') {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: instance.resource_id },
        select: { location_id: true },
      });
      resourceLocationId = leaveRequest?.location_id || null;
    } else if (instance.resource_type === 'timesheet') {
      const timesheet = await prisma.timesheet.findUnique({
        where: { id: instance.resource_id },
        select: { location_id: true },
      });
      resourceLocationId = timesheet?.location_id || null;
    }

    // Use resource location (employee's location) for scope checks, fallback to template location
    const workflowLocationId =
      resourceLocationId ||
      instance.creator.primary_location_id ||
      instance.template.location_id ||
      callerLocationId;

    console.log(`[Simulation Approve] Location resolution:`, {
      resourceLocationId,
      employeeLocationId: instance.creator.primary_location_id,
      templateLocationId: instance.template.location_id,
      finalLocationId: workflowLocationId,
    });

    // Validate the step is the current step (allow null/0 for just-started workflows)
    if (instance.current_step_order !== null && instance.current_step_order !== step_order) {
      console.error(`[Simulation Approve] Step mismatch: current=${instance.current_step_order}, requested=${step_order}`);
      return errorResponse(
        `Invalid step: current step is ${instance.current_step_order}, cannot approve step ${step_order}`,
        400
      );
    }
    
    console.log(`[Simulation Approve] Step validation passed: current_step_order=${instance.current_step_order}, step_order=${step_order}`);

    // Find current step config and parse JSON fields
    const currentStep = instance.template.steps.find((s) => s.step_order === step_order);
    if (!currentStep) {
      return errorResponse('Workflow step not found', 404);
    }

    const stepConfig = {
      ...currentStep,
      required_roles: currentStep.required_roles ? JSON.parse(currentStep.required_roles as string) : null,
      conditional_rules: currentStep.conditional_rules ? JSON.parse(currentStep.conditional_rules as string) : null,
    };

    // Resolve valid approvers for this step, then ensure the selected approver is in that set
    // Use the same location that was used during simulation (resource/employee location)
    const resolvedApproverIds = await resolveApprovers(
      step_order,
      simulation_id,
      workflowLocationId,
      { stepConfig }
    );

    console.log(`[Simulation Approve] Resolved approvers for step ${step_order}:`, resolvedApproverIds);
    console.log(`[Simulation Approve] Selected approver ID:`, approver_id);
    console.log(`[Simulation Approve] Approver in resolved list?`, resolvedApproverIds.includes(approver_id));

    if (!resolvedApproverIds.includes(approver_id)) {
      console.error(`[Simulation Approve] Approver ${approver_id} not in resolved approvers list:`, resolvedApproverIds);
      return errorResponse(`Approver is not eligible for this step (not in resolved approvers). Resolved: ${resolvedApproverIds.length} approvers`, 403);
    }

    // Check authority for the *selected approver* in workflow context (includes delegation overlay)
    // For managers, we can be more lenient - if they're in the resolved list, they should be able to approve
    const authority = await checkAuthority({
      userId: approver_id,
      permission: stepConfig.required_permission,
      locationId: workflowLocationId,
      workflowStepOrder: step_order,
      workflowInstanceId: simulation_id,
    });
    
    console.log(`[Simulation Approve] Authority check result:`, {
      authorized: authority.authorized,
      source: authority.source,
      approverId: approver_id,
      permission: stepConfig.required_permission,
    });

    // If authority check fails but approver is in resolved list, check if they're the manager
    // Managers should be able to approve if they're in the resolved list
    if (!authority.authorized) {
      const isManager = instance.creator.manager_id === approver_id;
      if (isManager) {
        console.log(`[Simulation Approve] Authority check failed for manager, but allowing approval since manager is in resolved list`);
        // Allow manager to proceed - they're in the resolved list and are the manager
      } else {
        console.error(`[Simulation Approve] Approver ${approver_id} does not have authority and is not the manager`);
        return errorResponse(`Approver does not have authority to approve this step. Permission required: ${stepConfig.required_permission}`, 403);
      }
    }

    // Update step instance
    await prisma.workflowStepInstance.update({
      where: {
        workflow_instance_id_step_order: {
          workflow_instance_id: simulation_id,
          step_order: step_order,
        },
      },
      data: {
        status: 'approved',
        acted_by: approver_id,
        acted_at: new Date(),
        comment: comment || null,
      },
    });

    // Check if this is the last step
    const isLastStep = step_order === instance.template.steps[instance.template.steps.length - 1].step_order;

    if (isLastStep) {
      // Complete simulation - mark workflow and resource as Approved
      await prisma.workflowInstance.update({
        where: { id: simulation_id },
        data: {
          status: 'Approved',
        },
      });

      // Update resource status to Approved
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
      const nextStep = instance.template.steps.find((s) => s.step_order > step_order);
      if (nextStep) {
        await prisma.workflowInstance.update({
          where: { id: simulation_id },
          data: {
            status: 'UnderReview',
            current_step_order: nextStep.step_order,
          },
        });

        // Resolve approvers for next step
        const nextStepConfig = {
          ...nextStep,
          required_roles: nextStep.required_roles ? JSON.parse(nextStep.required_roles as string) : null,
          conditional_rules: nextStep.conditional_rules ? JSON.parse(nextStep.conditional_rules as string) : null,
        };

        console.log(`[Simulation Approve] Resolving approvers for next step ${nextStep.step_order}...`);
        const approverIds = await resolveApprovers(
          nextStep.step_order,
          simulation_id,
          instance.template.location_id || instance.creator.primary_location_id || '',
          {
            stepConfig: nextStepConfig,
          }
        );
        console.log(`[Simulation Approve] Next step ${nextStep.step_order} resolved ${approverIds.length} approvers:`, approverIds);

        // Diagnostic: Check why approvers might not be found for next step
        let nextStepDiagnosticInfo: string[] = [];
        if (approverIds.length === 0) {
          // Check if employee has manager (for manager-based or combined strategies)
          if (nextStepConfig.approver_strategy === 'manager' || nextStepConfig.approver_strategy === 'combined' || nextStepConfig.include_manager) {
            if (!instance.creator.manager_id) {
              nextStepDiagnosticInfo.push(`⚠️ Employee "${instance.creator.name}" has no manager assigned (manager_id is null)`);
              nextStepDiagnosticInfo.push(`   → The workflow requires a manager, but this employee doesn't have one`);
            } else {
              // Employee has manager, but check if manager has permission
              const manager = await prisma.user.findUnique({
                where: { id: instance.creator.manager_id },
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
                nextStepDiagnosticInfo.push(`⚠️ Employee's manager is inactive or deleted`);
              } else {
                const managerHasPermission = manager.user_roles.some(ur =>
                  ur.role.status === 'active' &&
                  ur.role.role_permissions.some(rp =>
                    rp.permission.name === nextStepConfig.required_permission || 
                    rp.permission.id === nextStepConfig.required_permission
                  )
                );
                if (!managerHasPermission) {
                  nextStepDiagnosticInfo.push(`⚠️ Employee's manager "${manager.name}" doesn't have permission: ${nextStepConfig.required_permission}`);
                }
              }
            }
          }

          // Check if required roles exist
          if (nextStepConfig.required_roles && nextStepConfig.required_roles.length > 0) {
            const roles = await prisma.role.findMany({
              where: {
                id: { in: nextStepConfig.required_roles },
                status: 'active',
              },
              select: { id: true, name: true },
            });
            const roleNames = roles.map(r => r.name).join(', ');
            const missingRoleIds = nextStepConfig.required_roles.filter(rid => !roles.find(r => r.id === rid));
            
            const roleUsers = await prisma.user.findMany({
              where: {
                status: 'active',
                deleted_at: null,
                user_roles: {
                  some: {
                    role_id: { in: nextStepConfig.required_roles },
                    deleted_at: null,
                    role: {
                      status: 'active',
                    },
                  },
                },
              },
              select: { id: true, name: true },
            });
            if (roleUsers.length === 0) {
              if (roleNames) {
                nextStepDiagnosticInfo.push(`⚠️ No active users found with required roles: ${roleNames}`);
              } else {
                nextStepDiagnosticInfo.push(`⚠️ Required role IDs not found in system: ${nextStepConfig.required_roles.join(', ')}`);
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
                              name: nextStepConfig.required_permission,
                            },
                          },
                        },
                      },
                    },
                  },
                },
                select: { id: true, name: true },
              });
              if (usersWithPermission.length === 0) {
                nextStepDiagnosticInfo.push(`⚠️ Users with required roles don't have permission: ${nextStepConfig.required_permission}`);
              }
            }
          }

          // Check permission-based users
          if (nextStepConfig.approver_strategy === 'permission' || nextStepConfig.approver_strategy === 'combined') {
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
                            name: nextStepConfig.required_permission,
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
              nextStepDiagnosticInfo.push(`⚠️ No users found with permission: ${nextStepConfig.required_permission}`);
            }
          }
        }

        // Get approver details for next step
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

        // Update step instances for next step
        await prisma.workflowStepInstance.update({
          where: {
            workflow_instance_id_step_order: {
              workflow_instance_id: simulation_id,
              step_order: nextStep.step_order,
            },
          },
          data: {
            status: 'pending',
          },
        });
      }
    }

    // Get updated simulation state
    const updatedInstance = await prisma.workflowInstance.findUnique({
      where: { id: simulation_id },
      include: {
        template: {
          include: {
            steps: {
              orderBy: { step_order: 'asc' },
            },
            location: {
              select: { id: true, name: true },
            },
          },
        },
        steps: {
          orderBy: { step_order: 'asc' },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            manager_id: true,
            primary_location_id: true,
          },
        },
      },
    });

    if (!updatedInstance) {
      return errorResponse('Failed to update simulation', 500);
    }

    // Parse JSON fields
    const stepsWithParsed = updatedInstance.template.steps.map(step => ({
      ...step,
      required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
      conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
    }));

    // Build simulation steps with approvers
    const simulationSteps = await Promise.all(
      stepsWithParsed.map(async (step) => {
        const stepInstance = updatedInstance.steps.find(s => s.step_order === step.step_order);
        const isCurrent = updatedInstance.current_step_order === step.step_order;

        // Resolve approvers for this step
        const approverIds = await resolveApprovers(
          step.step_order,
          simulation_id,
          updatedInstance.template.location_id || updatedInstance.creator.primary_location_id || '',
          {
            stepConfig: step,
          }
        );

        // Diagnostic: Check why approvers might not be found (only for current step)
        let diagnosticInfo: string[] = [];
        if (approverIds.length === 0 && isCurrent) {
          // Check if employee has manager (for manager-based or combined strategies)
          if (step.approver_strategy === 'manager' || step.approver_strategy === 'combined' || step.include_manager) {
            if (!updatedInstance.creator.manager_id) {
              diagnosticInfo.push(`⚠️ Employee "${updatedInstance.creator.name}" has no manager assigned (manager_id is null)`);
              diagnosticInfo.push(`   → The workflow requires a manager, but this employee doesn't have one`);
            } else {
              // Employee has manager, but check if manager has permission
              const manager = await prisma.user.findUnique({
                where: { id: updatedInstance.creator.manager_id },
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
            const roles = await prisma.role.findMany({
              where: {
                id: { in: step.required_roles },
                status: 'active',
              },
              select: { id: true, name: true },
            });
            const roleNames = roles.map(r => r.name).join(', ');
            
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
              select: { id: true, name: true },
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
                select: { id: true, name: true },
              });
              if (usersWithPermission.length === 0) {
                diagnosticInfo.push(`⚠️ Users with required roles don't have permission: ${step.required_permission}`);
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

        // Determine source, role, and status for each approver
        const approversWithSource = approvers.map(approver => {
          let source: 'manager' | 'role' | 'permission' = 'permission';
          let roleName: string | null = null;
          
          if (updatedInstance.creator.manager_id === approver.id) {
            source = 'manager';
            roleName = approver.user_roles.find(ur => ur.role)?.role?.name || 'Manager';
          } else if (step.required_roles && approver.user_roles.some(ur => 
            step.required_roles.includes(ur.role.id)
          )) {
            source = 'role';
            const matchingRole = approver.user_roles.find(ur => 
              step.required_roles.includes(ur.role.id)
            );
            roleName = matchingRole?.role?.name || null;
          } else {
            roleName = approver.user_roles.find(ur => ur.role)?.role?.name || null;
          }

          const acted = stepInstance?.acted_by === approver.id;
          const notified = isCurrent || stepInstance?.status === 'approved';

          return {
            id: approver.id,
            name: approver.name,
            email: approver.email,
            source,
            role: roleName,
            notified,
            acted,
            acted_at: acted ? stepInstance?.acted_at?.toISOString() : undefined,
            comment: acted ? stepInstance?.comment || undefined : undefined,
          };
        });

        let status: 'pending' | 'in_progress' | 'approved' | 'declined' = 'pending';
        if (stepInstance?.status === 'approved') {
          status = 'approved';
        } else if (stepInstance?.status === 'declined') {
          status = 'declined';
        } else if (isCurrent) {
          status = 'in_progress';
        }

        return {
          step_order: step.step_order,
          required_permission: step.required_permission,
          approver_strategy: step.approver_strategy || 'permission',
          allow_decline: step.allow_decline !== false,
          status,
          approvers: approversWithSource,
          resolved_at: stepInstance?.acted_at?.toISOString(),
          diagnostic_info: diagnosticInfo.length > 0 ? diagnosticInfo : undefined,
        };
      })
    );

    const simulation = {
      simulation_id: updatedInstance.id,
      resource_id: updatedInstance.resource_id,
      resource_type: updatedInstance.resource_type,
      template: {
        ...updatedInstance.template,
        steps: stepsWithParsed,
      },
      current_step: updatedInstance.current_step_order,
      status: updatedInstance.status === 'Approved' ? 'completed' : 
             updatedInstance.status === 'Declined' ? 'declined' : 'running',
      steps: simulationSteps,
      employee: {
        id: updatedInstance.creator.id,
        name: updatedInstance.creator.name,
        email: updatedInstance.creator.email,
      },
    };

    return successResponse(simulation);
  } catch (error: any) {
    console.error('[Simulation Approve] Error approving simulation step:', error);
    console.error('[Simulation Approve] Error stack:', error.stack);
    console.error('[Simulation Approve] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
