import React from 'react';
import { UserNotification } from '@/types/queue';
import { formatDistanceToNow } from 'date-fns';
import { X, Bell, BellRing, Check, AlertCircle, Clock } from 'lucide-react';

interface NotificationPanelProps {
  notifications: UserNotification[];
  onClose: () => void;
  onMarkAsRead: (notificationIds: string[]) => void;
  onMarkAllAsRead: () => void;
  loading?: boolean;
}

export function NotificationPanel({
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  loading = false
}: NotificationPanelProps) {
  // Function to get appropriate icon based on notification type and priority
  const getNotificationIcon = (type: string, priority: string) => {
    if (type === 'next_in_line') {
      return <AlertCircle className="h-5 w-5 text-green-500" />;
    } else if (type === 'station_available') {
      return <Clock className="h-5 w-5 text-green-500" />;
    } else if (type === 'low_battery') {
      return <BellRing className={`h-5 w-5 ${priority === 'high' ? 'text-red-500' : 'text-amber-500'}`} />;
    } else if (priority === 'high') {
      return <BellRing className="h-5 w-5 text-red-500" />;
    } else if (priority === 'medium') {
      return <Bell className="h-5 w-5 text-amber-500" />;
    } else {
      return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  // Function to get appropriate background color based on priority and type
  const getNotificationBackground = (type: string, priority: string, read: boolean) => {
    if (read) return 'bg-gray-50 dark:bg-gray-800';
    
    if (type === 'next_in_line' || type === 'station_available') {
      return 'bg-green-50 dark:bg-green-900/20';
    }
    
    switch (priority) {
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'medium':
        return 'bg-amber-50 dark:bg-amber-900/20';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-md shadow-lg z-50 max-h-[80vh] flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-medium">Notifications</h3>
        <div className="flex space-x-2">
          {notifications.some(n => !n.read) && (
            <button
              onClick={onMarkAllAsRead}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              disabled={loading}
            >
              Mark all as read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close notifications"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-grow">
        {loading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No notifications
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`${getNotificationBackground(notification.type, notification.priority, notification.read)} p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {notification.message}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                      {!notification.read && (
                        <button
                          onClick={() => onMarkAsRead([notification.id])}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                          disabled={loading}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}