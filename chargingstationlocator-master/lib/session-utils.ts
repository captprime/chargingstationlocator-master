import ChargingSession, { IChargingSession } from '@/models/ChargingSession';
import ChargingStation, { IChargingStation } from '@/models/ChargingStation';
import QueueUpdate from '@/models/QueueUpdate';
import { ChargingSession as ChargingSessionType } from '@/types/queue';
import { ClientSession } from 'mongoose';

/**
 * Validates if a user can complete a specific charging session
 */
export async function validateSessionCompletion(
  sessionId: string,
  stationId: string,
  userId: string
): Promise<{
  isValid: boolean;
  error?: string;
  code?: string;
  session?: IChargingSession;
  station?: IChargingStation;
}> {
  try {
    // Find the charging session
    const session = await ChargingSession.findById(sessionId);

    if (!session) {
      return {
        isValid: false,
        error: 'Session not found.',
        code: 'INVALID_SESSION'
      };
    }

    // Verify session belongs to the user
    if (session.userId !== userId) {
      return {
        isValid: false,
        error: 'Unauthorized. You can only complete your own sessions.',
        code: 'UNAUTHORIZED'
      };
    }

    // Verify session is for the correct station
    if (session.stationId !== stationId) {
      return {
        isValid: false,
        error: 'Session does not belong to the specified station.',
        code: 'INVALID_SESSION'
      };
    }

    // Check if session is already completed
    if (session.status === 'completed') {
      return {
        isValid: false,
        error: 'Session is already completed.',
        code: 'DUPLICATE_COMPLETION'
      };
    }

    // Verify session is active
    if (session.status !== 'active') {
      return {
        isValid: false,
        error: 'Only active sessions can be completed.',
        code: 'INVALID_SESSION'
      };
    }

    // Get the charging station
    const station = await ChargingStation.findById(stationId);

    if (!station) {
      return {
        isValid: false,
        error: 'Charging station not found.',
        code: 'STATION_NOT_FOUND'
      };
    }

    // Validate queue state
    if (station.queueLength <= 0) {
      return {
        isValid: false,
        error: 'Invalid queue state. Queue is already empty.',
        code: 'INVALID_QUEUE_STATE'
      };
    }

    return {
      isValid: true,
      session,
      station
    };

  } catch (error) {
    console.error('Error validating session completion:', error);
    return {
      isValid: false,
      error: 'Internal error during validation.',
      code: 'VALIDATION_ERROR'
    };
  }
}

/**
 * Calculates estimated wait time based on queue position and average session duration
 * 
 * @param queuePosition - The position in the queue
 * @param stationId - Optional station ID to use station-specific average duration
 * @returns Estimated wait time in minutes
 */
export async function calculateEstimatedWaitTime(
  queuePosition: number,
  stationId?: string
): Promise<number> {
  // If user is first in queue, they can start immediately
  if (queuePosition <= 1) {
    return 0;
  }

  // Default average charging session duration in minutes
  let averageSessionDuration = 45;

  // If stationId is provided, try to get station-specific average duration
  if (stationId) {
    try {
      // Get completed sessions for this station in the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const completedSessions = await ChargingSession.find({
        stationId,
        status: 'completed',
        completedAt: { $gte: oneWeekAgo }
      });

      if (completedSessions.length > 0) {
        // Calculate average duration from completed sessions
        const totalDuration = completedSessions.reduce((sum, session) => {
          if (session.completedAt && session.joinedAt) {
            const durationMs = session.completedAt.getTime() - session.joinedAt.getTime();
            const durationMinutes = durationMs / (1000 * 60);
            return sum + durationMinutes;
          }
          return sum;
        }, 0);

        if (totalDuration > 0) {
          averageSessionDuration = Math.round(totalDuration / completedSessions.length);
          
          // Sanity check - ensure the average is reasonable (between 10 and 120 minutes)
          averageSessionDuration = Math.max(10, Math.min(120, averageSessionDuration));
        }
      }
    } catch (error) {
      console.error('Error calculating station-specific average duration:', error);
      // Fall back to default average duration
    }
  }

  // Calculate wait time based on position and average duration
  return (queuePosition - 1) * averageSessionDuration;
}

/**
 * Calculates estimated wait time synchronously (for cases where async isn't possible)
 * This is a simplified version that doesn't use station-specific data
 * 
 * @param queuePosition - The position in the queue
 * @returns Estimated wait time in minutes
 */
export function calculateEstimatedWaitTimeSync(queuePosition: number): number {
  // Average charging session duration in minutes (configurable)
  const averageSessionDuration = 45;

  // If user is first in queue, they can start immediately
  if (queuePosition <= 1) {
    return 0;
  }

  // Calculate wait time based on position and average duration
  return (queuePosition - 1) * averageSessionDuration;
}

/**
 * Updates queue positions for all sessions after a completion
 */
export async function updateQueuePositions(
  stationId: string,
  completedPosition: number,
  mongoSession?: ClientSession
): Promise<void> {
  const options = mongoSession ? { session: mongoSession } : undefined;

  await ChargingSession.updateMany(
    {
      stationId: stationId,
      status: 'active',
      queuePosition: { $gt: completedPosition }
    },
    {
      $inc: { queuePosition: -1 }
    },
    options
  );
}

/**
 * Creates an audit trail record for queue updates
 */
export async function createQueueAuditRecord(
  stationId: string,
  previousCount: number,
  newCount: number,
  updatedBy: string,
  reason: 'session_complete' | 'session_join' | 'session_cancel' | 'admin_adjustment',
  mongoSession?: ClientSession
): Promise<void> {
  const auditData = {
    stationId,
    previousCount,
    newCount,
    updatedBy,
    timestamp: new Date(),
    reason
  };

  if (mongoSession) {
    await QueueUpdate.create([auditData], { session: mongoSession });
  } else {
    await QueueUpdate.create(auditData);
  }
}

/**
 * Formats a charging session for API response
 */
export function formatSessionForResponse(
  session: {
    _id: { toString(): string };
    userId: string;
    stationId: string;
    joinedAt: Date;
    arrivedAt?: Date;
    chargingStartedAt?: Date;
    completedAt?: Date;
    status: 'active' | 'completed' | 'cancelled';
    trackingStatus?: 'driving' | 'arrived' | 'charging' | 'completed';
    queuePosition: number;
    estimatedWaitTime?: number;
    energyConsumed?: number;
    sessionRevenue?: number;
    createdAt: Date;
    updatedAt: Date;
  },
  stationName?: string
): ChargingSessionType {
  return {
    id: session._id.toString(),
    userId: session.userId,
    stationId: session.stationId,
    stationName: stationName || 'Unknown Station',
    joinedAt: session.joinedAt,
    arrivedAt: session.arrivedAt,
    chargingStartedAt: session.chargingStartedAt,
    completedAt: session.completedAt,
    status: session.status,
    trackingStatus: session.trackingStatus || 'driving', // Default to 'driving' for existing sessions
    queuePosition: session.queuePosition,
    estimatedWaitTime: session.estimatedWaitTime,
    energyConsumed: session.energyConsumed,
    sessionRevenue: session.sessionRevenue,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

/**
 * Validates pagination parameters
 */
export function validatePagination(page: number, limit: number): {
  isValid: boolean;
  error?: string;
  normalizedPage: number;
  normalizedLimit: number;
} {
  const normalizedPage = Math.max(1, Math.floor(page));
  const normalizedLimit = Math.min(50, Math.max(1, Math.floor(limit))); // Max 50 items per page

  if (page < 1 || limit < 1) {
    return {
      isValid: false,
      error: 'Page and limit must be positive integers.',
      normalizedPage,
      normalizedLimit
    };
  }

  return {
    isValid: true,
    normalizedPage,
    normalizedLimit
  };
}