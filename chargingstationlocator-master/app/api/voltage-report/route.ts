import { NextRequest, NextResponse } from 'next/server';
import { VoltageReportSchema } from '@/lib/validation';
import { voltageToPercentage, getBatteryStatus, isValidVoltage, sanitizeVoltage } from '@/lib/battery-utils';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';
import BatteryVoltage from '@/models/BatteryVoltage';

export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

    const body = await request.json();
    
    // Validate the request body
    const validationResult = VoltageReportSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.message
        },
        { status: 400 }
      );
    }

    const { vehicleId, voltage, timestamp } = validationResult.data;

    // Additional voltage validation
    if (!isValidVoltage(voltage)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid voltage reading. Voltage must be between 30V and 60V'
        },
        { status: 400 }
      );
    }

    // Find the device by vehicle ID
    const device = await UserDevice.findOne({ vehicleId }).populate('userId');
    
    if (!device) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vehicle ID not found. Please register this device first.'
        },
        { status: 404 }
      );
    }

    // Sanitize voltage reading
    const sanitizedVoltage = sanitizeVoltage(voltage);

    // Calculate percentage and status
    const percentage = voltageToPercentage(sanitizedVoltage);
    const status = getBatteryStatus(sanitizedVoltage);

    // Create battery reading
    const batteryReading = new BatteryVoltage({
      voltage: sanitizedVoltage,
      percentage,
      status,
      vehicleId,
      userId: device.userId,
      deviceId: device._id,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    // Save to database
    await batteryReading.save();

    // Return success response with reading details
    return NextResponse.json({
      success: true,
      reading: {
        id: batteryReading._id.toString(),
        voltage: batteryReading.voltage,
        percentage: batteryReading.percentage,
        status: batteryReading.status,
        timestamp: batteryReading.timestamp.toISOString()
      }
    });

  } catch (error) {
    console.error('Error processing voltage report:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    );
  }
}