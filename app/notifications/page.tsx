'use client';

import * as React from 'react';
import { MainLayout } from '@/components/layouts/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/ui/src/services/api';
import { Bell, Check, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NotificationItem {
  id: string;
  title: string;
  message?: string | null;
  created_at: string;
  is_read: boolean;
  resource_type?: string | null;
  resource_id?: string | null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadNotifications = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<any>('/api/notifications?limit=100&page=1');
      if (response?.success && response?.data) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/notifications', { markAll: true });
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await api.patch(`/api/notifications/${notificationId}`, { is_read: true });
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await api.delete(`/api/notifications/${notificationId}`);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    try {
      if (!notification.is_read) {
        await api.patch(`/api/notifications/${notification.id}`, { is_read: true });
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    if (notification.resource_type === 'leave' && notification.resource_id) {
      router.push(`/leave/requests/${notification.resource_id}`);
      return;
    }
    if (notification.resource_type === 'timesheet' && notification.resource_id) {
      router.push(`/timesheets/${notification.resource_id}`);
      return;
    }
    if (notification.resource_type === 'workflow') {
      const match = String(notification.message || '').match(
        /(leave|timesheet)\s+#([0-9a-fA-F-]{36})/i
      );
      if (match) {
        const resourceType = match[1].toLowerCase();
        const resourceId = match[2];
        if (resourceType === 'leave') {
          router.push(`/leave/requests/${resourceId}`);
        } else {
          router.push(`/timesheets/${resourceId}`);
        }
      } else {
        router.push('/approvals/pending');
      }
      return;
    }

    await loadNotifications();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">Track workflow and request updates</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount} unread</Badge>}
            <Button onClick={handleMarkAllRead} variant="outline" disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              All Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-sm text-muted-foreground">No notifications found.</div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="border border-border rounded-md p-4 flex items-start justify-between gap-4"
                  >
                    <button
                      type="button"
                      className="space-y-1 min-w-0 text-left flex-1"
                      onClick={() => handleOpenNotification(notification)}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{notification.title}</p>
                        {!notification.is_read && <Badge variant="secondary">Unread</Badge>}
                      </div>
                      {notification.message && (
                        <p className="text-sm text-muted-foreground break-words">{notification.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!notification.is_read && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkRead(notification.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => handleDelete(notification.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
