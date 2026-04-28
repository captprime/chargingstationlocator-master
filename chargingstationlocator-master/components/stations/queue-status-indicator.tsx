'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, AlertCircle } from 'lucide-react';
import { useWebSocket } from '@/hooks/use-websocket';
import { formatDistanceToNow } from 'date-fns';

interface QueueStatusIndicatorProps {
  stationId: string;
  initialQueueLength: number;
  userPosition?: number;
  className?: string;
}

export function QueueStatusIndicator({ 
  stationId, 
  initialQueueLength, 
  userPosition, 
  className 
}: QueueStatusIndicatorProps) {
  const [queueLength, setQueueLength] = useState(initialQueueLength);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionRetries, setConnectionRetries] = useState(0);

  const { 
    subscribeToStation, 
    unsubscribeFromStation, 
    onQueueUpdate, 
    isConnected,
    error: wsError 
  } = useWebSocket({
    autoConnect: true
  });

  // Subscribe to station updates when component mounts
  useEffect(() => {
    if (isConnected && stationId && !isSubscribed) {
      subscribeToStation(stationId);
      setIsSubscribed(true);
      setError(null);
      setConnectionRetries(0);
    }
  }, [isConnected, stationId, isSubscribed, subscribeToStation]);

  // Handle connection errors and retries
  useEffect(() => {
    if (wsError && connectionRetries < 3 && !isConnected) {
      const retryDelay = Math.pow(2, connectionRetries) * 1000;
      const timeoutId = setTimeout(() => {
        setConnectionRetries(prev => prev + 1);
      }, retryDelay);
      
      return () => clearTimeout(timeoutId);
    }
  }, [wsError, connectionRetries, isConnected]);

  // Handle queue updates from WebSocket
  useEffect(() => {
    const handleQueueUpdate = (update: { stationId: string; newQueueLength: number; timestamp: string }) => {
      if (update.stationId === stationId) {
        setQueueLength(update.newQueueLength);
        setLastUpdated(new Date(update.timestamp));
        setError(null); // Clear any previous errors on successful update
      }
    };

    onQueueUpdate(handleQueueUpdate);
  }, [stationId, onQueueUpdate]);

  // Cleanup subscription when component unmounts
  useEffect(() => {
    return () => {
      if (stationId) {
        unsubscribeFromStation(stationId);
      }
    };
  }, [stationId, unsubscribeFromStation]);

  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      setError('Connection lost. Queue status may not be current.');
    }
  }, [wsError]);

  // Get queue status color
  const getQueueStatusColor = (length: number) => {
    if (length === 0) return 'bg-green-100 text-green-800';
    if (length <= 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Get queue status text
  const getQueueStatusText = (length: number) => {
    if (length === 0) return 'Available Now';
    if (length === 1) return '1 in queue';
    return `${length} in queue`;
  };

  // Format last updated time
  const getLastUpdatedText = () => {
    try {
      return `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`;
    } catch {
      return 'Just updated';
    }
  };

  if (error) {
    return (
      <div className={`flex flex-col ${className}`}>
        <Badge variant="secondary" className="bg-yellow-50 border-yellow-200 text-yellow-800 mb-1">
          <AlertCircle className="h-3 w-3 mr-1" />
          {getQueueStatusText(queueLength)}
        </Badge>
        <div className="text-xs text-yellow-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <Badge 
        variant="secondary" 
        className={`${getQueueStatusColor(queueLength)} mb-1`}
      >
        <Users className="h-3 w-3 mr-1" />
        {getQueueStatusText(queueLength)}
      </Badge>
      
      {userPosition && (
        <div className="text-xs font-medium mb-1">
          {userPosition === 1 ? (
            <span className="text-green-600">You&apos;re next!</span>
          ) : (
            <span>Your position: {userPosition}</span>
          )}
        </div>
      )}
      
      <div className="flex items-center text-xs text-muted-foreground">
        <Clock className="h-3 w-3 mr-1" />
        <span>{getLastUpdatedText()}</span>
      </div>
    </div>
  );
}