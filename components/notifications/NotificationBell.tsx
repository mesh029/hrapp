'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/ui/src/contexts/auth-context';
import { api } from '@/ui/src/services/api';
import { useRouter } from 'next/navigation';

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (user?.id) {
      loadNotifications();
      // Refresh every 30 seconds
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/api/notifications?limit=10&is_read=false');
      if (response.success && response.data) {
        const data = response.data as any;
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Mark as read
    if (notification.id) {
      api.patch(`/api/notifications/${notification.id}`, { is_read: true });
    }

    // Navigate to resource if available
    if (notification.resource_type && notification.resource_id) {
      if (notification.resource_type === 'leave') {
        router.push(`/leave/requests/${notification.resource_id}`);
      } else if (notification.resource_type === 'timesheet') {
        router.push(`/timesheets/${notification.resource_id}`);
      } else if (notification.resource_type === 'workflow') {
        // Could navigate to workflow instance view if we have one
      }
    }

    setIsOpen(false);
    loadNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/notifications', { is_read: true });
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No unread notifications
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left p-4 hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-sm">{notification.title}</div>
                      {notification.message && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(notification.created_at).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/notifications');
                  }}
                >
                  View all notifications
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
