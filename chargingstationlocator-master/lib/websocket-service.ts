import { Server } from 'http';
import { SafeWebSocketServer as WebSocketServer, WebSocket } from './websocket-fallback';

// Handle bufferutil errors gracefully
process.on('uncaughtException', (error) => {
  if (error.message && error.message.includes('bufferUtil.unmask')) {
    console.warn('Caught bufferUtil error, WebSocket will continue without native optimizations:', error.message);
    return; // Don't crash the process
  }
  // Re-throw other uncaught exceptions
  throw error;
});

// WebSocket message types
export interface QueueUpdateMessage {
  type: 'QUEUE_UPDATE';
  stationId: string;
  newQueueLength: number;
  timestamp: string;
  updatedBy?: string;
}

export interface UserNotificationMessage {
  type: 'USER_NOTIFICATION';
  userId: string;
  sessionId?: string;
  notificationType: 'position_update' | 'next_in_line' | 'station_available';
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface ConnectionMessage {
  type: 'CONNECTION_ESTABLISHED' | 'HEARTBEAT_ACK' | 'SUBSCRIPTION_CONFIRMED' | 'UNSUBSCRIPTION_CONFIRMED' | 'AUTHENTICATION_SUCCESS' | 'ERROR';
  stationId?: string;
  userId?: string;
  message?: string;
  timestamp: string;
}

export interface ClientMessage {
  type: 'HEARTBEAT' | 'SUBSCRIBE_STATION' | 'UNSUBSCRIBE_STATION' | 'AUTHENTICATE';
  stationId?: string;
  userId?: string;
  token?: string;
}

// Client connection interface
interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  stationIds: Set<string>;
  lastHeartbeat: number;
  authenticated: boolean;
  connectionTime: number;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, ClientConnection>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionStatsInterval: NodeJS.Timeout | null = null;

  // Initialize WebSocket server
  public initialize(server?: Server): WebSocketServer {
    if (this.wss) {
      return this.wss;
    }

    try {
      // Create WebSocket server with compatibility settings
      const wsOptions = {
        perMessageDeflate: false,
        skipUTF8Validation: true,
        maxPayload: 16 * 1024, // 16KB max payload
      };

      if (server) {
        // Use existing HTTP server
        this.wss = new WebSocketServer({ 
          server,
          path: '/api/ws/queue-updates',
          ...wsOptions
        });
        console.log(`WebSocket server initialized on existing HTTP server`);
      } else {
        // Create standalone WebSocket server
        const port = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
        this.wss = new WebSocketServer({ 
          port,
          ...wsOptions
        });
        console.log(`WebSocket server initialized on port ${port}`);
      }

      this.setupEventHandlers();
      this.startHeartbeat();
      this.startConnectionStats();

      return this.wss;
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw new Error(`WebSocket server initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Set up WebSocket event handlers
  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection established');

      // Initialize client connection
      const clientConnection: ClientConnection = {
        ws,
        stationIds: new Set(),
        lastHeartbeat: Date.now(),
        authenticated: false,
        connectionTime: Date.now()
      };
      
      this.clients.set(ws, clientConnection);

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      // Handle connection close
      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Handle pong responses
      ws.on('pong', () => {
        const client = this.clients.get(ws);
        if (client) {
          client.lastHeartbeat = Date.now();
        }
      });

      // Send initial connection confirmation
      this.sendMessage(ws, {
        type: 'CONNECTION_ESTABLISHED',
        timestamp: new Date().toISOString()
      });
    });

    // Handle server errors
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  // Handle incoming WebSocket messages
  private async handleMessage(ws: WebSocket, data: Buffer): Promise<void> {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      const client = this.clients.get(ws);
      
      if (!client) return;

      switch (message.type) {
        case 'HEARTBEAT':
          client.lastHeartbeat = Date.now();
          this.sendMessage(ws, {
            type: 'HEARTBEAT_ACK',
            timestamp: new Date().toISOString()
          });
          break;

        case 'SUBSCRIBE_STATION':
          if (message.stationId) {
            client.stationIds.add(message.stationId);
            this.sendMessage(ws, {
              type: 'SUBSCRIPTION_CONFIRMED',
              stationId: message.stationId,
              timestamp: new Date().toISOString()
            });
            console.log(`Client subscribed to station ${message.stationId}`);
          }
          break;

        case 'UNSUBSCRIBE_STATION':
          if (message.stationId) {
            client.stationIds.delete(message.stationId);
            this.sendMessage(ws, {
              type: 'UNSUBSCRIPTION_CONFIRMED',
              stationId: message.stationId,
              timestamp: new Date().toISOString()
            });
            console.log(`Client unsubscribed from station ${message.stationId}`);
          }
          break;

        case 'AUTHENTICATE':
          if (message.userId) {
            client.userId = message.userId;
            client.authenticated = true;
            this.sendMessage(ws, {
              type: 'AUTHENTICATION_SUCCESS',
              userId: message.userId,
              timestamp: new Date().toISOString()
            });
            console.log(`Client authenticated as user ${message.userId}`);
          }
          break;

        default:
          console.warn(`Unknown message type received: ${message.type}`);
          this.sendMessage(ws, {
            type: 'ERROR',
            message: `Unknown message type: ${message.type}`,
            timestamp: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      this.sendMessage(ws, {
        type: 'ERROR',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Send message to specific WebSocket connection
  private sendMessage(ws: WebSocket, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  // Start heartbeat mechanism
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, ws) => {
        // Check if client hasn't responded in last 30 seconds
        if (now - client.lastHeartbeat > 30000) {
          console.log('Client connection timed out, terminating');
          ws.terminate();
          this.clients.delete(ws);
          return;
        }

        // Send ping to client
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 15000); // Check every 15 seconds
  }

  // Start connection statistics logging
  private startConnectionStats(): void {
    if (this.connectionStatsInterval) {
      clearInterval(this.connectionStatsInterval);
    }
    
    this.connectionStatsInterval = setInterval(() => {
      const stats = this.getStats();
      console.log(`WebSocket connections: ${stats.totalConnections} total, ${stats.authenticatedConnections} authenticated`);
      
      // Log station subscriptions if any exist
      const stationIds = Object.keys(stats.subscriptions);
      if (stationIds.length > 0) {
        console.log('Station subscriptions:', stats.subscriptions);
      }
    }, 60000); // Log every minute
  }

  // Broadcast queue update to relevant clients
  public broadcastQueueUpdate(stationId: string, newQueueLength: number, updatedBy?: string): void {
    if (!this.wss) {
      console.warn('WebSocket server not initialized, cannot broadcast queue update');
      return;
    }

    const updateMessage: QueueUpdateMessage = {
      type: 'QUEUE_UPDATE',
      stationId,
      newQueueLength,
      timestamp: new Date().toISOString(),
      updatedBy
    };

    let sentCount = 0;
    this.clients.forEach((client, ws) => {
      // Only send to clients subscribed to this station
      if (client.stationIds.has(stationId) && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, updateMessage);
        sentCount++;
      }
    });

    console.log(`Queue update broadcasted to ${sentCount} clients for station ${stationId}: new length ${newQueueLength}`);
  }

  // Broadcast user notification to specific user
  public broadcastUserNotification(
    userId: string, 
    notification: Omit<UserNotificationMessage, 'type' | 'userId' | 'timestamp'>
  ): void {
    if (!this.wss) {
      console.warn('WebSocket server not initialized, cannot broadcast user notification');
      return;
    }

    const notificationMessage: UserNotificationMessage = {
      type: 'USER_NOTIFICATION',
      userId,
      ...notification,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    this.clients.forEach((client, ws) => {
      // Only send to the specific authenticated user
      if (client.userId === userId && client.authenticated && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, notificationMessage);
        sentCount++;
      }
    });

    console.log(`User notification sent to ${sentCount} connections for user ${userId}: ${notification.notificationType}`);
  }

  // Get connection statistics
  public getStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    subscriptions: { [stationId: string]: number };
  } {
    const stats = {
      totalConnections: this.clients.size,
      authenticatedConnections: 0,
      subscriptions: {} as { [stationId: string]: number }
    };

    this.clients.forEach((client) => {
      if (client.authenticated) {
        stats.authenticatedConnections++;
      }

      client.stationIds.forEach((stationId) => {
        stats.subscriptions[stationId] = (stats.subscriptions[stationId] || 0) + 1;
      });
    });

    return stats;
  }

  // Gracefully shutdown WebSocket server
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.connectionStatsInterval) {
      clearInterval(this.connectionStatsInterval);
      this.connectionStatsInterval = null;
    }

    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket server closed');
      });
      this.wss = null;
    }

    this.clients.clear();
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
export default webSocketService;