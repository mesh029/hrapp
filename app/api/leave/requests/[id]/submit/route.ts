import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/responses';
import { uuidSchema } from '@/lib/utils/validation';
import { createWorkflowInstance, submitWorkflowInstance, findWorkflowTemplate } from '@/lib/services/workflow';
import { addPendingDays } from '@/lib/services/leave-balance';
import { checkPermission } from '@/lib/middleware/permissions';

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

    const userWithLocation = await prisma.user.findUnique({
      where: { id: user.id },
      select: { primary_location_id: true },
    });
    const permissionLocationId = userWithLocation?.primary_location_id || (await prisma.location.findFirst({ select: { id: true } }))?.id;
    if (!permissionLocationId) {
      return errorResponse('No location available for permission check', 400);
    }

    const canSubmitLeave =
      (await checkPermission(user, 'leave.submit', { locationId: permissionLocationId })) ||
      (await checkPermission(user, 'leave.create', { locationId: permissionLocationId })) ||
      (await checkPermission(user, 'system.admin', { locationId: permissionLocationId }));
    if (!canSubmitLeave) {
      return unauthorizedResponse('You do not have permission to submit leave requests');
    }

    // Validate UUID
    const validationResult = uuidSchema.safeParse(params.id);
    if (!validationResult.success) {
      return errorResponse('Invalid leave request ID', 400);
    }

    // Get leave request with user info
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        leave_type: true,
        location: true,
        user: {
          select: {
            id: true,
            staff_type_id: true,
          },
        },
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

    // Find workflow template matching location, staff type, and leave type
    const templateId = await findWorkflowTemplate({
      resourceType: 'leave',
      locationId: leaveRequest.location_id,
      staffTypeId: leaveRequest.user.staff_type_id,
      leaveTypeId: leaveRequest.leave_type_id,
    });

    if (!templateId) {
      return errorResponse('No workflow template found matching this leave request criteria (location, employee type, leave type)', 400);
    }

    let workflowInstanceId = leaveRequest.workflow_instance_id;

    // Create new workflow instance if resubmitting after adjustment or if none exists
    if (!workflowInstanceId || leaveRequest.status === 'Adjusted') {
      workflowInstanceId = await createWorkflowInstance({
        templateId: templateId,
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
            staff_number: true,
            charge_code: true,
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
