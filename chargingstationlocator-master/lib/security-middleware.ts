import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import securityAudit from '@/lib/security-audit';
import { isIpBlocked } from '@/lib/rate-limiter';

// Helper function to get client IP from request
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown-ip';
}

/**
 * Security middleware for session-related endpoints
 */
export async function sessionSecurityMiddleware(
  request: NextRequest,
  action: string,
  resource: string = 'charging_session'
): Promise<{
  success: boolean;
  response?: NextResponse;
  session?: unknown;
  clientIp: string;
}> {
  const clientIp = getClientIp(request);
  
  try {
    // Check if IP is blocked
    const blockStatus = isIpBlocked(clientIp);
    if (blockStatus.blocked) {
      await securityAudit.logSecurityEvent({
        ipAddress: clientIp,
        action: 'blocked_ip_access_attempt',
        resource,
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          reason: blockStatus.reason,
          blockedUntil: blockStatus.blockedUntil
        }
      });
      
      return {
        success: false,
        clientIp,
        response: NextResponse.json(
          {
            success: false,
            error: 'Access denied. IP address is temporarily blocked.',
            code: 'IP_BLOCKED'
          },
          { status: 429 }
        )
      };
    }
    
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      // Log unauthorized access attempt
      await securityAudit.logSecurityEvent({
        ipAddress: clientIp,
        action: 'unauthorized_access',
        resource,
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          action,
          headers: Object.fromEntries(request.headers)
        }
      });
      
      return {
        success: false,
        clientIp,
        response: NextResponse.json(
          {
            success: false,
            error: 'Unauthorized. Please log in to access this resource.',
            code: 'UNAUTHORIZED'
          },
          { status: 401 }
        )
      };
    }
    
    // Check for suspicious activity
    const isSuspicious = await securityAudit.detectSuspiciousActivity(
      session.user.id,
      action,
      resource,
      5 // 5 minute window
    );
    
    if (isSuspicious) {
      // Log suspicious activity
      await securityAudit.logSuspiciousActivity(
        session.user.id,
        clientIp,
        action,
        resource,
        undefined,
        {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers),
          reason: 'Suspicious activity pattern detected'
        }
      );
      
      console.warn(`Suspicious activity detected for user ${session.user.id} performing ${action}`);
    }
    
    return {
      success: true,
      session,
      clientIp
    };
    
  } catch (error) {
    console.error('Security middleware error:', error);
    
    // Log the error
    await securityAudit.logSecurityEvent({
      ipAddress: clientIp,
      action: 'security_middleware_error',
      resource,
      status: 'failure',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: request.nextUrl.pathname
      }
    });
    
    return {
      success: false,
      clientIp,
      response: NextResponse.json(
        {
          success: false,
          error: 'Internal security error. Please try again later.',
          code: 'SECURITY_ERROR'
        },
        { status: 500 }
      )
    };
  }
}

/**
 * Log successful API access
 */
export async function logSuccessfulAccess(
  userId: string,
  clientIp: string,
  action: string,
  resource: string,
  details?: Record<string, unknown>
): Promise<void> {
  await securityAudit.logSecurityEvent({
    userId,
    ipAddress: clientIp,
    action,
    resource,
    status: 'success',
    details
  });
}

/**
 * Log API error for security monitoring
 */
export async function logApiError(
  request: NextRequest,
  action: string,
  resource: string,
  error: unknown,
  userId?: string
): Promise<void> {
  const clientIp = getClientIp(request);
  
  await securityAudit.logSecurityEvent({
    userId,
    ipAddress: clientIp,
    action,
    resource,
    status: 'failure',
    details: {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: request.nextUrl.pathname
    }
  });
}

/**
 * Validate session ownership with security logging
 */
export async function validateSessionOwnershipWithLogging(
  sessionId: string,
  userId: string,
  clientIp: string,
  action: string
): Promise<{ isValid: boolean; error?: string }> {
  const validation = await securityAudit.validateSessionOwnership(sessionId, userId, clientIp);
  
  if (!validation.isValid) {
    // Additional logging for ownership validation failures
    await securityAudit.logSecurityEvent({
      userId,
      ipAddress: clientIp,
      action: `${action}_ownership_failure`,
      resource: 'charging_session',
      resourceId: sessionId,
      status: 'failure',
      details: {
        reason: validation.reason,
        attemptedAction: action
      }
    });
  }
  
  return validation;
}

const securityMiddleware = {
  sessionSecurityMiddleware,
  logSuccessfulAccess,
  logApiError,
  validateSessionOwnershipWithLogging
};

export default securityMiddleware;