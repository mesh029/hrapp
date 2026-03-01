import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getUserLeaveBalances } from '@/lib/services/leave-balance';
import { findWorkflowTemplate } from '@/lib/services/workflow';

/**
 * GET /api/employees/overview
 * Get comprehensive employee overview: approval timelines, managers, leave balances, timesheet submission status, workflow templates
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get user with location, manager, and contract info
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        primary_location_id: true,
        manager_id: true,
        staff_type_id: true,
        contract_start_date: true,
        contract_end_date: true,
        contract_status: true,
        primary_location: {
          select: {
            id: true,
            name: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        staff_type: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!userData) {
      return errorResponse('User not found', 404);
    }

    const locationId = userData.primary_location_id;
    if (!locationId) {
      return errorResponse('User must have a primary location assigned', 400);
    }

    const currentYear = new Date().getFullYear();
    const now = new Date();

    // 1. Get leave balances
    const leaveBalances = await getUserLeaveBalances(user.id, currentYear);

    // 2. Get recent leave requests with workflow timelines
    const recentLeaveRequests = await prisma.leaveRequest.findMany({
      where: {
        user_id: user.id,
        deleted_at: null,
        status: { in: ['Submitted', 'UnderReview', 'Approved', 'Declined'] },
      },
      select: {
        id: true,
        leave_type_id: true,
        start_date: true,
        end_date: true,
        days_requested: true,
        status: true,
        workflow_instance_id: true,
        created_at: true,
        updated_at: true,
        leave_type: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // 3. Get recent timesheets with workflow timelines
    const recentTimesheets = await prisma.timesheet.findMany({
      where: {
        user_id: user.id,
        deleted_at: null,
        status: { in: ['Submitted', 'UnderReview', 'Approved', 'Declined'] },
      },
      select: {
        id: true,
        period_start: true,
        period_end: true,
        status: true,
        workflow_instance_id: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // 4. Get workflow timelines for leave requests
    const leaveWorkflowTimelines = await Promise.all(
      recentLeaveRequests
        .filter((lr) => lr.workflow_instance_id)
        .map(async (lr) => {
          try {
            const workflowInstance = await prisma.workflowInstance.findUnique({
              where: { id: lr.workflow_instance_id! },
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
                  include: {
                    actor: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            });

            if (!workflowInstance) return null;

            // Resolve approvers for pending steps
            const { resolveApprovers } = await import('@/lib/services/workflow');
            const timeline = await Promise.all(
              workflowInstance.template.steps.map(async (step, index) => {
                const stepInstance = workflowInstance.steps.find(
                  (s) => s.step_order === step.step_order
                );
                const isCurrent = workflowInstance.current_step_order === step.step_order;
                const isCompleted =
                  stepInstance?.status === 'approved' || stepInstance?.status === 'declined';
                const isPending = stepInstance?.status === 'pending' && isCurrent;

                let assignedApprovers: Array<{ id: string; name: string; email: string }> = [];
                if (isPending && locationId) {
                  try {
                    const approverIds = await resolveApprovers(
                      step.step_order,
                      workflowInstance.id,
                      locationId,
                      {
                        stepConfig: step,
                      }
                    );

                    if (approverIds.length > 0) {
                      const approvers = await prisma.user.findMany({
                        where: { id: { in: approverIds } },
                        select: { id: true, name: true, email: true },
                      });
                      assignedApprovers = approvers;
                    }
                  } catch (error) {
                    console.error(
                      `Failed to resolve approvers for leave request ${lr.id}, step ${step.step_order}:`,
                      error
                    );
                  }
                }

                return {
                  step_order: step.step_order,
                  required_permission: step.required_permission,
                  status: stepInstance?.status || 'pending',
                  actor: stepInstance?.actor || null,
                  acted_at: stepInstance?.acted_at || null,
                  comment: stepInstance?.comment || null,
                  is_current: isCurrent,
                  is_completed: isCompleted,
                  is_pending: isPending,
                  assigned_approvers: assignedApprovers,
                };
              })
            );

            return {
              leave_request_id: lr.id,
              workflow_instance_id: workflowInstance.id,
              workflow_status: workflowInstance.status,
              current_step_order: workflowInstance.current_step_order,
              timeline,
            };
          } catch (error) {
            console.error(`Failed to get workflow timeline for leave request ${lr.id}:`, error);
            return null;
          }
        })
    );

    // 5. Get workflow timelines for timesheets
    const timesheetWorkflowTimelines = await Promise.all(
      recentTimesheets
        .filter((ts) => ts.workflow_instance_id)
        .map(async (ts) => {
          try {
            const workflowInstance = await prisma.workflowInstance.findUnique({
              where: { id: ts.workflow_instance_id! },
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
                  include: {
                    actor: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            });

            if (!workflowInstance) return null;

            // Resolve approvers for pending steps
            const { resolveApprovers } = await import('@/lib/services/workflow');
            const timeline = await Promise.all(
              workflowInstance.template.steps.map(async (step, index) => {
                const stepInstance = workflowInstance.steps.find(
                  (s) => s.step_order === step.step_order
                );
                const isCurrent = workflowInstance.current_step_order === step.step_order;
                const isCompleted =
                  stepInstance?.status === 'approved' || stepInstance?.status === 'declined';
                const isPending = stepInstance?.status === 'pending' && isCurrent;

                let assignedApprovers: Array<{ id: string; name: string; email: string }> = [];
                if (isPending && locationId) {
                  try {
                    const approverIds = await resolveApprovers(
                      step.step_order,
                      workflowInstance.id,
                      locationId,
                      {
                        stepConfig: step,
                      }
                    );

                    if (approverIds.length > 0) {
                      const approvers = await prisma.user.findMany({
                        where: { id: { in: approverIds } },
                        select: { id: true, name: true, email: true },
                      });
                      assignedApprovers = approvers;
                    }
                  } catch (error) {
                    console.error(
                      `Failed to resolve approvers for timesheet ${ts.id}, step ${step.step_order}:`,
                      error
                    );
                  }
                }

                return {
                  step_order: step.step_order,
                  required_permission: step.required_permission,
                  status: stepInstance?.status || 'pending',
                  actor: stepInstance?.actor || null,
                  acted_at: stepInstance?.acted_at || null,
                  comment: stepInstance?.comment || null,
                  is_current: isCurrent,
                  is_completed: isCompleted,
                  is_pending: isPending,
                  assigned_approvers: assignedApprovers,
                };
              })
            );

            return {
              timesheet_id: ts.id,
              workflow_instance_id: workflowInstance.id,
              workflow_status: workflowInstance.status,
              current_step_order: workflowInstance.current_step_order,
              timeline,
            };
          } catch (error) {
            console.error(`Failed to get workflow timeline for timesheet ${ts.id}:`, error);
            return null;
          }
        })
    );

    // 6. Get active workflow templates that would apply to this user
    const leaveTemplateId = await findWorkflowTemplate({
      resourceType: 'leave',
      locationId,
      staffTypeId: userData.staff_type_id,
    });

    const timesheetTemplateId = await findWorkflowTemplate({
      resourceType: 'timesheet',
      locationId,
      staffTypeId: userData.staff_type_id,
    });

    // Helper function to resolve approvers for a template step (without instance)
    // This uses a simplified resolution that bypasses strict authority checks for preview
    const resolveTemplateStepApprovers = async (
      template: any,
      step: any,
      employeeId: string,
      employeeLocationId: string
    ): Promise<{
      approvers: Array<{ id: string; name: string; email: string; roles: string[] }>;
      error?: string;
      warnings?: string[];
    }> => {
      try {
        // Get employee details for manager resolution
        const employee = await prisma.user.findUnique({
          where: { id: employeeId },
          select: {
            id: true,
            manager_id: true,
            primary_location_id: true,
          },
        });

        if (!employee) {
          console.error(`Employee ${employeeId} not found`);
          return [];
        }

        // Use template location or employee location
        const templateLocationId = template.location_id || employeeLocationId;
        
        // Parse step configuration
        const stepConfig = {
          ...step,
          required_roles:
            step.required_roles && typeof step.required_roles === 'string'
              ? JSON.parse(step.required_roles)
              : step.required_roles || null,
          approver_strategy: (step.approver_strategy || 'permission') as 'manager' | 'role' | 'permission' | 'combined',
          // IMPORTANT: Handle PostgreSQL boolean conversion properly
          // Prisma should convert, but handle edge cases explicitly
          include_manager: (() => {
            if (step.include_manager === undefined || step.include_manager === null) return false;
            if (typeof step.include_manager === 'boolean') return step.include_manager;
            const strVal = String(step.include_manager).toLowerCase();
            return strVal === 'true' || strVal === 't' || strVal === '1';
          })(),
          location_scope: (step.location_scope || 'same') as 'same' | 'parent' | 'descendants' | 'all',
          required_permission: step.required_permission,
        };

        console.log(`[Employee Overview] Step config parsed for step ${step.step_order}:`, {
          approver_strategy: stepConfig.approver_strategy,
          include_manager: stepConfig.include_manager,
          location_scope: stepConfig.location_scope,
          required_permission: stepConfig.required_permission,
          required_roles: stepConfig.required_roles,
          raw_approver_strategy: step.approver_strategy,
          raw_include_manager: step.include_manager,
        });

        const approvers: Array<{ id: string; name: string; email: string; roles: string[] }> = [];
        const approverSet = new Set<string>();
        const warnings: string[] = [];
        let error: string | undefined = undefined;

        // Strategy 1: Manager-based
        // IMPORTANT: For 'manager' strategy, we always include manager regardless of include_manager flag
        // For 'combined' strategy, we check include_manager flag
        const isManagerStep = stepConfig.approver_strategy === 'manager' || 
                              (stepConfig.approver_strategy === 'combined' && stepConfig.include_manager);
        
        console.log(`[Employee Overview] Manager step check for step ${step.step_order}:`, {
          approver_strategy: stepConfig.approver_strategy,
          include_manager: stepConfig.include_manager,
          isManagerStep,
          employeeHasManager: !!employee.manager_id,
          employeeManagerId: employee.manager_id,
        });
        
        if (isManagerStep) {
          if (!employee.manager_id) {
            error = `Employee has no manager assigned. Please assign a manager to this employee.`;
            warnings.push(`Step ${step.step_order} requires a manager but employee has no manager_id`);
          } else {
            const manager = await prisma.user.findUnique({
              where: { id: employee.manager_id },
              select: {
                id: true,
                name: true,
                email: true,
                status: true,
                deleted_at: true,
                primary_location_id: true, // Explicitly include for location checks
                user_roles: {
                  select: {
                    deleted_at: true,
                    role: {
                      select: {
                        id: true,
                        name: true,
                        status: true,
                        role_permissions: {
                          select: {
                            permission: {
                              select: {
                                id: true,
                                name: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            });

            if (!manager) {
              error = `Manager (ID: ${employee.manager_id}) not found in the system.`;
              warnings.push(`Manager ID ${employee.manager_id} does not exist`);
            } else if (manager.status !== 'active') {
              error = `Manager "${manager.name}" is not active (status: ${manager.status}).`;
              warnings.push(`Manager ${manager.name} has status ${manager.status}, not active`);
            } else if (manager.deleted_at) {
              error = `Manager "${manager.name}" has been deleted.`;
              warnings.push(`Manager ${manager.name} is marked as deleted`);
            } else {
              // Filter user_roles: only active roles that aren't deleted
              const activeUserRoles = manager.user_roles.filter(
                ur => !ur.deleted_at && ur.role && ur.role.status === 'active'
              );
              
              // Check if manager has the required permission
              const hasPermission = activeUserRoles.some(ur =>
                ur.role.role_permissions.some(rp =>
                  rp.permission.name === stepConfig.required_permission
                )
              );

              console.log(`[Employee Overview] Manager check for step ${step.step_order}:`, {
                managerId: manager.id,
                managerName: manager.name,
                managerStatus: manager.status,
                managerDeleted: !!manager.deleted_at,
                hasPermission,
                requiredPermission: stepConfig.required_permission,
                managerRoles: activeUserRoles.map(ur => ur.role!.name),
                managerLocationId: manager.primary_location_id,
              });

              if (!hasPermission) {
                error = `Manager "${manager.name}" does not have the required permission "${stepConfig.required_permission}". Please assign this permission to the manager's role.`;
                warnings.push(`Manager ${manager.name} missing permission: ${stepConfig.required_permission}`);
              } else {
                // Check location scope
                const managerLocationId = manager.primary_location_id;
                const referenceLocationId = templateLocationId || employeeLocationId;
                let shouldInclude = false;

                if (stepConfig.location_scope === 'all') {
                  shouldInclude = true;
                } else if (stepConfig.location_scope === 'same') {
                  shouldInclude = managerLocationId === referenceLocationId;
                } else {
                  // For other scopes (parent, descendants), use the checkLocationScope function
                  // Import it dynamically to avoid circular dependencies
                  const workflowModule = await import('@/lib/services/workflow');
                  // checkLocationScope is not exported, so we'll handle parent/descendants manually
                  if (stepConfig.location_scope === 'parent' || stepConfig.location_scope === 'descendants') {
                    // For now, fall back to 'same' check for parent/descendants in preview
                    // Full implementation would require location path checking
                    shouldInclude = managerLocationId === referenceLocationId;
                  } else {
                    shouldInclude = false;
                  }
                }

                console.log(`[Employee Overview] Location scope check for manager:`, {
                  managerLocationId,
                  referenceLocationId,
                  locationScope: stepConfig.location_scope,
                  shouldInclude,
                });

                if (shouldInclude) {
                  approverSet.add(manager.id);
                  // Get manager roles for display (already filtered above)
                  const managerRoles = activeUserRoles.map(ur => ur.role!.name);
                  
                  approvers.push({
                    id: manager.id,
                    name: manager.name,
                    email: manager.email,
                    roles: managerRoles,
                  });
                  console.log(`[Employee Overview] ✅ Added manager ${manager.name} as approver for step ${step.step_order} with roles:`, managerRoles);
                } else {
                  const locationMismatchMsg = `Manager "${manager.name}" is in a different location. Location scope is "${stepConfig.location_scope}" but manager location (${manager.primary_location_id}) doesn't match employee location (${employeeLocationId}).`;
                  if (!error) error = locationMismatchMsg;
                  warnings.push(`Manager ${manager.name} excluded due to location scope: ${stepConfig.location_scope}`);
                  console.log(`[Employee Overview] ❌ Manager ${manager.name} excluded due to location scope mismatch`);
                }
              }
            }
          }

          // If manager-only strategy, return early
          if (stepConfig.approver_strategy === 'manager') {
            console.log(`[Employee Overview] Manager-only strategy: Returning ${approvers.length} approver(s) for step ${step.step_order}`);
            if (approvers.length === 0 && !error) {
              error = `No manager found. ${error || 'Please check manager assignment and permissions.'}`;
            }
            return { approvers, error, warnings };
          }
        } else {
          console.log(`[Employee Overview] ⚠️ Not a manager step - strategy: ${stepConfig.approver_strategy}, include_manager: ${stepConfig.include_manager}`);
        }

        // Strategy 2: Role-based
        if ((stepConfig.approver_strategy === 'role' || stepConfig.approver_strategy === 'combined') && stepConfig.required_roles && stepConfig.required_roles.length > 0) {
          const roleUsers = await prisma.user.findMany({
            where: {
              status: 'active',
              deleted_at: null,
              user_roles: {
                some: {
                  role_id: { in: stepConfig.required_roles },
                  deleted_at: null,
                  role: {
                    status: 'active',
                    role_permissions: {
                      some: {
                        permission: {
                          name: stepConfig.required_permission,
                        },
                      },
                    },
                  },
                },
              },
            },
            include: {
              user_roles: {
                where: {
                  role_id: { in: stepConfig.required_roles },
                  deleted_at: null,
                },
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

          for (const roleUser of roleUsers) {
            if (approverSet.has(roleUser.id)) continue;

            // Check location scope
            const userLocationId = roleUser.primary_location_id;
            const referenceLocationId = templateLocationId || employeeLocationId;
            let shouldInclude = false;

            if (stepConfig.location_scope === 'all') {
              shouldInclude = true;
            } else if (stepConfig.location_scope === 'same') {
              shouldInclude = userLocationId === referenceLocationId;
            } else {
              // For other scopes (parent, descendants), handle manually
              if (stepConfig.location_scope === 'parent' || stepConfig.location_scope === 'descendants') {
                // For now, fall back to 'same' check for parent/descendants in preview
                shouldInclude = userLocationId === referenceLocationId;
              } else {
                shouldInclude = false;
              }
            }

            if (shouldInclude) {
              approverSet.add(roleUser.id);
              // Get user roles for display
              const userRoles = roleUser.user_roles
                .filter(ur => ur.role.status === 'active')
                .map(ur => ur.role.name);
              
              approvers.push({
                id: roleUser.id,
                name: roleUser.name,
                email: roleUser.email,
                roles: userRoles,
              });
            }
          }

          // If role-only strategy, return early
          if (stepConfig.approver_strategy === 'role') {
            console.log(`[Employee Overview] Role-only strategy: Returning ${approvers.length} approver(s) for step ${step.step_order}`);
            if (approvers.length === 0 && !error) {
              if (!stepConfig.required_roles || stepConfig.required_roles.length === 0) {
                error = `No roles specified for this step. Please configure required_roles for step ${step.step_order}.`;
              } else {
                error = `No users found with the required roles ${JSON.stringify(stepConfig.required_roles)} and permission "${stepConfig.required_permission}" in location scope "${stepConfig.location_scope}".`;
              }
              warnings.push(`Role step returned 0 approvers with roles: ${JSON.stringify(stepConfig.required_roles)}`);
            }
            return { approvers, error, warnings: warnings.length > 0 ? warnings : undefined };
          }
        } else {
          console.log(`[Employee Overview] ⚠️ Not a role step or no required_roles - strategy: ${stepConfig.approver_strategy}, required_roles: ${stepConfig.required_roles}`);
        }

        // Strategy 3: Permission-based (fallback)
        if (stepConfig.approver_strategy === 'permission' || (stepConfig.approver_strategy === 'combined' && !stepConfig.required_roles)) {
          console.log(`[Employee Overview] Permission-based resolution for step ${step.step_order}:`, {
            requiredPermission: stepConfig.required_permission,
            locationScope: stepConfig.location_scope,
            referenceLocationId: templateLocationId || employeeLocationId,
          });

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
                          name: stepConfig.required_permission,
                        },
                      },
                    },
                  },
                },
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              primary_location_id: true,
            },
          });

          console.log(`[Employee Overview] Found ${permissionUsers.length} users with permission ${stepConfig.required_permission}`);

          if (permissionUsers.length === 0) {
            error = `No users found with permission "${stepConfig.required_permission}". Please ensure at least one user has this permission assigned to their role.`;
            warnings.push(`No users have permission: ${stepConfig.required_permission}`);
          }

          for (const permUser of permissionUsers) {
            if (approverSet.has(permUser.id)) continue;

            // Check location scope
            const userLocationId = permUser.primary_location_id;
            const referenceLocationId = templateLocationId || employeeLocationId;
            let shouldInclude = false;

            if (stepConfig.location_scope === 'all') {
              shouldInclude = true;
            } else if (stepConfig.location_scope === 'same') {
              shouldInclude = userLocationId === referenceLocationId;
            } else {
              // For other scopes (parent, descendants), handle manually
              if (stepConfig.location_scope === 'parent' || stepConfig.location_scope === 'descendants') {
                // For now, fall back to 'same' check for parent/descendants in preview
                shouldInclude = userLocationId === referenceLocationId;
              } else {
                shouldInclude = false;
              }
            }

            console.log(`[Employee Overview] Permission user ${permUser.name}:`, {
              userLocationId,
              referenceLocationId,
              locationScope: stepConfig.location_scope,
              shouldInclude,
            });

            if (shouldInclude) {
              approverSet.add(permUser.id);
              // Get user roles for display - need to fetch roles separately
              const userWithRoles = await prisma.user.findUnique({
                where: { id: permUser.id },
                select: {
                  user_roles: {
                    select: {
                      deleted_at: true,
                      role: {
                        select: {
                          name: true,
                          status: true,
                        },
                      },
                    },
                  },
                },
              });
              
              const userRoles = userWithRoles?.user_roles
                .filter(ur => !ur.deleted_at && ur.role && ur.role.status === 'active')
                .map(ur => ur.role!.name) || [];
              
              approvers.push({
                id: permUser.id,
                name: permUser.name,
                email: permUser.email,
                roles: userRoles,
              });
              console.log(`[Employee Overview] ✅ Added permission user ${permUser.name} with roles:`, userRoles);
            } else {
              console.log(`[Employee Overview] ❌ Excluded permission user ${permUser.name} due to location scope`);
            }
          }
        }

        console.log(`[Employee Overview] ✅ Final resolution: Found ${approvers.length} approver(s) for step ${step.step_order}`, {
          stepOrder: step.step_order,
          approverStrategy: stepConfig.approver_strategy,
          locationScope: stepConfig.location_scope,
          requiredPermission: stepConfig.required_permission,
          approvers: approvers.map(a => ({ name: a.name, email: a.email, roles: a.roles })),
        });
        
        if (approvers.length === 0) {
          console.error(`[Employee Overview] ⚠️ WARNING: Step ${step.step_order} returned 0 approvers!`, {
            stepOrder: step.step_order,
            approverStrategy: stepConfig.approver_strategy,
            includeManager: stepConfig.include_manager,
            locationScope: stepConfig.location_scope,
            requiredPermission: stepConfig.required_permission,
            requiredRoles: stepConfig.required_roles,
            employeeHasManager: !!employee.manager_id,
            templateLocationId,
            employeeLocationId,
          });
        }
        
        return { approvers, error, warnings: warnings.length > 0 ? warnings : undefined };
      } catch (error: any) {
        console.error(
          `[Employee Overview] ❌ ERROR: Failed to resolve approvers for template step ${step.step_order}:`,
          error
        );
        console.error('[Employee Overview] Error details:', {
          message: error.message,
          stack: error.stack,
          stepOrder: step.step_order,
          approverStrategy: step.approver_strategy,
          requiredPermission: step.required_permission,
        });
        return { 
          approvers: [], 
          error: `Failed to resolve approvers: ${error.message}`,
          warnings: [`Exception occurred: ${error.message}`]
        };
      }
    };

    const activeTemplates: any[] = [];

    if (leaveTemplateId) {
      const leaveTemplate = await prisma.workflowTemplate.findUnique({
        where: { id: leaveTemplateId },
        include: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      });
      if (leaveTemplate) {
        // Use template location or fallback to employee location
        const templateLocationId = leaveTemplate.location_id || locationId;
        
        // Resolve approvers for each step
        const stepsWithApprovers = await Promise.all(
          leaveTemplate.steps.map(async (step) => {
            const result = await resolveTemplateStepApprovers(
              leaveTemplate,
              step,
              user.id,
              templateLocationId
            );
            return {
              step_order: step.step_order,
              required_permission: step.required_permission,
              allow_decline: step.allow_decline,
              allow_adjust: step.allow_adjust,
              approvers: result.approvers,
              error: result.error,
              warnings: result.warnings,
            };
          })
        );

        activeTemplates.push({
          id: leaveTemplate.id,
          name: leaveTemplate.name,
          resource_type: leaveTemplate.resource_type,
          location: leaveTemplate.location,
          steps: stepsWithApprovers,
        });
      }
    }

    if (timesheetTemplateId) {
      const timesheetTemplate = await prisma.workflowTemplate.findUnique({
        where: { id: timesheetTemplateId },
        include: {
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          steps: {
            orderBy: { step_order: 'asc' },
          },
        },
      });
      if (timesheetTemplate) {
        // Use template location or fallback to employee location
        const templateLocationId = timesheetTemplate.location_id || locationId;
        
        // Resolve approvers for each step
        const stepsWithApprovers = await Promise.all(
          timesheetTemplate.steps.map(async (step) => {
            const result = await resolveTemplateStepApprovers(
              timesheetTemplate,
              step,
              user.id,
              templateLocationId
            );
            return {
              step_order: step.step_order,
              required_permission: step.required_permission,
              allow_decline: step.allow_decline,
              allow_adjust: step.allow_adjust,
              approvers: result.approvers,
              error: result.error,
              warnings: result.warnings,
            };
          })
        );

        activeTemplates.push({
          id: timesheetTemplate.id,
          name: timesheetTemplate.name,
          resource_type: timesheetTemplate.resource_type,
          location: timesheetTemplate.location,
          steps: stepsWithApprovers,
        });
      }
    }

    // 7. Check timesheet submission status for current period
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const currentPeriod = await prisma.timesheetPeriod.findFirst({
      where: {
        period_start: { lte: currentMonthStart },
        period_end: { gte: currentMonthEnd },
        submission_enabled: true,
      },
    });

    const submissionWindowOpen = !!currentPeriod;

    // Get leave type details for explanations
    const leaveTypeDetails = await prisma.leaveType.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        name: true,
        max_days_per_year: true,
        accrual_rule: true,
      },
    });

    // Enhance leave balances with explanations
    const enhancedLeaveBalances = leaveBalances.map((balance) => {
      const leaveType = leaveTypeDetails.find((lt) => lt.id === balance.leave_type.id);
      const allocated = balance.allocated;
      const used = balance.used;
      const pending = balance.pending;
      const available = balance.available;

      // Calculate explanation
      let explanation = '';
      if (leaveType) {
        const maxDays = leaveType.max_days_per_year;
        if (maxDays && allocated > maxDays) {
          explanation = `Allocated ${allocated.toFixed(2)} days exceeds maximum of ${maxDays} days per year. This may be due to contract period calculations or manual adjustments.`;
        } else if (used > 0 && used !== Math.floor(used)) {
          explanation = `${used.toFixed(2)} days used. Check approved leave requests.`;
        } else if (used > 0) {
          explanation = `${used.toFixed(0)} day${used !== 1 ? 's' : ''} used from approved leave requests.`;
        } else {
          explanation = `No days used. Available: ${available.toFixed(2)} day${available !== 1 ? 's' : ''}.`;
        }
      }

      return {
        ...balance,
        explanation,
        max_days_per_year: leaveType?.max_days_per_year || null,
      };
    });

    return successResponse({
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        primary_location: userData.primary_location,
        manager: userData.manager,
        staff_type: userData.staff_type,
        contract: {
          start_date: userData.contract_start_date,
          end_date: userData.contract_end_date,
          status: userData.contract_status,
          period_days: userData.contract_start_date && userData.contract_end_date
            ? Math.ceil(
                (new Date(userData.contract_end_date).getTime() -
                  new Date(userData.contract_start_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
          period_months: userData.contract_start_date && userData.contract_end_date
            ? Math.round(
                ((new Date(userData.contract_end_date).getTime() -
                  new Date(userData.contract_start_date).getTime()) /
                  (1000 * 60 * 60 * 24 * 30.44)) *
                  10
              ) / 10
            : null,
        },
      },
      leave_balances: enhancedLeaveBalances,
      recent_leave_requests: recentLeaveRequests.map((lr) => ({
        ...lr,
        workflow_timeline: leaveWorkflowTimelines.find(
          (wt) => wt?.leave_request_id === lr.id
        ) || null,
      })),
      recent_timesheets: recentTimesheets.map((ts) => ({
        ...ts,
        workflow_timeline: timesheetWorkflowTimelines.find(
          (wt) => wt?.timesheet_id === ts.id
        ) || null,
      })),
      active_workflow_templates: activeTemplates,
      timesheet_submission_window: {
        is_open: submissionWindowOpen,
        current_period: currentPeriod
          ? {
              id: currentPeriod.id,
              period_start: currentPeriod.period_start,
              period_end: currentPeriod.period_end,
              submission_enabled: currentPeriod.submission_enabled,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Get employee overview error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
