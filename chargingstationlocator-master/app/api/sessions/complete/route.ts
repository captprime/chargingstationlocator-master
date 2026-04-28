import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import ChargingSession from '@/models/ChargingSession';
import ChargingStation from '@/models/ChargingStation';
import { CompleteSessionResponse } from '@/types/queue';
import { 
  validateSessionCompletion, 
  updateQueuePositions, 
  createQueueAuditRecord,
  formatSessionForResponse 
} from '@/lib/session-utils';
import { processSessionCompletion } from '@/lib/revenue-utils';
import webSocketService from '@/lib/websocket-service';
import mongoose from 'mongoose';
import { sessionCompletionRateLimiter } from '@/lib/rate-limiter';
import securityAudit from '@/lib/security-audit';
import { validateSessionCompletionRequest } from '@/lib/input-validation';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  ErrorCode, 
  withRetry 
} from '@/lib/error-handling';

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

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await sessionCompletionRateLimiter(request);
    if (rateLimitResponse) {
      // Log rate limit exceeded
      await securityAudit.logSecurityEvent({
        ipAddress: getClientIp(request),
        action: 'rate_limit_exceeded',
        resource: 'session_completion',
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers)
        }
      });
      
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          'Too many session completion requests. Please wait before trying again.',
          undefined,
          Math.ceil((Date.now() - Date.now()) / 1000) // This should be calculated from rate limiter
        ),
        { status: 429 }
      );
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
        resource: 'session_completion',
        status: 'failure',
        details: {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers)
        }
      });
      
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          'Please log in to complete your charging session.'
        ),
        { status: 401 }
      );
    }

    const userId = session.user.id || session.user.email || '';
    
    // Check for suspicious activity
    const isSuspicious = await securityAudit.detectSuspiciousActivity(
      userId,
      'session_complete',
      'charging_session',
      5 // 5 minute window
    );
    
    if (isSuspicious) {
      // Log suspicious activity
      await securityAudit.logSuspiciousActivity(
        userId,
        getClientIp(request),
        'session_complete',
        'charging_session',
        undefined,
        {
          path: request.nextUrl.pathname,
          headers: Object.fromEntries(request.headers),
          reason: 'Suspicious activity pattern detected'
        }
      );
      
      // We still process the request but with additional logging
      console.warn(`Suspicious activity detected for user ${userId}`);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      // Log invalid JSON
      await securityAudit.logSecurityEvent({
        userId: userId,
        ipAddress: getClientIp(request),
        action: 'validation_failure',
        resource: 'session_completion',
        status: 'failure',
        details: {
          reason: 'Invalid JSON in request body',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.INVALID_REQUEST,
          'Invalid request format. Please check your input and try again.'
        ),
        { status: 400 }
      );
    }

    // Validate request structure and content
    const validation = validateSessionCompletionRequest(body);
    if (!validation.isValid) {
      // Log validation failure
      await securityAudit.logSecurityEvent({
        userId: userId,
        ipAddress: getClientIp(request),
        action: 'validation_failure',
        resource: 'session_completion',
        status: 'failure',
        details: {
          reason: validation.error,
          providedBody: body
        }
      });
      
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          validation.error
        ),
        { status: 400 }
      );
    }

    // TypeScript now knows validation.isValid is true, so sessionId and stationId are defined
    const { sessionId, stationId } = validation;

    // Validate the session completion request
    const sessionValidation = await validateSessionCompletion(sessionId, stationId, userId);
    
    if (!sessionValidation.isValid) {
      // Log validation failure with specific reason
      await securityAudit.logSecurityEvent({
        userId: userId,
        ipAddress: getClientIp(request),
        action: 'session_validation_failure',
        resource: 'charging_session',
        resourceId: sessionId,
        status: 'failure',
        details: {
          stationId,
          reason: sessionValidation.error,
          code: sessionValidation.code
        }
      });
      
      const errorCode = sessionValidation.code === 'UNAUTHORIZED' ? ErrorCode.FORBIDDEN :
                        sessionValidation.code === 'DUPLICATE_COMPLETION' ? ErrorCode.DUPLICATE_COMPLETION :
                        ErrorCode.SESSION_NOT_FOUND;
      
      return NextResponse.json(
        createErrorResponse(errorCode, sessionValidation.error),
        { status: sessionValidation.code === 'UNAUTHORIZED' ? 403 : 
                  sessionValidation.code === 'DUPLICATE_COMPLETION' ? 409 : 404 }
      );
    }

    const { session: chargingSession, station } = sessionValidation;

    // Ensure we have valid session and station data
    if (!chargingSession || !station) {
      return NextResponse.json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid session or station data. Please try again.'
        ),
        { status: 500 }
      );
    }

    // Type assertion since we've validated above
    const validSession = chargingSession;
    const validStation = station;

    // Start a database transaction for data consistency with retry logic
    const mongoSession = await mongoose.startSession();
    
    try {
      await withRetry(async () => {
        await mongoSession.withTransaction(async () => {
          // Update the charging session to completed
          validSession.status = 'completed';
          validSession.completedAt = new Date();
          await validSession.save({ session: mongoSession });

          // Process session completion: calculate energy, revenue, and update stats
          const { energyConsumed, sessionRevenue, sessionDurationMinutes } = 
            await processSessionCompletion(sessionId, mongoSession);

          console.log(`Session ${sessionId} completed: ${energyConsumed.toFixed(2)} kWh, ₹${sessionRevenue.toFixed(2)} revenue`);

          // Get previous queue count for audit trail
          const previousQueueLength = validStation.queueLength;

          // Reduce the station's queue count
          validStation.queueLength = Math.max(0, validStation.queueLength - 1);
          await validStation.save({ session: mongoSession });

          // Create audit trail record
          await createQueueAuditRecord(
            stationId,
            previousQueueLength,
            validStation.queueLength,
            userId,
            'session_complete',
            mongoSession
          );

          // Update queue positions for remaining active sessions
          await updateQueuePositions(stationId, validSession.queuePosition, mongoSession);
        });
      }, {
        maxAttempts: 3,
        retryableErrors: [ErrorCode.CONCURRENT_UPDATE, ErrorCode.DATABASE_ERROR]
      });

      // Get the updated session data
      const updatedSession = await ChargingSession.findById(sessionId);
      const updatedStation = await ChargingStation.findById(stationId);

      // Broadcast queue update to WebSocket clients
      webSocketService.broadcastQueueUpdate(
        stationId,
        updatedStation!.queueLength,
        userId
      );

      // Send notification to users in the queue about position changes
      const remainingSessions = await ChargingSession.find({
        stationId: stationId,
        status: 'active'
      }).sort({ queuePosition: 1 });

      // Notify the next person in line if queue is not empty
      if (remainingSessions.length > 0) {
        const nextSession = remainingSessions[0];
        if (nextSession.queuePosition === 1) {
          webSocketService.broadcastUserNotification(nextSession.userId, {
            sessionId: nextSession._id.toString(),
            notificationType: 'next_in_line',
            message: "You're next in line! The charging station will be available soon.",
            priority: 'high'
          });
        }
      }

      // If queue is now empty, broadcast station availability
      if (updatedStation!.queueLength === 0) {
        webSocketService.broadcastQueueUpdate(
          stationId,
          0,
          userId
        );
      }

      const responseData: CompleteSessionResponse = {
        success: true,
        updatedQueue: {
          stationId: stationId,
          newQueueLength: updatedStation!.queueLength
        },
        session: formatSessionForResponse(updatedSession!, updatedStation?.name)
      };

      return NextResponse.json(
        createSuccessResponse(responseData, 'Charging session completed successfully!')
      );

    } catch (transactionError: unknown) {
      console.error('Transaction error during session completion:', transactionError);
      throw transactionError;
    } finally {
      await mongoSession.endSession();
    }

  } catch (error) {
    console.error('Error completing charging session:', error);
    
    // Log the error for security monitoring
    try {
      const session = await getServerSession(authOptions);
      await securityAudit.logSecurityEvent({
        userId: session?.user?.id,
        ipAddress: getClientIp(request),
        action: 'session_completion',
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
        'Failed to complete charging session. Please try again.'
      ),
      { status: 500 }
    );
  }
}