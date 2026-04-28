// Queue system related types

export interface ChargingSession {
  id: string;
  userId: string;
  stationId: string;
  stationName?: string;
  joinedAt: Date;
  arrivedAt?: Date;
  chargingStartedAt?: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'cancelled';
  trackingStatus: 'driving' | 'arrived' | 'charging' | 'completed';
  queuePosition: number;
  estimatedWaitTime?: number;
  energyConsumed?: number; // in kWh
  sessionRevenue?: number; // calculated revenue for this session
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueUpdate {
  id: string;
  stationId: string;
  previousCount: number;
  newCount: number;
  updatedBy: string;
  timestamp: Date;
  reason: 'session_complete' | 'session_join' | 'admin_adjustment';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserNotification {
  id: string;
  userId: string;
  sessionId: string | null;
  type: 'position_update' | 'next_in_line' | 'station_available' | 'low_battery';
  message: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  metadata?: {
    batteryPercentage?: number;
    nearbyStations?: Array<{ id: string; name: string; distance: number; lat: number; lng: number }>;
    userLat?: number;
    userLng?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// API request/response types
export interface CompleteSessionRequest {
  sessionId: string;
  stationId: string;
}

export interface CompleteSessionResponse {
  success: boolean;
  updatedQueue: {
    stationId: string;
    newQueueLength: number;
  };
  session: ChargingSession;
}

export interface ActiveSessionsResponse {
  sessions: ChargingSession[];
  totalActive: number;
}

export interface SessionHistoryResponse {
  sessions: ChargingSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// WebSocket message types
export interface QueueUpdateMessage {
  type: 'QUEUE_UPDATE';
  stationId: string;
  newQueueLength: number;
  timestamp: Date;
}

export interface UserNotificationMessage {
  type: 'USER_NOTIFICATION';
  userId: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export type WebSocketMessage = QueueUpdateMessage | UserNotificationMessage;