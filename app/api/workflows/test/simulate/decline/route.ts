import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { resolveApprovers } from '@/lib/services/workflow';
import { checkAuthority } from '@/lib/services/authority';
import { declineWorkflowStep } from '@/lib/services/workflow';
import { z } from 'zod';

const declineSchema = z.object({
  simulation_id: z.string().uuid(),
  step_order: z.number().int().positive(),
  approver_id: z.string().uuid(),
  comment: z.string().optional(),
});

/**
 * POST /api/workflows/test/simulate/decline
 * Decline a step in a simulation (real workflow instance)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const validation = declineSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { simulation_id, step_order, approver_id, comment } = validation.data;

    // Get the simulation instance (real workflow instance)
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

    if (!instance) {
      return errorResponse('Simulation not found', 404);
    }

    // Verify the approver is valid for this step
    const step = instance.template.steps.find((s) => s.step_order === step_order);
    if (!step) {
      return errorResponse('Workflow step not found', 404);
    }

    // Resolve approvers for this step
    const stepConfig = {
      ...step,
      required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
      conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
    };

    const approverIds = await resolveApprovers(
      step.step_order,
      simulation_id,
      instance.template.location_id || instance.creator.primary_location_id || '',
      {
        stepConfig,
      }
    );

    if (!approverIds.includes(approver_id)) {
      return errorResponse('Approver not authorized for this step', 403);
    }

    // Check authority (simulation allows bypass, but we still check for realism)
    const locationId = instance.template.location_id || instance.creator.primary_location_id || '';
    const authorityCheck = await checkAuthority({
      userId: approver_id,
      permission: step.required_permission,
      locationId,
      workflowStepOrder: step.step_order,
      workflowInstanceId: simulation_id,
    });

    if (!authorityCheck.authorized) {
      return errorResponse('Approver does not have required authority', 403);
    }

    // Decline the step using real workflow service
    await declineWorkflowStep({
      instanceId: simulation_id,
      userId: approver_id,
      locationId,
      comment: comment || 'Simulation: Declined for testing',
      ipAddress: '127.0.0.1',
      userAgent: 'Workflow Simulator',
    });

    // Get updated simulation state (same as approve endpoint)
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
          const notified = isCurrent || stepInstance?.status === 'approved' || stepInstance?.status === 'declined';

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
    console.error('Error declining simulation step:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
