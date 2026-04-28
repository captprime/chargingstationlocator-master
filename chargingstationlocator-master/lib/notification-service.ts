import UserNotification, { IUserNotification } from '@/models/UserNotification';
import ChargingSession from '@/models/ChargingSession';
import ChargingStation from '@/models/ChargingStation';
import { calculateEstimatedWaitTimeSync } from './session-utils';
import { webSocketService } from './websocket-service';
import connectDB from './mongodb';

/**
 * Service for managing user notifications related to charging sessions and queue updates
 */
export class NotificationService {
  /**
   * Creates a notification for a user when their queue position changes
   * 
   * @param userId - The ID of the user to notify
   * @param sessionId - The ID of the charging session
   * @param previousPosition - The previous queue position
   * @param newPosition - The new queue position
   * @param stationName - The name of the charging station
   * @param stationId - The ID of the charging station (for wait time calculations)
   * @returns The created notification
   */
  public static async createPositionUpdateNotification(
    userId: string,
    sessionId: string,
    previousPosition: number,
    newPosition: number,
    stationName: string
  ): Promise<IUserNotification> {
    await connectDB();

    // Calculate wait time reduction
    const previousWaitTime = calculateEstimatedWaitTimeSync(previousPosition);
    const newWaitTime = calculateEstimatedWaitTimeSync(newPosition);
    const waitTimeReduction = previousWaitTime - newWaitTime;

    // Format wait times for display
    const formattedWaitTime = this.formatWaitTime(newWaitTime);

    // Determine priority based on new position
    let priority: 'low' | 'medium' | 'high' = 'low';
    let type: 'position_update' | 'next_in_line' = 'position_update';
    let message = `Your position in the queue at ${stationName} has moved up from ${previousPosition} to ${newPosition}.`;

    // Special case for position 1
    if (newPosition === 1) {
      priority = 'high';
      type = 'next_in_line';
      message = `You're next! Your turn has arrived at ${stationName}. Please prepare to start charging.`;
    }
    // Special case for position 2
    else if (newPosition === 2) {
      priority = 'medium';
      message = `You're almost there! You're now second in line at ${stationName}. Estimated wait time: ${formattedWaitTime}.`;
    }
    // Special case for significant movement
    else if (waitTimeReduction >= 15) {
      priority = 'medium';
      message = `Your position in the queue at ${stationName} has moved up from ${previousPosition} to ${newPosition}. Your estimated wait time has decreased by ${waitTimeReduction} minutes to ${formattedWaitTime}.`;
    }
    // Regular position update
    else {
      message = `Your position in the queue at ${stationName} has moved up from ${previousPosition} to ${newPosition}. Estimated wait time: ${formattedWaitTime}.`;
    }

    // Create notification in database
    const notification = await UserNotification.create({
      userId,
      sessionId,
      type,
      message,
      read: false,
      priority
    });

    // Send real-time notification via WebSocket
    webSocketService.broadcastUserNotification(userId, {
      sessionId,
      notificationType: type,
      message,
      priority
    });

    return notification;
  }

  /**
   * Formats wait time in a human-readable format
   * 
   * @param minutes - Wait time in minutes
   * @returns Formatted wait time string
   */
  private static formatWaitTime(minutes: number): string {
    if (minutes === 0) {
      return 'available now';
    }

    if (minutes < 60) {
      return `${minutes} minutes`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    return `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${remainingMinutes} minutes`;
  }

  /**
   * Creates a notification when a station becomes available
   * 
   * @param userId - The ID of the user to notify
   * @param sessionId - The ID of the charging session
   * @param stationId - The ID of the charging station
   * @param stationName - The name of the charging station
   * @returns The created notification
   */
  public static async createStationAvailableNotification(
    userId: string,
    sessionId: string,
    stationId: string,
    stationName: string
  ): Promise<IUserNotification> {
    await connectDB();

    const notification = await UserNotification.create({
      userId,
      sessionId,
      type: 'station_available',
      message: `${stationName} is now available! You can start charging immediately.`,
      read: false,
      priority: 'high'
    });

    // Send real-time notification via WebSocket
    webSocketService.broadcastUserNotification(userId, {
      sessionId,
      notificationType: 'station_available',
      message: `${stationName} is now available! You can start charging immediately.`,
      priority: 'high'
    });

    return notification;
  }

  /*
   Updates notifications for all users in a queue when positions change
   Called after a session is completed to notify users of their new positions
  */
  public static async updateQueuePositionNotifications(
    stationId: string,
    completedPosition: number
  ): Promise<void> {
    await connectDB();

    try {
      // Get station information for notification messages
      const station = await ChargingStation.findById(stationId);
      if (!station) {
        console.error(`Station ${stationId} not found for notifications`);
        return;
      }

      const stationName = station.name || `Station ${stationId}`;

      // Find all active sessions for this station that were affected by the position change
      const affectedSessions = await ChargingSession.find({
        stationId,
        status: 'active',
        queuePosition: { $lt: completedPosition } // Only positions that moved up
      });

      // Create notifications for each affected user
      for (const session of affectedSessions) {
        const previousPosition = session.queuePosition + 1; // Position before update
        const newPosition = session.queuePosition; // Current position after update

        await this.createPositionUpdateNotification(
          session.userId,
          session._id.toString(),
          previousPosition,
          newPosition,
          stationName
        );
      }

      // Special notification for the user who is now first in line
      const nextSession = await ChargingSession.findOne({
        stationId,
        status: 'active',
        queuePosition: 1
      });

      if (nextSession) {
        await this.createPositionUpdateNotification(
          nextSession.userId,
          nextSession._id.toString(),
          2, // They were in position 2 before
          1, // Now they're in position 1
          stationName
        );
      }

      // Check if queue is now empty (station available)
      if (station.queueLength === 0) {
        // Find users who might be interested in this station
        // For now, we'll notify users who had sessions at this station in the last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const recentUsers = await ChargingSession.find({
          stationId,
          joinedAt: { $gte: oneDayAgo },
          status: { $in: ['completed', 'cancelled'] }
        }).distinct('userId');

        // Notify these users that the station is now available
        for (const userId of recentUsers) {
          // Create a temporary session ID for the notification
          const tempSessionId = `available-${stationId}-${Date.now()}`;

          await this.createStationAvailableNotification(
            userId,
            tempSessionId,
            stationId,
            stationName
          );
        }
      }
    } catch (error) {
      console.error('Error updating queue position notifications:', error);
    }
  }

  // Gets unread notifications for a user
  public static async getUnreadNotifications(
    userId: string,
    limit: number = 10
  ): Promise<IUserNotification[]> {
    await connectDB();

    return UserNotification.find({
      userId,
      read: false
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  // Marks notifications as read
  public static async markNotificationsAsRead(
    notificationIds: string[],
    userId: string
  ): Promise<number> {
    await connectDB();

    const result = await UserNotification.updateMany(
      {
        _id: { $in: notificationIds },
        userId: userId // Ensure user can only mark their own notifications as read
      },
      {
        $set: { read: true }
      }
    );

    return result.modifiedCount;
  }

  // Deletes old read notifications to keep the database clean
  public static async cleanupOldNotifications(
    olderThan: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: 30 days old
    onlyRead: boolean = true
  ): Promise<number> {
    await connectDB();

    const query: { createdAt: { $lt: Date }; userId?: string; read?: boolean } = {
      createdAt: { $lt: olderThan }
    };

    if (onlyRead) {
      query.read = true;
    }

    const result = await UserNotification.deleteMany(query);

    return result.deletedCount;
  }
}

export default NotificationService;