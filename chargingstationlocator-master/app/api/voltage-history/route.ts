import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';
import BatteryVoltage from '@/models/BatteryVoltage';

export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

    // Get the session to validate user authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Please log in to access voltage history.'
        },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');
    const period = searchParams.get('period') || 'day';

    // Validate period parameter
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid period. Must be one of: day, week, month'
        },
        { status: 400 }
      );
    }

    let targetDevice;

    if (vehicleId) {
      // If vehicleId is specified, find that specific device
      targetDevice = await UserDevice.findOne({ vehicleId });

      // Verify the device belongs to the authenticated user
      if (!targetDevice || targetDevice.userId.toString() !== session.user.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Device not found or access denied.'
          },
          { status: 404 }
        );
      }
    } else {
      // If no vehicleId specified, get user's active device
      const userDevices = await UserDevice.find({ userId: session.user.id });
      targetDevice = userDevices.find(device => device.isActive) || userDevices[0];

      if (!targetDevice) {
        return NextResponse.json(
          {
            success: false,
            error: 'No registered devices found. Please register a device first.'
          },
          { status: 404 }
        );
      }
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get voltage readings for the specified period
    const readings = await BatteryVoltage.find({
      deviceId: targetDevice._id,
      timestamp: {
        $gte: startDate,
        $lte: now
      }
    })
      .sort({ timestamp: -1 }) // Most recent first
      .limit(1000) // Limit to prevent excessive data transfer
      .lean(); // Use lean() for better performance

    // Transform the data for the response
    const transformedReadings = readings.map(reading => ({
      id: reading._id as string,
      voltage: reading.voltage,
      percentage: reading.percentage,
      timestamp: reading.timestamp.toISOString(),
      status: reading.status,
      vehicleId: reading.vehicleId
    }));

    // Return the voltage history data
    return NextResponse.json({
      success: true,
      readings: transformedReadings,
      period,
      deviceInfo: {
        deviceName: targetDevice.deviceName,
        vehicleId: targetDevice.vehicleId
      },
      totalReadings: transformedReadings.length,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching voltage history:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    );
  }
}