import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import ChargingSession from '@/models/ChargingSession';
import ChargingStation from '@/models/ChargingStation';
import { ActiveSessionsResponse } from '@/types/queue';
import { formatSessionForResponse } from '@/lib/session-utils';
import { rateLimiter } from '@/lib/rate-limiter';
import securityAudit from '@/lib/security-audit';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  ErrorCode 
} from '@/lib/error-handling';

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

// Rate limiter for active sessions endpoint
const activeSessionsRateLimiter = rateLimiter({
  limit: 30, // 30 requests per minute
  windowInSeconds: 60
});

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await activeSessionsRateLimiter(request);
    if (rateLimitResponse) {
      // Log rate limit exceeded
      await securityAudit.logSecurityEvent({
        ipAddress: getClientIp(request),
        action: 'rate_limit_exceeded',
        resource: 'active_sessions',
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers)
        }
      });
      
      return rateLimitResponse;
    }

    // Connect to MongoDB
    await connectDB();

    // Get the session to validate user authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      // Log unauthorized access attempt
      await securityAudit.logSecurityEvent({
        ipAddress: getClientIp(request),
        action: 'unauthorized_access',
        resource: 'active_sessions',
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers)
        }
      });
      
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          'Please log in to view your active sessions.'
        ),
        { status: 401 }
      );
    }

    const userId = session.user.id || session.user.email || '';
    
    // Check for suspicious activity
    const isSuspicious = await securityAudit.detectSuspiciousActivity(
      userId,
      'view_active_sessions',
      'charging_session',
      5 // 5 minute window
    );
    
    if (isSuspicious) {
      // Log suspicious activity
      await securityAudit.logSuspiciousActivity(
        userId,
        getClientIp(request),
        'view_active_sessions',
        'charging_session',
        undefined,
        {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers),
          reason: 'Suspicious activity pattern detected'
        }
      );
      
      console.warn(`Suspicious activity detected for user ${userId} accessing active sessions`);
    }

    // Find all active charging sessions for the user
    const activeSessions = await ChargingSession.find({
      userId: userId,
      status: 'active'
    }).sort({ joinedAt: -1 });

    // Get station details for each session
    const sessionsWithStationInfo = await Promise.all(
      activeSessions.map(async (chargingSession) => {
        const station = await ChargingStation.findById(chargingSession.stationId);
        return formatSessionForResponse(chargingSession, station?.name);
      })
    );

    // Log successful access
    await securityAudit.logSecurityEvent({
      userId: userId,
      ipAddress: getClientIp(request),
      action: 'view_active_sessions',
      resource: 'charging_session',
      status: 'success',
      details: {
        sessionCount: sessionsWithStationInfo.length
      }
    });

    const responseData: ActiveSessionsResponse = {
      sessions: sessionsWithStationInfo,
      totalActive: sessionsWithStationInfo.length
    };

    return NextResponse.json(
      createSuccessResponse(responseData)
    );

  } catch (error) {
    console.error('Error fetching active sessions:', error);
    
    // Log the error for security monitoring
    try {
      const session = await getServerSession(authOptions);
      await securityAudit.logSecurityEvent({
        userId: session?.user?.id,
        ipAddress: getClientIp(request),
        action: 'view_active_sessions',
        resource: 'charging_session',
        status: 'failure',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    } catch (auditError) {
      console.error('Failed to log security event:', auditError);
    }
    
    return NextResponse.json(
      createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to load active sessions. Please try again.'
      ),
      { status: 500 }
    );
  }
}