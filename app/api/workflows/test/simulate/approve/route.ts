import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { resolveApprovers } from '@/lib/services/workflow';
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
      // Complete simulation
      await prisma.workflowInstance.update({
        where: { id: simulation_id },
        data: {
          status: 'Approved',
        },
      });
    } else {
      // Move to next step
      const nextStep = instance.template.steps.find((s) => s.step_order > step_order);
      if (nextStep) {
        await prisma.workflowInstance.update({
          where: { id: simulation_id },
          data: {
            current_step_order: nextStep.step_order,
          },
        });

        // Resolve approvers for next step
        const nextStepConfig = {
          ...nextStep,
          required_roles: nextStep.required_roles ? JSON.parse(nextStep.required_roles as string) : null,
          conditional_rules: nextStep.conditional_rules ? JSON.parse(nextStep.conditional_rules as string) : null,
        };

        const approverIds = await resolveApprovers(
          nextStep.step_order,
          simulation_id,
          instance.template.location_id || instance.creator.primary_location_id || '',
          {
            stepConfig: nextStepConfig,
          }
        );

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

        // Determine source and status for each approver
        const approversWithSource = approvers.map(approver => {
          let source: 'manager' | 'role' | 'permission' = 'permission';
          
          if (updatedInstance.creator.manager_id === approver.id) {
            source = 'manager';
          } else if (step.required_roles && approver.user_roles.some(ur => 
            step.required_roles.includes(ur.role.id)
          )) {
            source = 'role';
          }

          const acted = stepInstance?.acted_by === approver.id;
          const notified = isCurrent || stepInstance?.status === 'approved';

          return {
            id: approver.id,
            name: approver.name,
            email: approver.email,
            source,
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
          status,
          approvers: approversWithSource,
          resolved_at: stepInstance?.acted_at?.toISOString(),
        };
      })
    );

    const simulation = {
      simulation_id: updatedInstance.id,
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
    console.error('Error approving simulation step:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
