import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import webSocketService from '@/lib/websocket-service';

// Initialize WebSocket server
let isInitialized = false;

function initializeWebSocketServer() {
  if (isInitialized) return;
  
  // In Next.js Edge Runtime, we need to handle WebSocket connections differently
  // This is a workaround for Next.js API routes with WebSockets
  if (process.env.NODE_ENV === 'production') {
    // In production, we'll use the WebSocket service directly
    // The actual WebSocket server will be initialized by the WebSocket service
    webSocketService.initialize();
  } else {
    // For development, we'll use a local WebSocket server
    // This is needed because Next.js dev server doesn't support WebSockets directly
    const port = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
    console.log(`Initializing WebSocket server on port ${port} for development`);
    webSocketService.initialize();
  }
  
  isInitialized = true;
}

// HTTP GET handler for WebSocket endpoint
export async function GET(request: NextRequest) {
  try {
    // Initialize WebSocket server if not already done
    initializeWebSocketServer();
    
    // Get authentication session
    const session = await getServerSession(authOptions);
    
    // Return information about the WebSocket server
    return new Response(JSON.stringify({
      message: 'WebSocket server is running',
      authenticated: !!session?.user,
      userId: session?.user?.id || null,
      wsEndpoint: process.env.NODE_ENV === 'development' 
        ? `ws://localhost:${process.env.WS_PORT || 8080}` 
        : `${request.nextUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${request.nextUrl.host}/api/ws/queue-updates`,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error in WebSocket route handler:', error);
    return new Response(JSON.stringify({
      error: 'Failed to initialize WebSocket server',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// WebSocket service functions are available through the webSocketService import
// Use webSocketService.broadcastQueueUpdate() and webSocketService.broadcastUserNotification() directly