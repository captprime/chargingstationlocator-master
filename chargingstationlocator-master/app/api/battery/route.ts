import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';
import BatteryVoltage from '@/models/BatteryVoltage';
import { triggerLowBatteryAlert } from '@/lib/low-battery-alert-service';

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
          error: 'Unauthorized. Please log in to access battery data.'
        },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');

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

    // Get the latest battery reading for the device
    const latestReading = await BatteryVoltage.findOne({ 
      deviceId: targetDevice._id 
    }).sort({ timestamp: -1 });
    
    if (!latestReading) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No battery data available for this device.'
        },
        { status: 404 }
      );
    }

    // Return the battery data
    const response = {
      success: true,
      voltage: latestReading.voltage,
      current: latestReading.current ?? 0,
      power: latestReading.power ?? (latestReading.voltage * Math.abs(latestReading.current ?? 0)),
      percentage: latestReading.percentage,
      timestamp: latestReading.timestamp.toISOString(),
      status: latestReading.status,
      currentStatus: latestReading.currentStatus ?? 'idle',
      vehicleId: latestReading.vehicleId,
      deviceName: targetDevice.deviceName
    };
    console.log('[Battery GET] Returning:', { current: response.current, power: response.power, currentStatus: response.currentStatus });
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching battery data:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

    // Get the request body
    const body = await request.json();
    const { voltage, current, percentage, vehicleId, deviceToken } = body;

    // Validate required fields
    if (typeof voltage !== 'number' || typeof current !== 'number' || typeof percentage !== 'number') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Voltage, current, and percentage are required and must be numbers.'
        },
        { status: 400 }
      );
    }

    if (!vehicleId || !deviceToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vehicle ID and device token are required.'
        },
        { status: 400 }
      );
    }

    // Find the device by vehicleId and deviceToken
    const device = await UserDevice.findOne({ 
      vehicleId, 
      deviceToken 
    }).populate('userId');

    if (!device) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid device credentials.'
        },
        { status: 401 }
      );
    }

    // Determine battery status based on percentage
    let status: 'normal' | 'low' | 'critical';
    if (percentage <= 15) {
      status = 'critical';
    } else if (percentage <= 30) {
      status = 'low';
    } else {
      status = 'normal';
    }

    // Create new battery reading
    const batteryReading = new BatteryVoltage({
      voltage,
      current,
      percentage,
      status,
      vehicleId,
      userId: device.userId,
      deviceId: device._id,
      timestamp: new Date(),
    });

    await batteryReading.save();

    // Trigger low battery alert (in-app + SMS) if battery is low/critical
    if (status === 'low' || status === 'critical') {
      const { lat, lng } = body; // optional location from device
      triggerLowBatteryAlert({
        userId: device.userId.toString(),
        vehicleId,
        percentage,
        userLat: typeof lat === 'number' ? lat : undefined,
        userLng: typeof lng === 'number' ? lng : undefined,
      }).catch((err) => console.error('Low battery alert error:', err));
    }

    return NextResponse.json({
      success: true,
      message: 'Battery data recorded successfully',
      data: {
        voltage: batteryReading.voltage,
        current: batteryReading.current,
        power: batteryReading.power,
        percentage: batteryReading.percentage,
        status: batteryReading.status,
        currentStatus: batteryReading.currentStatus,
        timestamp: batteryReading.timestamp.toISOString()
      }
    });

  } catch (error) {
    console.error('Error recording battery data:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    );
  }
}