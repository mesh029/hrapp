import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { resolveApprovers } from '@/lib/services/workflow';
import { checkAuthority } from '@/lib/services/authority';
import { z } from 'zod';

const autoRunSchema = z.object({
  simulation_id: z.string().uuid(),
  max_steps: z.number().int().positive().optional().default(50),
});

/**
 * POST /api/workflows/test/simulate/auto-run
 * Auto-advance a simulation from current step to completion by impersonating valid approvers.
 *
 * Important:
 * - This endpoint is privileged for *testing only*, but it does NOT bypass workflow rules.
 * - Each step is approved only if a resolved approver exists AND passes checkAuthority for that step.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await authenticate(request);
    if (!caller) return errorResponse('Unauthorized', 401);

    const body = await request.json();
    const validation = autoRunSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse('Validation failed', 400, validation.error.flatten().fieldErrors);
    }

    const { simulation_id, max_steps } = validation.data;

    // Load instance + template + steps + stepInstances + creator
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: simulation_id },
      include: {
        template: {
          include: {
            steps: { orderBy: { step_order: 'asc' } },
            location: { select: { id: true, name: true } },
          },
        },
        steps: { orderBy: { step_order: 'asc' } },
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

    if (!instance) return errorResponse('Simulation not found', 404);
    if (instance.status === 'Approved') return errorResponse('Simulation already completed', 400);
    if (instance.status === 'Declined') return errorResponse('Simulation already declined', 400);

    const workflowLocationId =
      instance.template.location_id ||
      instance.creator.primary_location_id ||
      (await prisma.location.findFirst({ select: { id: true } }))?.id;

    if (!workflowLocationId) {
      return errorResponse('No location available for workflow', 400);
    }

    let approvalsPerformed = 0;
    let safetyCounter = 0;

    while (instance.status !== 'Approved' && instance.status !== 'Declined' && approvalsPerformed < max_steps) {
      safetyCounter++;
      if (safetyCounter > max_steps) break;

      const currentStepOrder = instance.current_step_order;
      const currentStep = instance.template.steps.find((s) => s.step_order === currentStepOrder);
      if (!currentStep) return errorResponse('Current workflow step not found', 500);

      const stepConfig = {
        ...currentStep,
        required_roles: currentStep.required_roles ? JSON.parse(currentStep.required_roles as string) : null,
        conditional_rules: currentStep.conditional_rules ? JSON.parse(currentStep.conditional_rules as string) : null,
      };

      // Resolve approvers for current step
      const resolvedApproverIds = await resolveApprovers(
        currentStepOrder,
        instance.id,
        workflowLocationId,
        { stepConfig }
      );

      if (!resolvedApproverIds.length) {
        return errorResponse(
          `No approvers resolved for step ${currentStepOrder}. Cannot auto-run.`,
          400
        );
      }

      // Pick the first approver that truly has authority (covers delegation overlay)
      let selectedApproverId: string | null = null;
      for (const approverId of resolvedApproverIds) {
        const authority = await checkAuthority({
          userId: approverId,
          permission: stepConfig.required_permission,
          locationId: workflowLocationId,
          workflowStepOrder: currentStepOrder,
          workflowInstanceId: instance.id,
        });
        if (authority.authorized) {
          selectedApproverId = approverId;
          break;
        }
      }

      if (!selectedApproverId) {
        return errorResponse(
          `Approvers resolved for step ${currentStepOrder}, but none have authority. Cannot auto-run.`,
          403
        );
      }

      // Approve step instance
      await prisma.workflowStepInstance.update({
        where: {
          workflow_instance_id_step_order: {
            workflow_instance_id: instance.id,
            step_order: currentStepOrder,
          },
        },
        data: {
          status: 'approved',
          acted_by: selectedApproverId,
          acted_at: new Date(),
          comment: `Auto-run approval (impersonated approver ${selectedApproverId})`,
        },
      });

      // Advance to next step or complete
      const lastStepOrder = instance.template.steps[instance.template.steps.length - 1]?.step_order;
      const isLast = currentStepOrder === lastStepOrder;

      if (isLast) {
        await prisma.workflowInstance.update({
          where: { id: instance.id },
          data: {
            status: 'Approved',
          },
        });
      } else {
        const nextStep = instance.template.steps.find((s) => s.step_order > currentStepOrder);
        if (!nextStep) {
          await prisma.workflowInstance.update({
            where: { id: instance.id },
            data: { status: 'Approved' },
          });
        } else {
          await prisma.workflowInstance.update({
            where: { id: instance.id },
            data: {
              status: 'UnderReview',
              current_step_order: nextStep.step_order,
            },
          });
        }
      }

      approvalsPerformed++;

      // Reload instance status / current_step_order for next loop iteration
      const refreshed = await prisma.workflowInstance.findUnique({
        where: { id: instance.id },
        include: {
          template: { include: { steps: { orderBy: { step_order: 'asc' } }, location: { select: { id: true, name: true } } } },
          steps: { orderBy: { step_order: 'asc' } },
          creator: { select: { id: true, name: true, email: true, manager_id: true, primary_location_id: true } },
        },
      });
      if (!refreshed) break;
      // @ts-expect-error reassign for loop
      (instance as any).status = refreshed.status;
      // @ts-expect-error reassign for loop
      (instance as any).current_step_order = refreshed.current_step_order;
      // @ts-expect-error reassign for loop
      (instance as any).steps = refreshed.steps;
      // @ts-expect-error reassign for loop
      (instance as any).template = refreshed.template;
      // @ts-expect-error reassign for loop
      (instance as any).creator = refreshed.creator;
    }

    // Build response using the same structure as simulate/approve
    const updated = await prisma.workflowInstance.findUnique({
      where: { id: instance.id },
      include: {
        template: {
          include: {
            steps: { orderBy: { step_order: 'asc' } },
            location: { select: { id: true, name: true } },
          },
        },
        steps: { orderBy: { step_order: 'asc' } },
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

    if (!updated) return errorResponse('Failed to update simulation', 500);

    const stepsWithParsed = updated.template.steps.map((step) => ({
      ...step,
      required_roles: step.required_roles ? JSON.parse(step.required_roles as string) : null,
      conditional_rules: step.conditional_rules ? JSON.parse(step.conditional_rules as string) : null,
    }));

    const simulationSteps = await Promise.all(
      stepsWithParsed.map(async (step) => {
        const stepInstance = updated.steps.find((s) => s.step_order === step.step_order);
        const isCurrent = updated.current_step_order === step.step_order;

        const approverIds = await resolveApprovers(
          step.step_order,
          updated.id,
          workflowLocationId,
          { stepConfig: step }
        );

        const approvers = await prisma.user.findMany({
          where: { id: { in: approverIds }, status: 'active', deleted_at: null },
          include: {
            user_roles: {
              where: { deleted_at: null },
              include: { role: { select: { id: true, name: true } } },
            },
          },
        });

        const approversWithSource = approvers.map((approver) => {
          let source: 'manager' | 'role' | 'permission' = 'permission';
          let roleName: string | null = null;
          
          if (updated.creator.manager_id === approver.id) {
            source = 'manager';
            roleName = approver.user_roles.find(ur => ur.role)?.role?.name || 'Manager';
          } else if (step.required_roles && approver.user_roles.some((ur) => step.required_roles.includes(ur.role.id))) {
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
        if (stepInstance?.status === 'approved') status = 'approved';
        else if (stepInstance?.status === 'declined') status = 'declined';
        else if (isCurrent) status = 'in_progress';

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
      simulation_id: updated.id,
      resource_id: updated.resource_id,
      resource_type: updated.resource_type,
      template: { ...updated.template, steps: stepsWithParsed },
      current_step: updated.current_step_order,
      status:
        updated.status === 'Approved'
          ? 'completed'
          : updated.status === 'Declined'
            ? 'declined'
            : 'running',
      steps: simulationSteps,
      employee: { id: updated.creator.id, name: updated.creator.name, email: updated.creator.email },
      auto_run: {
        approvalsPerformed,
        maxSteps: max_steps,
      },
    };

    return successResponse(simulation);
  } catch (error: any) {
    console.error('Error auto-running simulation:', error);
    return errorResponse(error.message || 'Internal server error', 500);
  }
}

