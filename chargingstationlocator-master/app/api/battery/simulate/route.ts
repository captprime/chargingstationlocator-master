import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import connectDB from '@/lib/mongodb';
import UserDevice from '@/models/UserDevice';
import BatteryVoltage from '@/models/BatteryVoltage';
import { triggerLowBatteryAlert } from '@/lib/low-battery-alert-service';

// POST /api/battery/simulate
// Session-authenticated endpoint for the browser simulator.
// Writes a real BatteryVoltage reading so the dashboard reflects it.
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { voltage, current, percentage, vehicleId: bodyVehicleId } = body;

    console.log('[Simulate] Received:', { voltage, current, percentage, vehicleId: bodyVehicleId });

    if (typeof voltage !== 'number' || typeof current !== 'number' || typeof percentage !== 'number') {
      return NextResponse.json({ success: false, error: 'voltage, current, percentage required' }, { status: 400 });
    }

    // Admin can pass a specific vehicleId to simulate any device
    // Regular users can only simulate their own device
    let device;
    if (bodyVehicleId) {
      device = await UserDevice.findOne({ vehicleId: bodyVehicleId });
      // Non-admins can only access their own device
      if (device && session.user.role !== 'admin' && device.userId.toString() !== session.user.id) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    } else {
      device = await UserDevice.findOne({ userId: session.user.id, isActive: true })
        ?? await UserDevice.findOne({ userId: session.user.id });
    }

    if (!device) {
      return NextResponse.json({ success: false, error: 'No registered device found' }, { status: 404 });
    }

    // Determine status
    let status: 'normal' | 'low' | 'critical';
    if (percentage <= 15) status = 'critical';
    else if (percentage <= 30) status = 'low';
    else status = 'normal';

    // Determine currentStatus from current value
    let currentStatus: 'charging' | 'discharging' | 'idle';
    if (Math.abs(current) < 0.1) currentStatus = 'idle';
    else if (current > 0) currentStatus = 'charging';
    else currentStatus = 'discharging';

    const reading = new BatteryVoltage({
      voltage,
      current,
      percentage,
      power: voltage * Math.abs(current),
      status,
      currentStatus,
      vehicleId: device.vehicleId,
      userId: device.userId, // always the device owner, not necessarily the session user
      deviceId: device._id,
      timestamp: new Date(),
    });

    await reading.save();
    console.log('[Simulate] Saved:', { current: reading.current, power: reading.power, currentStatus: reading.currentStatus, status: reading.status });

    // Trigger low battery alert if needed
    if (status === 'low' || status === 'critical') {
      triggerLowBatteryAlert({
        userId: device.userId.toString(),
        vehicleId: device.vehicleId,
        percentage,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, status, currentStatus });
  } catch (error) {
    console.error('Simulate error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
