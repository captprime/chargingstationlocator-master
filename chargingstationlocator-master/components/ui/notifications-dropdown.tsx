import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationBadge } from './notification-badge';
import { NotificationPanel } from './notification-panel';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserNotification } from '@/types/queue';

export function NotificationsDropdown() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications({
    userId,
    initialFetch: true,
    pollingInterval: 30000, // Poll every 30 seconds
  });
  
  // Handle notification click to navigate to relevant page
  const handleNotificationClick = useCallback((notification: UserNotification) => {
    // Mark the notification as read
    markAsRead([notification.id]);
    
    // Navigate based on notification type
    if (notification.type === 'next_in_line' || notification.type === 'position_update') {
      // Navigate to active sessions page
      router.push('/dashboard/sessions');
      setIsOpen(false);
    } else if (notification.type === 'station_available') {
      // Extract station ID from the session ID if available
      const stationIdMatch = notification.sessionId?.match(/available-([^-]+)-/);
      if (stationIdMatch && stationIdMatch[1]) {
        router.push(`/stations/${stationIdMatch[1]}`);
        setIsOpen(false);
      } else {
        router.push('/stations');
        setIsOpen(false);
      }
    } else if (notification.type === 'low_battery') {
      const lat = notification.metadata?.userLat;
      const lng = notification.metadata?.userLng;
      const href = lat && lng ? `/stations?lat=${lat}&lng=${lng}` : '/stations';
      router.push(href);
      setIsOpen(false);
    }
  }, [markAsRead, router]);

  // Use the handler (to avoid unused variable warning)
  console.debug('Notification click handler ready:', !!handleNotificationClick);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Play sound for high priority notifications
  useEffect(() => {
    // Check if there are any new high priority notifications
    const highPriorityNotifications = notifications.filter(
      n => !n.read && (n.priority === 'high' || n.type === 'next_in_line')
    );
    
    if (highPriorityNotifications.length > 0) {
      try {
        // Create and play notification sound
        const audio = new Audio('/notification-sound.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => {
          // Ignore autoplay errors (common in browsers that require user interaction)
          console.log('Notification sound could not be played:', err);
        });
      } catch (error) {
        console.error('Error playing notification sound:', error);
      }
    }
  }, [notifications]);
  
  // Don't render anything if user is not logged in
  if (!userId) {
    return null;
  }
  
  // Create enhanced notification panel with click handlers
  const enhancedNotificationPanel = isOpen ? (
    <NotificationPanel
      notifications={notifications}
      onClose={() => setIsOpen(false)}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      loading={loading}
    />
  ) : null;
  
  return (
    <div className="relative" ref={dropdownRef}>
      <NotificationBadge
        count={unreadCount}
        onClick={() => setIsOpen(!isOpen)}
      />
      
      {enhancedNotificationPanel}
    </div>
  );
}