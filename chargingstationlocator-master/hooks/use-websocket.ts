'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// WebSocket message types
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

interface ConnectionMessage {
  type: 'CONNECTION_ESTABLISHED' | 'HEARTBEAT_ACK' | 'SUBSCRIPTION_CONFIRMED' | 'UNSUBSCRIPTION_CONFIRMED' | 'AUTHENTICATION_SUCCESS' | 'ERROR';
  stationId?: string;
  userId?: string;
  message?: string;
  timestamp: string;
}

type WebSocketMessage = QueueUpdateMessage | UserNotificationMessage | ConnectionMessage;

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  subscribeToStation: (stationId: string) => void;
  unsubscribeFromStation: (stationId: string) => void;
  onQueueUpdate: (callback: (update: QueueUpdateMessage) => void) => void;
  onUserNotification: (callback: (notification: UserNotificationMessage) => void) => void;
  subscribedStations: Set<string>;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000
  } = options;

  const { data: session } = useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const wsEndpointRef = useRef<string | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribedStations, setSubscribedStations] = useState<Set<string>>(new Set());

  // Refs to track current state values without causing re-renders
  const isConnectedRef = useRef(false);
  const isConnectingRef = useRef(false);

  // Callback refs for event handlers
  const queueUpdateCallbackRef = useRef<((update: QueueUpdateMessage) => void) | null>(null);
  const userNotificationCallbackRef = useRef<((notification: UserNotificationMessage) => void) | null>(null);

  // Fetch WebSocket endpoint from API
  const fetchWebSocketEndpoint = useCallback(async () => {
    try {
      // console.log('Fetching WebSocket endpoint from /api/ws/queue-updates');
      const response = await fetch('/api/ws/queue-updates');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch WebSocket endpoint:', response.status, errorText);
        throw new Error(`Failed to get WebSocket endpoint: ${response.status}`);
      }

      const data = await response.json();
      // console.log('WebSocket endpoint response:', data);

      if (!data.wsEndpoint) {
        throw new Error('WebSocket endpoint not provided in response');
      }

      return data.wsEndpoint;
    } catch (error) {
      console.error('Error fetching WebSocket endpoint:', error);
      return null;
    }
  }, []);

  // Send heartbeat to keep connection alive
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'HEARTBEAT'
      }));
    }
  }, []);

  // Start heartbeat mechanism
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'HEARTBEAT'
        }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  // Stop heartbeat mechanism
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Handle WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'CONNECTION_ESTABLISHED':
          // console.log('WebSocket connection established');
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          reconnectAttemptsRef.current = 0;
          isConnectedRef.current = true;
          isConnectingRef.current = false;

          // Authenticate if user is logged in
          if (session?.user?.id && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'AUTHENTICATE',
              userId: session.user.id
            }));
          }
          break;

        case 'HEARTBEAT_ACK':
          // Heartbeat acknowledged, connection is healthy
          break;

        case 'QUEUE_UPDATE':
          if (queueUpdateCallbackRef.current) {
            queueUpdateCallbackRef.current(message as QueueUpdateMessage);
          }
          break;

        case 'USER_NOTIFICATION':
          if (userNotificationCallbackRef.current) {
            userNotificationCallbackRef.current(message as UserNotificationMessage);
          }
          break;

        case 'AUTHENTICATION_SUCCESS':
          // console.log('WebSocket authentication successful');

          // Resubscribe to stations after authentication
          subscribedStations.forEach(stationId => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'SUBSCRIBE_STATION',
                stationId
              }));
            }
          });
          break;

        case 'SUBSCRIPTION_CONFIRMED':
          if (message.stationId) {
            setSubscribedStations(prev => {
              if (prev.has(message.stationId!)) {
                return prev; // No change needed, return same reference
              }
              return new Set(prev).add(message.stationId!);
            });
            // console.log(`Subscribed to station ${message.stationId}`);
          }
          break;

        case 'UNSUBSCRIPTION_CONFIRMED':
          if (message.stationId) {
            setSubscribedStations(prev => {
              if (!prev.has(message.stationId!)) {
                return prev; // No change needed, return same reference
              }
              const newSet = new Set(prev);
              newSet.delete(message.stationId!);
              return newSet;
            });
            // console.log(`Unsubscribed from station ${message.stationId}`);
          }
          break;

        case 'ERROR':
          console.error('WebSocket error:', message.message);
          const errorMessage = message.message || 'Connection error occurred';
          setError(errorMessage);

          // Attempt reconnection for certain types of errors
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            setTimeout(() => {
              console.log('Attempting to reconnect due to error...');
              connect();
            }, reconnectInterval);
          }
          break;

        default:
          console.warn('Unknown WebSocket message type:', message);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [session?.user?.id]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    if (isConnecting) {
      return; // Already connecting
    }

    setIsConnecting(true);
    setError(null);
    isConnectingRef.current = true;

    try {
      // Get WebSocket endpoint from API if not already cached
      if (!wsEndpointRef.current) {
        wsEndpointRef.current = await fetchWebSocketEndpoint();

        if (!wsEndpointRef.current) {
          throw new Error('WebSocket endpoint is not available. Please check if the WebSocket server is running.');
        }
      }

      // console.log(`Attempting to connect to WebSocket at ${wsEndpointRef.current}`);

      // Validate WebSocket URL format
      if (!wsEndpointRef.current.startsWith('ws://') && !wsEndpointRef.current.startsWith('wss://')) {
        throw new Error('Invalid WebSocket URL format');
      }

      wsRef.current = new WebSocket(wsEndpointRef.current);

      wsRef.current.onopen = () => {
        // console.log('WebSocket connection opened successfully');
        setIsConnected(true);
        setIsConnecting(false);
        isConnectedRef.current = true;
        isConnectingRef.current = false;
        startHeartbeat();
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        setError('Failed to establish WebSocket connection');
        setIsConnecting(false);
        isConnectingRef.current = false;
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onclose = (event) => {
        // console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        isConnectedRef.current = false;
        isConnectingRef.current = false;
        stopHeartbeat();

        // Handle errors based on close code
        if (event.code !== 1000) { // 1000 = normal closure
          let errorMessage = event.reason || `Connection closed with code ${event.code}`;

          // Provide more specific error messages for common codes
          switch (event.code) {
            case 1006:
              errorMessage = 'WebSocket server unavailable or network error';
              break;
            case 1002:
              errorMessage = 'WebSocket protocol error';
              break;
            case 1003:
              errorMessage = 'WebSocket data type error';
              break;
            case 1011:
              errorMessage = 'WebSocket server error';
              break;
            default:
              errorMessage = `Connection closed unexpectedly (code: ${event.code})`;
          }

          console.error('WebSocket error:', errorMessage);
          setError(errorMessage);
        }

        // Attempt reconnect only for certain error codes and if not manually disconnected
        const shouldReconnect = event.code !== 1000 &&
          event.code !== 1001 && // Going away
          reconnectAttemptsRef.current < maxReconnectAttempts;

        if (shouldReconnect) {
          reconnectAttemptsRef.current++;
          // console.log(`Reconnecting (${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${reconnectInterval}ms...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Maximum reconnection attempts reached. WebSocket server may be unavailable.');
        }
      };


    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create WebSocket connection';
      setError(errorMessage);
      setIsConnecting(false);
      isConnectingRef.current = false;

      // Clear cached endpoint on connection failure to retry fetching it next time
      wsEndpointRef.current = null;
    }
  }, [fetchWebSocketEndpoint, handleMessage, startHeartbeat, stopHeartbeat, maxReconnectAttempts, reconnectInterval]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setError(null);
    setSubscribedStations(new Set());
    reconnectAttemptsRef.current = 0;
    isConnectedRef.current = false;
    isConnectingRef.current = false;
  }, [stopHeartbeat]);

  // Subscribe to station updates
  const subscribeToStation = useCallback((stationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // console.log(`Subscribing to station ${stationId}`);
      wsRef.current.send(JSON.stringify({
        type: 'SUBSCRIBE_STATION',
        stationId
      }));
    } else {
      // Store subscription intent to resubscribe when connection is established
      setSubscribedStations(prev => {
        if (prev.has(stationId)) {
          return prev; // No change needed
        }
        return new Set(prev).add(stationId);
      });

      // If not connected, try to connect (use refs to avoid dependency issues)
      if (!isConnectedRef.current && !isConnectingRef.current) {
        connect();
      }
    }
  }, [connect]);

  // Unsubscribe from station updates
  const unsubscribeFromStation = useCallback((stationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // console.log(`Unsubscribing from station ${stationId}`);
      wsRef.current.send(JSON.stringify({
        type: 'UNSUBSCRIBE_STATION',
        stationId
      }));
    }

    // Remove from local subscriptions regardless of connection state
    setSubscribedStations(prev => {
      if (!prev.has(stationId)) {
        return prev; // No change needed
      }
      const newSet = new Set(prev);
      newSet.delete(stationId);
      return newSet;
    });
  }, []);

  // Set queue update callback
  const onQueueUpdate = useCallback((callback: (update: QueueUpdateMessage) => void) => {
    queueUpdateCallbackRef.current = callback;
  }, []);

  // Set user notification callback
  const onUserNotification = useCallback((callback: (notification: UserNotificationMessage) => void) => {
    userNotificationCallbackRef.current = callback;
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // Only depend on autoConnect to prevent infinite loops

  // Re-authenticate when session changes
  useEffect(() => {
    if (isConnected && session?.user?.id && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'AUTHENTICATE',
        userId: session.user.id
      }));
    }
  }, [isConnected, session?.user?.id]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    subscribeToStation,
    unsubscribeFromStation,
    onQueueUpdate,
    onUserNotification,
    subscribedStations
  };
}