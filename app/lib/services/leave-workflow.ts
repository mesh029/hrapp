import { prisma } from '@/lib/db';
import { approveLeaveDays, removePendingDays } from './leave-balance';
import { addLeaveEntryToTimesheet } from './timesheet';

/**
 * Handle workflow approval for leave request
 * Called when workflow instance is fully approved
 */
export async function handleLeaveRequestApproval(workflowInstanceId: string): Promise<void> {
  // Get workflow instance with resource
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstanceId },
    include: {
      creator: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!instance || instance.resource_type !== 'leave') {
    return; // Not a leave request workflow
  }

  // Get leave request
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: instance.resource_id },
    include: {
      leave_type: true,
    },
  });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  // Update leave request status
  await prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: 'Approved',
    },
  });

  // Move pending days to used days in leave balance
  const year = new Date(leaveRequest.start_date).getFullYear();
  await approveLeaveDays(
    leaveRequest.user_id,
    leaveRequest.leave_type_id,
    year,
    leaveRequest.days_requested.toNumber()
  );

  // Auto-create/update timesheet entries for approved leave
  try {
    await addLeaveEntryToTimesheet(leaveRequest.id);
  } catch (error) {
    // Log error but don't fail the approval
    console.error('Failed to update timesheet for leave approval:', error);
  }
}

/**
 * Handle workflow decline for leave request
 * Called when workflow instance is declined
 */
export async function handleLeaveRequestDecline(workflowInstanceId: string): Promise<void> {
  // Get workflow instance with resource
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstanceId },
  });

  if (!instance || instance.resource_type !== 'leave') {
    return; // Not a leave request workflow
  }

  // Get leave request
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: instance.resource_id },
    include: {
      leave_type: true,
    },
  });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  // Update leave request status
  await prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: 'Declined',
    },
  });

  // Remove pending days from leave balance
  const year = new Date(leaveRequest.start_date).getFullYear();
  await removePendingDays(
    leaveRequest.user_id,
    leaveRequest.leave_type_id,
    year,
    leaveRequest.days_requested.toNumber()
  );
}

/**
 * Handle workflow adjustment for leave request
 * Called when workflow instance is adjusted (routed back to employee)
 */
export async function handleLeaveRequestAdjust(workflowInstanceId: string): Promise<void> {
  // Get workflow instance with resource
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstanceId },
  });

  if (!instance || instance.resource_type !== 'leave') {
    return; // Not a leave request workflow
  }

  // Get leave request
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: instance.resource_id },
  });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  // Update leave request status to Adjusted (employee can edit and resubmit)
  await prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: 'Adjusted',
    },
  });

  // Note: We keep pending days - they'll be removed if employee cancels or resubmits with different dates
}

/**
 * Handle workflow cancellation for leave request
 * Called when workflow instance is cancelled
 */
export async function handleLeaveRequestCancel(workflowInstanceId: string): Promise<void> {
  // Get workflow instance with resource
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: workflowInstanceId },
  });

  if (!instance || instance.resource_type !== 'leave') {
    return; // Not a leave request workflow
  }

  // Get leave request
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: instance.resource_id },
    include: {
      leave_type: true,
    },
  });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  // Update leave request status
  await prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: 'Cancelled',
    },
  });

  // Remove pending days from leave balance if they were added
  if (leaveRequest.status === 'Submitted' || leaveRequest.status === 'UnderReview') {
    const year = new Date(leaveRequest.start_date).getFullYear();
    await removePendingDays(
      leaveRequest.user_id,
      leaveRequest.leave_type_id,
      year,
      leaveRequest.days_requested.toNumber()
    );
  }
}
