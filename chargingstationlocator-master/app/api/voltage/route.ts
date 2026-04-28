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
          error: 'Unauthorized. Please log in to access voltage data.'
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

    // Get the latest voltage reading for the device
    const latestReading = await BatteryVoltage.findOne({ 
      deviceId: targetDevice._id 
    }).sort({ timestamp: -1 });
    
    if (!latestReading) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No voltage data available for this device.'
        },
        { status: 404 }
      );
    }

    // Return the voltage data (with backward compatibility)
    return NextResponse.json({
      success: true,
      voltage: latestReading.voltage,
      current: latestReading.current || 0, // Fallback for old data
      power: latestReading.power || (latestReading.voltage * Math.abs(latestReading.current || 0)),
      percentage: latestReading.percentage,
      timestamp: latestReading.timestamp.toISOString(),
      status: latestReading.status,
      currentStatus: latestReading.currentStatus || 'idle', // Fallback for old data
      vehicleId: latestReading.vehicleId,
      deviceName: targetDevice.deviceName
    });

  } catch (error) {
    console.error('Error fetching voltage data:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    );
  }
}