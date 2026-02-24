import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { resolveApprovers } from '@/lib/services/workflow';

/**
 * GET /api/workflows/instances/pending
 * Get workflow instances pending approval by the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get all pending workflow instances (Submitted or UnderReview status)
    const pendingInstances = await prisma.workflowInstance.findMany({
      where: {
        status: { in: ['Submitted', 'UnderReview'] },
      },
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
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            primary_location_id: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Filter to only instances where the current user is an approver for the current step
    const userApprovals: any[] = [];

    for (const instance of pendingInstances) {
      const currentStep = instance.template.steps.find(
        s => s.step_order === instance.current_step_order
      );

      if (!currentStep) continue;

      const stepInstance = instance.steps.find(
        s => s.step_order === instance.current_step_order
      );

      // Skip if step is already approved/declined
      if (stepInstance?.status === 'approved' || stepInstance?.status === 'declined') {
        continue;
      }

      // Resolve approvers for this step
      const locationId = instance.template.location_id || 
                        instance.creator.primary_location_id || 
                        (await prisma.location.findFirst({ select: { id: true } }))?.id || '';

      try {
        const approverIds = await resolveApprovers(
          currentStep.step_order,
          instance.id,
          locationId,
          {
            stepConfig: {
              ...currentStep,
              required_roles: currentStep.required_roles 
                ? JSON.parse(currentStep.required_roles as string) 
                : null,
              conditional_rules: currentStep.conditional_rules 
                ? JSON.parse(currentStep.conditional_rules as string) 
                : null,
            },
          }
        );

        // Check if current user is one of the approvers
        if (approverIds.includes(user.id)) {
          userApprovals.push({
            id: instance.id,
            resource_type: instance.resource_type,
            resource_id: instance.resource_id,
            created_at: instance.created_at,
            current_step_order: instance.current_step_order,
            total_steps: instance.template.steps.length,
            creator: instance.creator,
            template: {
              name: instance.template.name,
            },
            step: {
              step_order: currentStep.step_order,
              required_permission: currentStep.required_permission,
              status: stepInstance?.status || 'pending',
            },
          });
        }
      } catch (error) {
        console.error(`Error resolving approvers for instance ${instance.id}:`, error);
        // Continue to next instance
      }
    }

    return successResponse({
      approvals: userApprovals,
      count: userApprovals.length,
    });
  } catch (error: any) {
    console.error('Error getting pending approvals:', error);
    return errorResponse(error.message || 'Failed to get pending approvals', 500);
  }
}
