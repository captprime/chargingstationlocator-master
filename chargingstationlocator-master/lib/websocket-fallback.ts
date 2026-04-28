// WebSocket fallback configuration to handle bufferutil issues
import { WebSocketServer, WebSocket } from 'ws';

// Disable problematic native modules
process.env.WS_NO_BUFFER_UTIL = '1';
process.env.WS_NO_UTF_8_VALIDATE = '1';

// Override the WebSocket constructor to use safe defaults
const originalWebSocketServer = WebSocketServer;

export class SafeWebSocketServer extends originalWebSocketServer {
  constructor(options: Record<string, unknown>) {
    // Force safe options
    const safeOptions = {
      ...options,
      perMessageDeflate: false,
      skipUTF8Validation: true,
      compression: false,
      utf8Validation: false,
      maxPayload: 16 * 1024, // 16KB limit
    };

    super(safeOptions);
  }
}

export { WebSocket };
export default SafeWebSocketServer;