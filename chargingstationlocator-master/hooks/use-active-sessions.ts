import { useState, useEffect, useCallback } from 'react';
import { ChargingSession, ActiveSessionsResponse } from '@/types/queue';
import { useWebSocket } from './use-websocket';
import { 
  apiCall, 
  getUserFriendlyErrorMessage, 
  isRetryableError,
  ErrorCode 
} from '@/lib/error-handling';

// Define types for WebSocket messages
interface QueueUpdateMessage {
  type: 'QUEUE_UPDATE';
  stationId: string;
  newQueueLength: number;
  timestamp: string;
  updatedBy?: string;
}

interface UserNotificationMessage {
  type: 'USER_NOTIFICATION';
  userId: string;
  sessionId?: string;
  notificationType: 'position_update' | 'next_in_line' | 'station_available';
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
}

export function useActiveSessions() {
  const [sessions, setSessions] = useState<ChargingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize WebSocket connection
  const {
    subscribeToStation,
    unsubscribeFromStation,
    onQueueUpdate,
    onUserNotification,
    isConnected
  } = useWebSocket({
    autoConnect: true
  });

  // Fetch active sessions
  const fetchActiveSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiCall<{ data: ActiveSessionsResponse }>('/api/sessions/active', {}, {
        maxAttempts: 3,
        retryableErrors: [ErrorCode.NETWORK_ERROR, ErrorCode.TIMEOUT_ERROR, ErrorCode.INTERNAL_ERROR]
      });

      setSessions(response.data?.sessions || []);

      // Subscribe to WebSocket updates for each station
      response.data?.sessions.forEach(session => {
        if (session.stationId) {
          subscribeToStation(session.stationId);
        }
      });
    } catch (err: any) {
      console.error('Error fetching active sessions:', err);
      setError(getUserFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Complete a charging session
  const completeSession = async (sessionId: string, stationId: string) => {
    try {
      setError(null);

      const response = await apiCall('/api/sessions/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, stationId }),
      }, {
        maxAttempts: 3,
        retryableErrors: [
          ErrorCode.NETWORK_ERROR, 
          ErrorCode.TIMEOUT_ERROR, 
          ErrorCode.CONCURRENT_UPDATE,
          ErrorCode.QUEUE_UPDATE_FAILED
        ]
      });

      // Remove the completed session from the list
      setSessions((prevSessions) =>
        prevSessions.filter((session) => session.id !== sessionId)
      );

      // Unsubscribe from the station if no other active sessions for it
      const remainingSessions = sessions.filter(
        session => session.id !== sessionId && session.stationId === stationId
      );

      if (remainingSessions.length === 0) {
        unsubscribeFromStation(stationId);
      }

      return response;
    } catch (err: any) {
      console.error('Error completing session:', err);
      const errorMessage = getUserFriendlyErrorMessage(err);
      setError(errorMessage);
      throw err;
    }
  };

  // Handle queue updates from WebSocket
  const handleQueueUpdate = useCallback((update: QueueUpdateMessage) => {
    // Update queue position for sessions at this station
    setSessions(prevSessions =>
      prevSessions.map(session => {
        if (session.stationId === update.stationId) {
          // If this session's station had a queue update, refresh the queue position
          // In a real implementation, the server would send the updated queue positions
          // Here we're just updating the timestamp to show it was updated
          return {
            ...session,
            lastUpdated: update.timestamp
          };
        }
        return session;
      })
    );
  }, []);

  // Handle user notifications from WebSocket
  const handleUserNotification = useCallback((notification: UserNotificationMessage) => {
    // Handle notifications related to active sessions
    if (notification.notificationType === 'next_in_line') {
      // Update the session to indicate the user is next in line
      setSessions(prevSessions =>
        prevSessions.map(session => {
          if (session.id === notification.sessionId) {
            return {
              ...session,
              queuePosition: 1,
              isNextInLine: true
            };
          }
          return session;
        })
      );
    } else if (notification.notificationType === 'position_update') {
      // Refresh sessions to get updated positions
      fetchActiveSessions();
    }
  }, [fetchActiveSessions]);

  // Register WebSocket event handlers
  useEffect(() => {
    onQueueUpdate(handleQueueUpdate);
    onUserNotification(handleUserNotification);
  }, [onQueueUpdate, onUserNotification, handleQueueUpdate, handleUserNotification]);

  // Fetch sessions on component mount and when WebSocket connects
  useEffect(() => {
    fetchActiveSessions();
  }, [isConnected]);

  // Cleanup WebSocket subscriptions on unmount
  useEffect(() => {
    return () => {
      // Unsubscribe from all stations when component unmounts
      sessions.forEach(session => {
        if (session.stationId) {
          unsubscribeFromStation(session.stationId);
        }
      });
    };
  }, [sessions, unsubscribeFromStation]);

  return {
    sessions,
    isLoading,
    error,
    fetchActiveSessions,
    completeSession,
  };
}