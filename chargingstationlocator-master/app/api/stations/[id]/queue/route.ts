import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ChargingStation from '@/models/ChargingStation';
import ChargingSession from '@/models/ChargingSession';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import mongoose from 'mongoose';
import { calculateEstimatedWaitTime, createQueueAuditRecord } from '@/lib/session-utils';
import webSocketService from '@/lib/websocket-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to the database
    await connectDB();

    const resolvedParams = await params;
    const stationId = resolvedParams.id;
    const userId = session.user.id || session.user.email || '';

    // Check if user already has an active session at this station
    const existingSession = await ChargingSession.findOne({
      userId: userId,
      stationId: stationId,
      status: 'active'
    });

    if (existingSession) {
      return NextResponse.json(
        { error: 'You are already in the queue for this station' },
        { status: 409 }
      );
    }

    // Start a transaction to ensure data consistency
    const mongoSession = await mongoose.startSession();

    try {
      const result = await mongoSession.withTransaction(async () => {
        // Find the station and increment queue length
        const station = await ChargingStation.findByIdAndUpdate(
          stationId,
          { $inc: { queueLength: 1 } },
          { new: true, session: mongoSession }
        );

        if (!station) {
          throw new Error('Station not found');
        }

        // Calculate estimated wait time
        const estimatedWaitTime = await calculateEstimatedWaitTime(
          station.queueLength,
          stationId
        );

        // Create a new charging session record
        const sessionResult = await ChargingSession.create([{
          userId: userId,
          stationId: stationId,
          joinedAt: new Date(), // This is where joinedAt is set!
          status: 'active',
          trackingStatus: 'driving', // Initial tracking status
          queuePosition: station.queueLength,
          estimatedWaitTime: estimatedWaitTime
        }], { session: mongoSession });

        const chargingSession = sessionResult[0];

        // Create audit trail
        await createQueueAuditRecord(
          stationId,
          station.queueLength - 1,
          station.queueLength,
          userId,
          'session_join',
          mongoSession
        );

        return { station, chargingSession };
      });

      if (!result) {
        throw new Error('Transaction failed');
      }

      const { station, chargingSession } = result;

      // Broadcast queue update via WebSocket
      webSocketService.broadcastQueueUpdate(
        stationId,
        station.queueLength,
        userId
      );

      return NextResponse.json({
        success: true,
        station: {
          ...station.toObject(),
          id: station._id.toString()
        },
        session: {
          id: chargingSession._id.toString(),
          queuePosition: station.queueLength,
          estimatedWaitTime: chargingSession.estimatedWaitTime,
          joinedAt: chargingSession.joinedAt,
          trackingStatus: chargingSession.trackingStatus
        },
        message: 'Successfully joined the queue'
      });

    } finally {
      await mongoSession.endSession();
    }

  } catch (error) {
    console.error('Error joining queue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to the database
    await connectDB();

    const resolvedParams = await params;
    const stationId = resolvedParams.id;
    const userId = session.user.id || session.user.email || '';

    // Start a transaction to ensure data consistency
    const mongoSession = await mongoose.startSession();

    try {
      const result = await mongoSession.withTransaction(async () => {
        // Find the user's active session at this station
        const chargingSession = await ChargingSession.findOne({
          userId: userId,
          stationId: stationId,
          status: 'active'
        }).session(mongoSession);

        if (!chargingSession) {
          throw new Error('No active session found for this station');
        }

        // Cancel the session
        chargingSession.status = 'cancelled';
        await chargingSession.save({ session: mongoSession });

        // Find the station and decrement queue length (but not below 0)
        const station = await ChargingStation.findByIdAndUpdate(
          stationId,
          { $inc: { queueLength: -1 } },
          { new: true, session: mongoSession }
        );

        if (!station) {
          throw new Error('Station not found');
        }

        // Ensure queue length doesn't go below 0
        if (station.queueLength < 0) {
          station.queueLength = 0;
          await station.save({ session: mongoSession });
        }

        // Update queue positions for remaining active sessions
        await ChargingSession.updateMany(
          {
            stationId: stationId,
            status: 'active',
            queuePosition: { $gt: chargingSession.queuePosition }
          },
          {
            $inc: { queuePosition: -1 }
          },
          { session: mongoSession }
        );

        // Create audit trail
        await createQueueAuditRecord(
          stationId,
          station.queueLength + 1,
          station.queueLength,
          userId,
          'session_cancel',
          mongoSession
        );

        return { station, chargingSession };
      });

      if (!result) {
        throw new Error('Transaction failed');
      }

      const { station } = result;

      // Broadcast queue update via WebSocket
      webSocketService.broadcastQueueUpdate(
        stationId,
        station.queueLength,
        userId
      );

      return NextResponse.json({
        success: true,
        station: {
          ...station.toObject(),
          id: station._id.toString()
        },
        message: 'Successfully left the queue'
      });

    } finally {
      await mongoSession.endSession();
    }

  } catch (error) {
    console.error('Error leaving queue:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}