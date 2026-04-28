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
          error: 'Unauthorized. Please log in to access battery history.'
        },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');
    const period = searchParams.get('period') || 'day';
    const limit = parseInt(searchParams.get('limit') || '100');

    // Validate period
    if (!['day', 'week', 'month'].includes(period)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid period. Must be day, week, or month.'
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
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get battery readings for the specified period
    const readings = await BatteryVoltage.find({
      deviceId: targetDevice._id,
      timestamp: { $gte: startDate, $lte: now }
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

    // Transform readings — use ?? not || so 0 and negative values are preserved
    const transformedReadings = readings.map(reading => ({
      id: (reading._id as { toString(): string }).toString(),
      voltage: reading.voltage,
      current: reading.current ?? 0,
      power: reading.power ?? (reading.voltage * Math.abs(reading.current ?? 0)),
      percentage: reading.percentage,
      timestamp: reading.timestamp.toISOString(),
      status: reading.status,
      currentStatus: reading.currentStatus ?? 'idle',
      vehicleId: reading.vehicleId,
    }));

    return NextResponse.json({
      success: true,
      readings: transformedReadings,
      period,
      deviceInfo: {
        deviceName: targetDevice.deviceName,
        vehicleId: targetDevice.vehicleId,
      },
      totalReadings: transformedReadings.length,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      statistics: {
        voltage: {
          min: Math.min(...transformedReadings.map(r => r.voltage)),
          max: Math.max(...transformedReadings.map(r => r.voltage)),
          avg: transformedReadings.reduce((sum, r) => sum + r.voltage, 0) / transformedReadings.length,
        },
        current: {
          min: Math.min(...transformedReadings.map(r => r.current)),
          max: Math.max(...transformedReadings.map(r => r.current)),
          avg: transformedReadings.reduce((sum, r) => sum + r.current, 0) / transformedReadings.length,
        },
        power: {
          min: Math.min(...transformedReadings.map(r => r.power)),
          max: Math.max(...transformedReadings.map(r => r.power)),
          avg: transformedReadings.reduce((sum, r) => sum + r.power, 0) / transformedReadings.length,
        }
      }
    });

  } catch (error) {
    console.error('Error fetching battery history:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    );
  }
}