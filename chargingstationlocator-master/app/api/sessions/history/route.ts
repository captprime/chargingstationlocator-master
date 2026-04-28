import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import ChargingSession from '@/models/ChargingSession';
import ChargingStation from '@/models/ChargingStation';
import connectDB from '@/lib/mongodb';
import { SessionHistoryResponse } from '@/types/queue';
import { rateLimiter } from '@/lib/rate-limiter';
import securityAudit from '@/lib/security-audit';
import { validatePagination } from '@/lib/session-utils';
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

// Rate limiter for session history endpoint
const sessionHistoryRateLimiter = rateLimiter({
  limit: 20, // 20 requests per minute
  windowInSeconds: 60
});

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await sessionHistoryRateLimiter(request);
    if (rateLimitResponse) {
      // Log rate limit exceeded
      await securityAudit.logSecurityEvent({
        ipAddress: getClientIp(request),
        action: 'rate_limit_exceeded',
        resource: 'session_history',
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers)
        }
      });
      
      return rateLimitResponse;
    }

    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id && !session?.user?.email) {
      // Log unauthorized access attempt
      await securityAudit.logSecurityEvent({
        ipAddress: getClientIp(request),
        action: 'unauthorized_access',
        resource: 'session_history',
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers)
        }
      });
      
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          'Please log in to view your session history.'
        ),
        { status: 401 }
      );
    }

    const userId = session.user.id || session.user.email || '';

    // Check for suspicious activity
    const isSuspicious = await securityAudit.detectSuspiciousActivity(
      userId,
      'view_session_history',
      'charging_session',
      5 // 5 minute window
    );
    
    if (isSuspicious) {
      // Log suspicious activity
      await securityAudit.logSuspiciousActivity(
        userId,
        getClientIp(request),
        'view_session_history',
        'charging_session',
        undefined,
        {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers),
          reason: 'Suspicious activity pattern detected'
        }
      );
      
      console.warn(`Suspicious activity detected for user ${userId} accessing session history`);
    }

    // Connect to database
    await connectDB();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '5');

    // Validate pagination parameters using utility function
    const paginationValidation = validatePagination(page, limit);
    if (!paginationValidation.isValid) {
      // Log validation failure
      await securityAudit.logSecurityEvent({
        userId: userId,
        ipAddress: getClientIp(request),
        action: 'validation_failure',
        resource: 'session_history',
        status: 'failure',
        details: {
          reason: paginationValidation.error,
          providedPage: page,
          providedLimit: limit
        }
      });
      
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          paginationValidation.error
        ),
        { status: 400 }
      );
    }

    const skip = (paginationValidation.normalizedPage - 1) * paginationValidation.normalizedLimit;

    // Find completed sessions for the user (using user.id for consistency)
    const [sessions, totalCount] = await Promise.all([
      ChargingSession.find({
        userId: userId,
        status: { $in: ['completed', 'cancelled'] }
      })
      .sort({ completedAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(paginationValidation.normalizedLimit)
      .lean(),
      
      ChargingSession.countDocuments({
        userId: userId,
        status: { $in: ['completed', 'cancelled'] }
      })
    ]);

    // Get station information for sessions
    const stationIds = [...new Set(sessions.map(s => s.stationId))];
    const stations = await ChargingStation.find({
      _id: { $in: stationIds }
    }).lean();

    const stationMap = new Map(stations.map(station => [station._id as string, station]));

    // Format sessions with station information
    const formattedSessions = sessions.map(session => ({
      id: session._id as string,
      userId: session.userId,
      stationId: session.stationId,
      stationName: stationMap.get(session.stationId)?.name,
      joinedAt: session.joinedAt,
      arrivedAt: session.arrivedAt,
      chargingStartedAt: session.chargingStartedAt,
      completedAt: session.completedAt,
      status: session.status,
      trackingStatus: session.trackingStatus,
      queuePosition: session.queuePosition,
      estimatedWaitTime: session.estimatedWaitTime,
      energyConsumed: session.energyConsumed ?? 0,
      sessionRevenue: session.sessionRevenue ?? 0,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));

    // Log successful access
    await securityAudit.logSecurityEvent({
      userId: userId,
      ipAddress: getClientIp(request),
      action: 'view_session_history',
      resource: 'charging_session',
      status: 'success',
      details: {
        page: paginationValidation.normalizedPage,
        limit: paginationValidation.normalizedLimit,
        totalCount,
        sessionCount: formattedSessions.length
      }
    });

    const responseData: SessionHistoryResponse = {
      sessions: formattedSessions,
      pagination: {
        page: paginationValidation.normalizedPage,
        limit: paginationValidation.normalizedLimit,
        total: totalCount,
      },
    };

    return NextResponse.json(
      createSuccessResponse(responseData)
    );
  } catch (error) {
    console.error('Error fetching session history:', error);
    
    // Log the error for security monitoring
    try {
      const session = await getServerSession(authOptions);
      await securityAudit.logSecurityEvent({
        userId: session?.user?.id,
        ipAddress: getClientIp(request),
        action: 'view_session_history',
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
        'Failed to load session history. Please try again.'
      ),
      { status: 500 }
    );
  }
}