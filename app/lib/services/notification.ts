import { prisma } from '@/lib/db';
import { NotificationType } from '@prisma/client';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  sendEmail?: boolean;
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, message, resourceType, resourceId, sendEmail = false } = params;

  const notification = await prisma.notification.create({
    data: {
      user_id: userId,
      type,
      title,
      message,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      email_sent: false,
    },
  });

  // Send email if requested and SMTP is configured
  if (sendEmail) {
    await sendNotificationEmail(notification.id, userId, title, message).catch((error) => {
      console.error('Failed to send notification email:', error);
      // Don't fail the notification creation if email fails
    });
  }

  return notification;
}

/**
 * Create notifications for multiple users
 */
export async function createNotificationsForUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  const notifications = await Promise.all(
    userIds.map((userId) =>
      createNotification({
        ...params,
        userId,
      })
    )
  );

  return notifications;
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.user_id !== userId) {
    throw new Error('Unauthorized: Cannot mark another user\'s notification as read');
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: {
      user_id: userId,
      is_read: false,
    },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  });
}

/**
 * Get notifications for a user
 */
export async function getNotificationsForUser(
  userId: string,
  options?: {
    isRead?: boolean;
    type?: NotificationType;
    limit?: number;
    offset?: number;
  }
) {
  const { isRead, type, limit = 50, offset = 0 } = options || {};

  const where: any = {
    user_id: userId,
  };

  if (isRead !== undefined) {
    where.is_read = isRead;
  }

  if (type) {
    where.type = type;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    unreadCount: await prisma.notification.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    }),
  };
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  if (notification.user_id !== userId) {
    throw new Error('Unauthorized: Cannot delete another user\'s notification');
  }

  return await prisma.notification.delete({
    where: { id: notificationId },
  });
}

/**
 * Send notification email (if SMTP configured)
 */
async function sendNotificationEmail(
  notificationId: string,
  userId: string,
  title: string,
  message: string
) {
  // TODO: Implement email sending when SMTP is configured
  // For now, just mark as sent
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      email_sent: true,
      email_sent_at: new Date(),
    },
  });
}

/**
 * Notification helpers for common scenarios
 */
export const NotificationHelpers = {
  /**
   * Notify approver of new workflow step assignment
   */
  async notifyWorkflowStepAssignment(
    approverId: string,
    workflowInstanceId: string,
    resourceType: string,
    resourceId: string,
    stepOrder: number
  ) {
    return createNotification({
      userId: approverId,
      type: 'approval_request',
      title: 'New Approval Request',
      message: `You have been assigned to approve ${resourceType} #${resourceId} at step ${stepOrder}`,
      resourceType: 'workflow',
      resourceId: workflowInstanceId,
      sendEmail: true,
    });
  },

  /**
   * Notify requester of workflow completion
   */
  async notifyWorkflowComplete(
    requesterId: string,
    workflowInstanceId: string,
    resourceType: string,
    resourceId: string,
    status: 'Approved' | 'Declined' | 'Adjusted'
  ) {
    return createNotification({
      userId: requesterId,
      type: 'approval_complete',
      title: `${resourceType} ${status}`,
      message: `Your ${resourceType} request #${resourceId} has been ${status.toLowerCase()}`,
      resourceType,
      resourceId,
      sendEmail: true,
    });
  },

  /**
   * Notify next approver (if exists) or requester
   */
  async notifyNextApproverOrRequester(
    userId: string,
    workflowInstanceId: string,
    resourceType: string,
    resourceId: string,
    isRequester: boolean
  ) {
    if (isRequester) {
      return NotificationHelpers.notifyWorkflowComplete(
        userId,
        workflowInstanceId,
        resourceType,
        resourceId,
        'Approved'
      );
    }

    return NotificationHelpers.notifyWorkflowStepAssignment(
      userId,
      workflowInstanceId,
      resourceType,
      resourceId,
      0 // Step order will be determined by workflow
    );
  },

  /**
   * Notify leave status change
   */
  async notifyLeaveStatusChange(
    userId: string,
    leaveRequestId: string,
    status: string
  ) {
    return createNotification({
      userId,
      type: 'leave_status',
      title: `Leave Request ${status}`,
      message: `Your leave request #${leaveRequestId} status has been updated to ${status}`,
      resourceType: 'leave',
      resourceId: leaveRequestId,
      sendEmail: true,
    });
  },

  /**
   * Notify timesheet status change
   */
  async notifyTimesheetStatusChange(
    userId: string,
    timesheetId: string,
    status: string
  ) {
    return createNotification({
      userId,
      type: 'timesheet_status',
      title: `Timesheet ${status}`,
      message: `Your timesheet #${timesheetId} status has been updated to ${status}`,
      resourceType: 'timesheet',
      resourceId: timesheetId,
      sendEmail: true,
    });
  },

  /**
   * Notify delegation assignment
   */
  async notifyDelegationAssigned(
    delegateId: string,
    delegationId: string,
    permissionName: string
  ) {
    return createNotification({
      userId: delegateId,
      type: 'delegation',
      title: 'Delegation Assigned',
      message: `You have been delegated the permission: ${permissionName}`,
      resourceType: 'delegation',
      resourceId: delegationId,
      sendEmail: true,
    });
  },

  /**
   * Notify delegation revoked
   */
  async notifyDelegationRevoked(
    delegateId: string,
    delegationId: string,
    permissionName: string
  ) {
    return createNotification({
      userId: delegateId,
      type: 'delegation',
      title: 'Delegation Revoked',
      message: `Your delegation for ${permissionName} has been revoked`,
      resourceType: 'delegation',
      resourceId: delegationId,
      sendEmail: true,
    });
  },
};
