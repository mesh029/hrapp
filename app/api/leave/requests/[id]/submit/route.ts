import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { createWorkflowInstance, submitWorkflowInstance } from '@/lib/services/workflow';
import { addPendingDays } from '@/lib/services/leave-balance';

/**
 * POST /api/leave/requests/[id]/submit
 * Submit a leave request for approval (creates workflow instance)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave request ID', 400);
    }

    // Get leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        leave_type: true,
        location: true,
      },
    });

    if (!leaveRequest || leaveRequest.deleted_at) {
      return notFoundResponse('Leave request not found');
    }

    // Only creator can submit
    if (leaveRequest.user_id !== user.id) {
      return unauthorizedResponse('Only the creator can submit this leave request');
    }

    // Can only submit if in Draft or Adjusted status
    if (leaveRequest.status !== 'Draft' && leaveRequest.status !== 'Adjusted') {
      return errorResponse('Leave request can only be submitted when in Draft or Adjusted status', 400);
    }

    // If resubmitting after adjustment, remove old pending days first
    if (leaveRequest.status === 'Adjusted' && leaveRequest.workflow_instance_id) {
      const { removePendingDays } = await import('@/lib/services/leave-balance');
      const year = new Date(leaveRequest.start_date).getFullYear();
      await removePendingDays(
        user.id,
        leaveRequest.leave_type_id,
        year,
        leaveRequest.days_requested.toNumber()
      );
    }

    // Find workflow template for this location and resource type
    const workflowTemplate = await prisma.workflowTemplate.findFirst({
      where: {
        resource_type: 'leave',
        location_id: leaveRequest.location_id,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    });

    if (!workflowTemplate) {
      return errorResponse('No workflow template found for this location and resource type', 400);
    }

    let workflowInstanceId = leaveRequest.workflow_instance_id;

    // Create new workflow instance if resubmitting after adjustment or if none exists
    if (!workflowInstanceId || leaveRequest.status === 'Adjusted') {
      workflowInstanceId = await createWorkflowInstance({
        templateId: workflowTemplate.id,
        resourceId: leaveRequest.id,
        resourceType: 'leave',
        createdBy: user.id,
        locationId: leaveRequest.location_id,
      });
    }

    // Submit workflow instance (moves to first step)
    await submitWorkflowInstance(workflowInstanceId);

    // Add pending days to leave balance
    const year = new Date(leaveRequest.start_date).getFullYear();
    await addPendingDays(
      user.id,
      leaveRequest.leave_type_id,
      year,
      leaveRequest.days_requested.toNumber()
    );

    // Update leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: params.id },
      data: {
        status: 'Submitted',
        workflow_instance_id: workflowInstanceId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        leave_type: {
          select: {
            id: true,
            name: true,
            is_paid: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return successResponse({
      ...updatedRequest,
      days_requested: updatedRequest.days_requested.toNumber(),
    }, 'Leave request submitted for approval');
  } catch (error: any) {
    console.error('Submit leave request error:', error);
    if (error.message.includes('Unauthorized')) {
      return unauthorizedResponse(error.message);
    }
    return errorResponse(error.message || 'Internal server error', 500);
  }
}
