import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/middleware/auth';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getNotificationsForUser, deleteNotification, markNotificationAsRead } from '@/lib/services/notification';

/**
 * GET /api/notifications/:id
 * Get notification details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = params;

    // Get user's notifications to verify ownership
    const result = await getNotificationsForUser(user.id, { limit: 1000 });
    const notification = result.notifications.find((n) => n.id === id);

    if (!notification) {
      return errorResponse('Notification not found', 404);
    }

    return successResponse(notification);
  } catch (error: any) {
    console.error('Error getting notification:', error);
    return errorResponse(error.message || 'Failed to get notification', 500);
  }
}

/**
 * PATCH /api/notifications/:id
 * Mark notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = params;

    const notification = await markNotificationAsRead(id, user.id);

    return successResponse(notification);
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return errorResponse(error.message || 'Failed to mark notification as read', 500);
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete notification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = params;

    await deleteNotification(id, user.id);

    return successResponse({ message: 'Notification deleted' });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return errorResponse(error.message || 'Failed to delete notification', 500);
  }
}
