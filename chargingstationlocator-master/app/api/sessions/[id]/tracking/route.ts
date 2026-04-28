import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import ChargingSession from '@/models/ChargingSession';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  ErrorCode 
} from '@/lib/error-handling';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('=== TRACKING API CALLED ===');
  try {
    console.log('Tracking API called');
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('Authentication failed');
      return NextResponse.json(
        createErrorResponse(ErrorCode.UNAUTHORIZED, 'Please log in to update session status.'),
        { status: 401 }
      );
    }

    const userId = session.user.id || session.user.email || '';
    const resolvedParams = await params;
    const sessionId = resolvedParams.id;
    
    console.log(`Updating session ${sessionId} for user ${userId}`);

    // Connect to database
    await connectDB();

    // Parse request body
    const body = await request.json();
    const { trackingStatus } = body;
    
    console.log(`Requested tracking status: ${trackingStatus}`);

    // Validate tracking status
    const validStatuses = ['driving', 'arrived', 'charging', 'completed'];
    if (!validStatuses.includes(trackingStatus)) {
      console.log(`Invalid tracking status: ${trackingStatus}`);
      return NextResponse.json(
        createErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid tracking status.'),
        { status: 400 }
      );
    }

    // Find the session
    const chargingSession = await ChargingSession.findById(sessionId);
    console.log('Found session:', chargingSession ? 'Yes' : 'No');
    
    if (!chargingSession) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.SESSION_NOT_FOUND, 'Session not found.'),
        { status: 404 }
      );
    }

    // Verify ownership
    if (chargingSession.userId !== userId) {
      return NextResponse.json(
        createErrorResponse(ErrorCode.FORBIDDEN, 'You can only update your own sessions.'),
        { status: 403 }
      );
    }

    // Verify session is active
    if (chargingSession.status !== 'active') {
      return NextResponse.json(
        createErrorResponse(ErrorCode.VALIDATION_ERROR, 'Only active sessions can be updated.'),
        { status: 400 }
      );
    }

    // Update tracking status and timestamps
    const now = new Date();
    console.log(`Current tracking status: ${chargingSession.trackingStatus}`);
    console.log(`Updating to: ${trackingStatus}`);
    
    chargingSession.trackingStatus = trackingStatus;

    switch (trackingStatus) {
      case 'arrived':
        if (!chargingSession.arrivedAt) {
          chargingSession.arrivedAt = now;
          console.log(`Set arrivedAt to: ${now}`);
        }
        break;
      case 'charging':
        if (!chargingSession.chargingStartedAt) {
          chargingSession.chargingStartedAt = now;
          console.log(`Set chargingStartedAt to: ${now}`);
        }
        break;
    }

    console.log(`About to save session with trackingStatus: ${chargingSession.trackingStatus}`);
    await chargingSession.save();
    console.log(`Session saved successfully`);
    
    // Verify the save worked by fetching the session again
    const updatedSession = await ChargingSession.findById(sessionId);
    console.log(`Verified saved session trackingStatus: ${updatedSession?.trackingStatus}`);

    return NextResponse.json(
      createSuccessResponse({
        session: {
          id: chargingSession._id.toString(),
          trackingStatus: chargingSession.trackingStatus,
          arrivedAt: chargingSession.arrivedAt,
          chargingStartedAt: chargingSession.chargingStartedAt,
        }
      }, 'Session status updated successfully!')
    );

  } catch (error) {
    console.error('Error updating session tracking status:', error);
    return NextResponse.json(
      createErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to update session status.'),
      { status: 500 }
    );
  }
}