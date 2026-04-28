import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { DeviceRegistrationSchema } from '@/lib/validation';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';

export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate input data
    const validationResult = DeviceRegistrationSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input data',
          details: validationResult.error.message
        },
        { status: 400 }
      );
    }

    const { vehicleId, deviceName } = validationResult.data;

    // Check if vehicle ID is already registered
    const existingDevice = await UserDevice.findOne({ vehicleId });
    
    if (existingDevice) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vehicle ID is already registered to another user' 
        },
        { status: 409 }
      );
    }

    // Check if user already has this device registered
    const userExistingDevice = await UserDevice.findOne({
      userId: session.user.id,
      vehicleId
    });

    if (userExistingDevice) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'This vehicle is already registered to your account' 
        },
        { status: 409 }
      );
    }

    // Create new device in MongoDB
    const newDevice = new UserDevice({
      userId: session.user.id,
      vehicleId,
      deviceName,
      isActive: true,
      registeredAt: new Date()
    });

    await newDevice.save();

    return NextResponse.json({
      success: true,
      device: {
        id: newDevice._id.toString(),
        vehicleId: newDevice.vehicleId,
        deviceName: newDevice.deviceName,
        isActive: newDevice.isActive,
        registeredAt: newDevice.registeredAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Device registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's devices from MongoDB
    const userDevices = await UserDevice.find({ userId: session.user.id });

    return NextResponse.json({
      success: true,
      devices: userDevices.map(device => ({
        id: device._id.toString(),
        vehicleId: device.vehicleId,
        deviceName: device.deviceName,
        isActive: device.isActive,
        registeredAt: device.registeredAt.toISOString()
      }))
    });

  } catch (error) {
    console.error('Get devices error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}