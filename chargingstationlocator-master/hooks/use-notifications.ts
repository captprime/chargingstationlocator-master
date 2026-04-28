import { useState, useEffect, useCallback } from 'react';
import { UserNotification } from '@/types/queue';
import { useWebSocket } from './use-websocket';

interface UseNotificationsOptions {
  userId?: string;
  initialFetch?: boolean;
  pollingInterval?: number | null; // Set to null to disable polling
}

export function useNotifications({
  userId,
  initialFetch = true,
  pollingInterval = 30000, // Default: poll every 30 seconds
}: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const webSocket = useWebSocket();
  
  // Fetch notifications from the API
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/notifications?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`);
      }
      
      const data = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter((n: UserNotification) => !n.read).length);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [userId]);
  
  // Mark notifications as read
  const markAsRead = useCallback(async (notificationIds: string[]) => {
    if (!userId || notificationIds.length === 0) return;
    
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationIds, userId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to mark notifications as read: ${response.status}`);
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notificationIds.includes(notification.id) 
            ? { ...notification, read: true } 
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  }, [userId]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    
    const unreadIds = notifications
      .filter(notification => !notification.read)
      .map(notification => notification.id);
    
    if (unreadIds.length === 0) return;
    
    await markAsRead(unreadIds);
  }, [userId, notifications, markAsRead]);
  
  // Handle real-time notifications via WebSocket
  const handleNotification = useCallback((message: any) => {
    if (message.type === 'USER_NOTIFICATION' && message.userId === userId) {
      // Create a new notification object from the WebSocket message
      const newNotification: UserNotification = {
        id: `temp-${Date.now()}`, // Temporary ID until next fetch
        userId: message.userId,
        sessionId: message.sessionId || '',
        type: message.notificationType,
        message: message.message,
        priority: message.priority,
        read: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add to local state
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Trigger a fetch to get the proper notification with server-generated ID
      fetchNotifications();
    }
  }, [userId, fetchNotifications]);
  
  // Set up initial fetch and polling
  useEffect(() => {
    if (initialFetch && userId) {
      fetchNotifications();
    }
    
    // Set up polling if enabled
    let pollInterval: NodeJS.Timeout | null = null;
    if (pollingInterval && userId) {
      pollInterval = setInterval(fetchNotifications, pollingInterval);
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [initialFetch, userId, pollingInterval, fetchNotifications]);
  
  // Set up WebSocket subscription
  useEffect(() => {
    if (userId) {
      // Subscribe to user-specific notifications
      webSocket.onUserNotification(handleNotification);
      
      // Ensure user is authenticated with WebSocket service
      if (webSocket.isConnected) {
        // The WebSocket service will automatically authenticate when connected
        // based on the session data
      } else {
        // Try to connect if not already connected
        webSocket.connect();
      }
      
      return () => {
        // No need to explicitly unsubscribe as the WebSocket service
        // handles message routing based on userId
      };
    }
  }, [userId, webSocket, handleNotification]);
  
  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}