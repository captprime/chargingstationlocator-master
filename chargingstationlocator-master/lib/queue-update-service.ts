import mongoose from 'mongoose';
import ChargingStation, { IChargingStation } from '../models/ChargingStation';
import ChargingSession, { IChargingSession } from '../models/ChargingSession';
import QueueUpdate, { IQueueUpdate } from '../models/QueueUpdate';
import { NotificationService } from './notification-service';
import connectDB from './mongodb';

/**
 * Interface for MongoDB errors with properties we need to check
 */
interface MongoDBError {
  code?: number;
  message?: string;
  errorLabels?: string[];
}

/**
 * Service for handling queue updates with concurrency control
 */
export class QueueUpdateService {
  /**
   * Maximum number of retry attempts for handling write conflicts
   */
  private static MAX_RETRY_ATTEMPTS = 3;
  
  /**
   * Base delay in milliseconds for exponential backoff
   */
  private static BASE_RETRY_DELAY_MS = 100;
  
  /**
   * Reduces the queue count for a station when a session is completed
   * Uses transactions and optimistic locking to prevent race conditions
   * Implements retry logic with exponential backoff for handling write conflicts
   * 
   * @param sessionId - The ID of the session being completed
   * @param userId - The ID of the user completing the session
   * @param retryAttempt - Current retry attempt (used internally for recursion)
   * @returns The updated queue information and session
   * @throws Error if the operation fails after all retry attempts
   */
  public static async completeSessionAndReduceQueue(
    sessionId: string,
    userId: string,
    retryAttempt = 0
  ): Promise<{
    session: IChargingSession;
    station: IChargingStation;
    queueUpdate: IQueueUpdate;
  }> {
    await connectDB();
    
    // Start a MongoDB session for transaction
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();
    
    try {
      // 1. Find and validate the charging session
      const session = await ChargingSession.findOne({
        _id: sessionId,
        userId: userId,
        status: 'active'
      }).session(mongoSession);
      
      if (!session) {
        throw new Error('Invalid session or not owned by the user');
      }
      
      // 2. Find the charging station with optimistic locking
      // We use the version key (__v) for optimistic concurrency control
      const station = await ChargingStation.findById(session.stationId).session(mongoSession);
      
      if (!station) {
        throw new Error('Charging station not found');
      }
      
      // 3. Validate queue count
      if (station.queueLength <= 0) {
        throw new Error('Queue count is already at zero');
      }
      
      // 4. Calculate new queue count
      const previousCount = station.queueLength;
      const newCount = Math.max(0, previousCount - 1); // Ensure it doesn't go below zero
      
      // 5. Update the station queue count
      station.queueLength = newCount;
      await station.save({ session: mongoSession });
      
      // 6. Update the session status
      session.status = 'completed';
      session.completedAt = new Date();
      await session.save({ session: mongoSession });
      
      // 7. Create queue update audit record
      const queueUpdate = await QueueUpdate.create(
        [{
          stationId: station._id,
          previousCount,
          newCount,
          updatedBy: userId,
          timestamp: new Date(),
          reason: 'session_complete'
        }],
        { session: mongoSession }
      );
      
      // 8. Commit the transaction
      await mongoSession.commitTransaction();
      
      // 9. Return the updated data
      return {
        session: session.toObject(),
        station: station.toObject(),
        queueUpdate: queueUpdate[0].toObject()
      };
    } catch (error: unknown) {
      // If any operation fails, abort the transaction
      await mongoSession.abortTransaction();
      
      // Check if this is a write conflict error that we can retry
      const mongoError = error as MongoDBError;
      
      const isWriteConflict = mongoError.code === 112 || // MongoDB write conflict code
                              mongoError.message?.includes('WriteConflict') ||
                              mongoError.errorLabels?.includes('TransientTransactionError');
      
      // Implement retry logic with exponential backoff for write conflicts
      if (isWriteConflict && retryAttempt < this.MAX_RETRY_ATTEMPTS) {
        // Calculate delay with exponential backoff
        const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, retryAttempt);
        
        // Log retry attempt
        console.log(`Write conflict detected, retrying (attempt ${retryAttempt + 1}/${this.MAX_RETRY_ATTEMPTS}) after ${delayMs}ms delay`);
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Retry the operation with incremented retry counter
        return this.completeSessionAndReduceQueue(sessionId, userId, retryAttempt + 1);
      }
      
      // Log the error for audit purposes
      console.error('Queue update failed:', error);
      
      // Re-throw the error for the caller to handle
      throw error;
    } finally {
      // End the session
      await mongoSession.endSession();
    }
  }
  
  /**
   * Updates queue positions for all active sessions at a station
   * Called after a session is completed to reorder the queue
   * Implements retry logic for handling write conflicts
   * 
   * @param stationId - The ID of the station to update queue positions for
   * @param completedPosition - The position that was completed (for notifications)
   * @param retryAttempt - Current retry attempt (used internally for recursion)
   */
  public static async updateQueuePositions(
    stationId: string,
    completedPosition: number,
    retryAttempt = 0
  ): Promise<void> {
    await connectDB();
    
    try {
      // Find all active sessions for this station, sorted by join time
      const activeSessions = await ChargingSession.find({
        stationId,
        status: 'active'
      })
      .sort({ joinedAt: 1 });
      
      // Update queue positions one by one to avoid transaction issues
      for (let i = 0; i < activeSessions.length; i++) {
        const session = activeSessions[i];
        const newPosition = i + 1;
        session.queuePosition = newPosition;
        
        // Update estimated wait time based on new position
        session.estimatedWaitTime = await this.calculateEstimatedWaitTime(newPosition, stationId);
        
        await session.save();
      }
      
      // Generate notifications for users whose positions changed
      await NotificationService.updateQueuePositionNotifications(stationId, completedPosition);
    } catch (error: unknown) {
      // Check if this is a write conflict error that we can retry
      const mongoError = error as MongoDBError;
      
      const isWriteConflict = mongoError.code === 112 || 
                              mongoError.message?.includes('WriteConflict') ||
                              mongoError.errorLabels?.includes('TransientTransactionError');
      
      // Implement retry logic with exponential backoff for write conflicts
      if (isWriteConflict && retryAttempt < this.MAX_RETRY_ATTEMPTS) {
        // Calculate delay with exponential backoff
        const delayMs = this.BASE_RETRY_DELAY_MS * Math.pow(2, retryAttempt);
        
        // Log retry attempt
        console.log(`Write conflict detected during queue position update, retrying (attempt ${retryAttempt + 1}/${this.MAX_RETRY_ATTEMPTS}) after ${delayMs}ms delay`);
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Retry the operation with incremented retry counter
        return this.updateQueuePositions(stationId, completedPosition, retryAttempt + 1);
      }
      
      // Log the error
      console.error('Queue position update failed:', error);
      
      // Re-throw the error
      throw error;
    }
  }
  
  /**
   * Calculates estimated wait time based on queue position and average session duration
   * 
   * @param queuePosition - The position in the queue
   * @param stationId - The ID of the station for station-specific calculations
   * @returns Estimated wait time in minutes
   */
  private static async calculateEstimatedWaitTime(
    queuePosition: number,
    stationId: string
  ): Promise<number> {
    // Import from session-utils to avoid circular dependencies
    const { calculateEstimatedWaitTime } = await import('./session-utils');
    return calculateEstimatedWaitTime(queuePosition, stationId);
  }
  
  /**
   * Complete a charging session and update all related data
   * This is a higher-level method that combines multiple operations:
   * 1. Completes the session
   * 2. Reduces the queue count
   * 3. Updates queue positions for remaining sessions
   * 4. Generates notifications for affected users
   * 
   * @param sessionId - The ID of the session being completed
   * @param userId - The ID of the user completing the session
   * @returns The updated queue information and session
   */
  public static async completeSessionAndUpdateQueue(
    sessionId: string,
    userId: string
  ): Promise<{
    session: IChargingSession;
    station: IChargingStation;
    queueUpdate: IQueueUpdate;
  }> {
    // First complete the session and reduce queue count
    const result = await this.completeSessionAndReduceQueue(sessionId, userId);
    
    // Get the completed session's position for notification purposes
    const completedPosition = result.session.queuePosition;
    
    // Then update queue positions for remaining sessions and generate notifications
    await this.updateQueuePositions(result.station._id.toString(), completedPosition);
    
    return result;
  }
  
  /**
   * Validates if a queue update would result in a valid state
   * 
   * @param stationId - The ID of the station to validate
   * @param newCount - The proposed new queue count
   * @returns True if the update is valid, false otherwise
   */
  public static async validateQueueUpdate(
    stationId: string,
    newCount: number
  ): Promise<boolean> {
    await connectDB();
    
    // Basic validation - queue count can't be negative
    if (newCount < 0) {
      return false;
    }
    
    // Check if the station exists
    const station = await ChargingStation.findById(stationId);
    if (!station) {
      return false;
    }
    
    // Count active sessions to ensure consistency
    const activeSessionCount = await ChargingSession.countDocuments({
      stationId,
      status: 'active'
    });
    
    // The new count should not be less than the number of active sessions
    // This helps prevent inconsistencies in the queue state
    return newCount >= activeSessionCount;
  }
  
  /**
   * Creates an audit log entry for queue modifications
   * 
   * @param stationId - The ID of the station being modified
   * @param previousCount - The previous queue count
   * @param newCount - The new queue count
   * @param userId - The ID of the user making the change
   * @param reason - The reason for the queue update
   * @returns The created queue update record
   */
  public static async logQueueUpdate(
    stationId: string,
    previousCount: number,
    newCount: number,
    userId: string,
    reason: 'session_complete' | 'session_join' | 'admin_adjustment'
  ): Promise<IQueueUpdate> {
    await connectDB();
    
    const queueUpdate = await QueueUpdate.create({
      stationId,
      previousCount,
      newCount,
      updatedBy: userId,
      timestamp: new Date(),
      reason
    });
    
    return queueUpdate;
  }
}