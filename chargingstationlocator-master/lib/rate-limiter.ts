import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

// In-memory store for blocked IPs
// In production, this should be replaced with Redis or similar
const blockedIps: Record<string, { blockedUntil: number; reason: string }> = {};

// Clean up expired blocked IPs periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(blockedIps).forEach(ip => {
    if (blockedIps[ip].blockedUntil < now) {
      delete blockedIps[ip];
    }
  });
}, 300000); // Clean up every 5 minutes

// Helper function to get client IP from request
function getClientIp(request: NextRequest): string {
  // Try to get IP from headers first (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try to get from other common headers
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // If no headers available, return a placeholder
  return 'unknown-ip';
}

// In-memory store for rate limiting
// In a production environment, this should be replaced with Redis or similar
const rateLimitStore: Record<string, { count: number, resetTime: number }> = {};

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
}, 60000); // Clean up every minute

interface RateLimitOptions {
  // Maximum number of requests allowed in the window
  limit: number;
  // Time window in seconds
  windowInSeconds: number;
  // Optional identifier function to customize how to identify the requester
  identifierFn?: (req: NextRequest, userId?: string) => string;
}

/**
 * Block an IP address for a specified duration
 */
export function blockIp(
  ipAddress: string, 
  durationMinutes: number = 15, 
  reason: string = 'Rate limit exceeded'
): void {
  const blockedUntil = Date.now() + (durationMinutes * 60 * 1000);
  blockedIps[ipAddress] = { blockedUntil, reason };
}

/**
 * Check if an IP address is currently blocked
 */
export function isIpBlocked(ipAddress: string): { blocked: boolean; reason?: string; blockedUntil?: Date } {
  const blockInfo = blockedIps[ipAddress];
  
  if (!blockInfo) {
    return { blocked: false };
  }
  
  if (blockInfo.blockedUntil < Date.now()) {
    delete blockedIps[ipAddress];
    return { blocked: false };
  }
  
  return {
    blocked: true,
    reason: blockInfo.reason,
    blockedUntil: new Date(blockInfo.blockedUntil)
  };
}

/**
 * Rate limiting middleware for API routes
 * 
 * @param options Rate limiting options
 * @returns A middleware function that can be used in API routes
 */
export function rateLimiter(options: RateLimitOptions) {
  const { limit, windowInSeconds } = options;
  
  return async function rateLimit(req: NextRequest) {
    try {
      const clientIp = getClientIp(req);
      
      // Check if IP is blocked
      const blockStatus = isIpBlocked(clientIp);
      if (blockStatus.blocked) {
        return NextResponse.json(
          {
            success: false,
            error: 'IP address is temporarily blocked due to suspicious activity.',
            code: 'IP_BLOCKED',
            reason: blockStatus.reason,
            blockedUntil: blockStatus.blockedUntil
          },
          { status: 429 }
        );
      }
      
      // Get user session for authenticated rate limiting
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;
      
      // Determine identifier (user ID or IP address)
      let identifier: string;
      
      if (options.identifierFn) {
        identifier = options.identifierFn(req, userId);
      } else {
        // Default: use user ID if authenticated, otherwise IP
        identifier = userId || clientIp || 'unknown';
      }
      
      // Add route to make rate limits specific to endpoints
      const route = req.nextUrl.pathname;
      const key = `${identifier}:${route}`;
      
      const now = Date.now();
      const windowMs = windowInSeconds * 1000;
      
      // Initialize or get current rate limit data
      if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
        rateLimitStore[key] = {
          count: 1,
          resetTime: now + windowMs
        };
        return null; // Allow the request
      }
      
      // Increment request count
      rateLimitStore[key].count++;
      
      // Check if limit exceeded
      if (rateLimitStore[key].count > limit) {
        // If this is a severe rate limit violation, consider blocking the IP
        if (rateLimitStore[key].count > limit * 2) {
          blockIp(clientIp, 15, `Severe rate limit violation on ${route}`);
        }
        
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((rateLimitStore[key].resetTime - now) / 1000)
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((rateLimitStore[key].resetTime - now) / 1000).toString(),
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(rateLimitStore[key].resetTime / 1000).toString()
            }
          }
        );
      }
      
      // Add rate limit headers
      const remainingRequests = Math.max(0, limit - rateLimitStore[key].count);
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', limit.toString());
      headers.set('X-RateLimit-Remaining', remainingRequests.toString());
      headers.set('X-RateLimit-Reset', Math.ceil(rateLimitStore[key].resetTime / 1000).toString());
      
      return null; // Allow the request with headers
    } catch (error) {
      console.error('Rate limiting error:', error);
      return null; // Allow the request on error
    }
  };
}

/**
 * Rate limiter specifically for session completion requests
 * More strict limits to prevent queue manipulation
 */
export const sessionCompletionRateLimiter = rateLimiter({
  limit: 3, // 3 requests per minute - more strict to prevent abuse
  windowInSeconds: 60,
  identifierFn: (req, userId) => {
    // Use a combination of user ID and IP for better security
    // This prevents abuse even if the account is compromised
    if (userId) {
      const clientIp = getClientIp(req);
      return `user:${userId}:ip:${clientIp}`;
    }
    
    // For non-authenticated requests, use IP address
    return `ip:${getClientIp(req)}`;
  }
});