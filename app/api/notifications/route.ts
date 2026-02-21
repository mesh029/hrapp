import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/middleware/auth';
import { requirePermission } from '@/lib/middleware/permissions';
import { paginationSchema } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/responses';
import { getNotificationsForUser } from '@/lib/services/notification';

/**
 * GET /api/notifications
 * List notifications for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const isRead = searchParams.get('is_read') === 'true' ? true : searchParams.get('is_read') === 'false' ? false : undefined;
    const type = searchParams.get('type') as any;

    const result = await getNotificationsForUser(user.id, {
      isRead,
      type,
      limit,
      offset: (page - 1) * limit,
    });

    return successResponse({
      notifications: result.notifications,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      unreadCount: result.unreadCount,
    });
  } catch (error: any) {
    console.error('Error listing notifications:', error);
    return errorResponse(error.message || 'Failed to list notifications', 500);
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read (bulk or all)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { notificationIds, markAll } = body;

    if (markAll) {
      const { markAllNotificationsAsRead } = await import('@/lib/services/notification');
      const result = await markAllNotificationsAsRead(user.id);
      return successResponse({ count: result.count });
    }

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return errorResponse('notificationIds array is required', 400);
    }

    const { markNotificationAsRead } = await import('@/lib/services/notification');
    const results = await Promise.all(
      notificationIds.map((id: string) =>
        markNotificationAsRead(id, user.id).catch((error) => {
          console.error(`Failed to mark notification ${id} as read:`, error);
          return null;
        })
      )
    );

    const successful = results.filter((r) => r !== null).length;

    return successResponse({
      marked: successful,
      total: notificationIds.length,
    });
  } catch (error: any) {
    console.error('Error marking notifications as read:', error);
    return errorResponse(error.message || 'Failed to mark notifications as read', 500);
  }
}
